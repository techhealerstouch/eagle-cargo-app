<?php

namespace App\Http\Controllers\Admin;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\TrackingPhase;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreBatchRequest;
use App\Http\Resources\Admin\BatchResource;
use App\Models\Batch;
use App\Models\Box;
use App\Models\BoxUpdate;
use App\Services\BatchService;
use App\Services\TrackingStepService;
use BackedEnum;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class BatchController extends Controller
{
    public function index(Request $request, TrackingStepService $trackingStepService)
    {
        $query = Batch::with(['boxes']);

        $query->when($request->search, function ($q, $search) {
            $q->where(function ($qq) use ($search) {
                $qq->where('batch_number', 'like', "%{$search}%")
                    ->orWhere('voyage_number', 'like', "%{$search}%")
                    ->orWhere('container_number', 'like', "%{$search}%");
            });
        })->when($request->status && $request->status !== 'all', function ($q) use ($request) {
            $q->where('status', $request->status);
        });

        $batches = $query->latest()->paginate(10)->withQueryString();
        $trackingSteps = $this->configuredTrackingSteps($trackingStepService);

        return Inertia::render('admin/batches/index', [
            'batches' => BatchResource::collection($batches),
            'filters' => $request->only(['search', 'status']),
            'trackingPhases' => $this->trackingPhaseOptionsForUser($trackingSteps, $request->user()),
        ]);
    }

    public function create(Request $request)
    {
        $templateBatch = null;
        if ($request->filled('template_id')) {
            $templateBatch = Batch::find($request->template_id);
        }

        return Inertia::render('admin/batches/create', [
            'templateBatch' => $templateBatch,
        ]);
    }

    public function store(StoreBatchRequest $request, BatchService $batchService): RedirectResponse
    {
        $batchService->create($request->validated());

        return redirect()->route('admin.batches.index')->with('success', 'Batch created successfully.');
    }

    public function show(Batch $batch, TrackingStepService $trackingStepService)
    {
        if (!$batch->is_read) {
            $batch->update(['is_read' => true]);
        }

        $batch->load(['boxes.booking.sender', 'boxes.recipient', 'boxes.boxType']);
        $trackingSteps = $this->configuredTrackingSteps($trackingStepService);

        return Inertia::render('admin/batches/show', [
            'batch' => new BatchResource($batch),
            'statuses' => collect(BatchStatus::cases())->map(fn ($s) => ['value' => $s->value, 'label' => $s->label()]),
            'trackingPhases' => $this->trackingPhaseOptionsForUser($trackingSteps, request()->user()),
        ]);
    }

    public function edit(Batch $batch)
    {
        return Inertia::render('admin/batches/edit', [
            'batch' => $batch,
        ]);
    }

    public function update(StoreBatchRequest $request, Batch $batch, BatchService $batchService): RedirectResponse
    {
        try {
            $updatedBatch = $batchService->update($batch, $request->validated());

            $requestedStatus = $request->validated('status');
            if ($requestedStatus === BatchStatus::ReadyToClose->value && $updatedBatch->status === BatchStatus::Loading) {
                return redirect()->route('admin.batches.index')->with('warning', 'Batch updated, but status reverted to Loading because manifest thresholds (capacity/cutoff) were not met.');
            }

        } catch (\InvalidArgumentException $exception) {
            return back()->withErrors(['status' => $exception->getMessage()]);
        }

        return redirect()->route('admin.batches.index')->with('success', 'Batch updated successfully.');
    }

    public function confirmManifest(Batch $batch, BatchService $batchService): RedirectResponse
    {
        try {
            $sailedBatch = $batchService->confirmManifest($batch);
        } catch (\InvalidArgumentException $exception) {
            return back()->withErrors(['status' => $exception->getMessage()]);
        }

        return redirect()->route('admin.batches.index')->with(
            'success',
            sprintf('Batch %s has sailed.', $sailedBatch->batch_number),
        );
    }

    public function confirmArrival(Batch $batch, BatchService $batchService): RedirectResponse
    {
        try {
            $arrivedBatch = $batchService->confirmArrival($batch);
        } catch (\InvalidArgumentException $exception) {
            return back()->withErrors(['status' => $exception->getMessage()]);
        }

        return back()->with(
            'success',
            sprintf('Batch %s has arrived at destination port.', $arrivedBatch->batch_number),
        );
    }

    public function reopen(Batch $batch, BatchService $batchService): RedirectResponse
    {
        try {
            $reopenedBatch = $batchService->update($batch, ['status' => BatchStatus::Open->value]);
        } catch (\InvalidArgumentException $exception) {
            return back()->withErrors(['status' => $exception->getMessage()]);
        }

        return back()->with(
            'success',
            sprintf('Batch %s has been reopened to %s status.', $reopenedBatch->batch_number, $reopenedBatch->status->label()),
        );
    }

    /**
     * Search for boxes available to load into this batch.
     */
    public function availableBoxes(Request $request, Batch $batch)
    {
        $query = Box::whereIn('status', [BoxStatus::ReceivedByWarehouse, BoxStatus::Arrived])
            ->with(['booking.sender', 'booking.invoice', 'recipient', 'boxType']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('tracking_number', 'like', "%{$search}%")
                    ->orWhereHas('booking.sender', function ($sq) use ($search) {
                        $sq->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        return response()->json(
            $query->orderBy('tracking_number')->limit(100)->get()
        );
    }

    /**
     * Bulk-load boxes into this batch.
     */
    public function loadBoxes(Request $request, Batch $batch, BatchService $batchService)
    {
        // Guard: only allow loading into batches in "loading" or "open" status
        if (! in_array($batch->status, [BatchStatus::Open, BatchStatus::Loading])) {
            return back()->with('error', 'Cannot load boxes into a batch that is not in "Open" or "Loading" status.');
        }

        $validated = $request->validate([
            'box_ids' => 'nullable|array',
            'box_ids.*' => 'exists:boxes,id',
            'tracking_numbers' => 'nullable|array',
            'tracking_numbers.*' => 'string',
        ]);

        $boxIds = $validated['box_ids'] ?? [];
        $trackingNumbers = $validated['tracking_numbers'] ?? [];

        if (empty($boxIds) && empty($trackingNumbers)) {
            return back()->with('error', 'Please provide boxes to load.');
        }

        $boxes = Box::where(function ($q) use ($boxIds, $trackingNumbers) {
            if (!empty($boxIds)) {
                $q->whereIn('id', $boxIds);
            }
            if (!empty($trackingNumbers)) {
                $q->orWhereIn('tracking_number', $trackingNumbers);
            }
        })->get();

        // Hybrid capacity check: check if adding these boxes would exceed capacity
        $capacityWarning = $batchService->checkCapacity($batch, count($boxes));

        $loaded = 0;
        $skipped = 0;
        $skippedReasons = [];

        // Identify missing tracking numbers
        if (!empty($trackingNumbers)) {
            $foundTrackingNumbers = $boxes->pluck('tracking_number')->toArray();
            foreach ($trackingNumbers as $tn) {
                if (!in_array($tn, $foundTrackingNumbers)) {
                    $skipped++;
                    $skippedReasons[] = "{$tn}: Tracking number not found";
                }
            }
        }

        DB::transaction(function () use ($boxes, $batch, $batchService, &$loaded, &$skipped, &$skippedReasons) {
            /** @var Box $box */
            foreach ($boxes as $box) {
                // If box is Pending or Collected, assume it was picked up and received by warehouse when manually added
                if (in_array($box->status, [BoxStatus::Pending, BoxStatus::Collected])) {
                    $box->update(['status' => BoxStatus::ReceivedByWarehouse->value]);
                    $box->status = BoxStatus::ReceivedByWarehouse;
                }

                // Reject boxes not in received_by_warehouse or arrived status
                if (! in_array($box->status, [BoxStatus::ReceivedByWarehouse, BoxStatus::Arrived])) {
                    $skipped++;
                    $skippedReasons[] = "{$box->tracking_number}: status is {$box->status->value}";

                    continue;
                }

                if ($box->booking->status === BookingStatus::Cancelled) {
                    $skipped++;
                    $skippedReasons[] = "{$box->tracking_number}: booking is cancelled";
                    continue;
                }

                if ($box->booking->payment_status !== PaymentStatus::Paid) {
                    $skipped++;
                    $skippedReasons[] = "{$box->tracking_number}: payment is not paid";
                    continue;
                }

                if ($box->booking->needsDeclaration()) {
                    $skipped++;
                    $skippedReasons[] = "{$box->tracking_number}: customs declaration is missing";
                    continue;
                }

                $invoice = $box->booking->invoice;
                if (! $invoice || $invoice->status === InvoiceStatus::Voided) {
                    $skipped++;
                    $skippedReasons[] = "{$box->tracking_number}: no valid invoice generated";
                    continue;
                }

                if (! $box->recipient_id) {
                    $skipped++;
                    $skippedReasons[] = "{$box->tracking_number}: no recipient assigned";
                    continue;
                }

                $recipient = $box->recipient;
                if (! $recipient->city || ! $recipient->province) {
                    $skipped++;
                    $skippedReasons[] = "{$box->tracking_number}: incomplete recipient address";
                    continue;
                }

                if (! $recipient->phone_number) {
                    $skipped++;
                    $skippedReasons[] = "{$box->tracking_number}: missing recipient phone number";
                    continue;
                }

                if ($box->price_charged === null || (float) $box->price_charged <= 0) {
                    $skipped++;
                    $skippedReasons[] = "{$box->tracking_number}: missing or zero price";
                    continue;
                }

                if ($recipient->sender_id !== $box->booking->sender_id) {
                    $skipped++;
                    $skippedReasons[] = "{$box->tracking_number}: recipient does not belong to booking sender";
                    continue;
                }

                // If box is already in a batch, it's a "re-batching" scenario (e.g., from container to domestic truck)
                $oldBatchId = $box->batch_id;

                // Update box — triggers BoxObserver for audit log, notifications, booking rollup.
                $box->update([
                    'batch_id' => $batch->id,
                ]);

                if ($oldBatchId) {
                    // Force refresh metrics for the old batch
                    $batchService->refreshAndEvaluateById($oldBatchId);
                }

                $loaded++;
            }
        });

        // Deferred batch refresh — run once after bulk load instead of per-box
        if ($loaded > 0) {
            $batchService->refreshAndEvaluateById($batch->id);
        }

        // Auto-transition to Loading if batch was Open
        if ($loaded > 0 && $batch->status === BatchStatus::Open) {
            $batchService->update($batch, ['status' => BatchStatus::Loading->value]);
        }

        $message = "{$loaded} box(es) loaded into batch.";
        if ($skipped > 0) {
            $message .= " {$skipped} skipped.";
        }

        $batch->refresh();
        $isFull = $batch->status === BatchStatus::ReadyToClose->value;

        $response = back()
            ->with('success', $message)
            ->with('batch_full', $isFull)
            ->with('skipped_reasons', $skippedReasons);

        if ($capacityWarning) {
            $response->with('warning', $capacityWarning);
        }

        return $response;
    }

    public function bulkUpdateTrackingPhase(
        Request $request,
        Batch $batch,
        BatchService $batchService,
        TrackingStepService $trackingStepService,
    ): RedirectResponse {
        if (in_array($batch->status, [\App\Enums\BatchStatus::Open, \App\Enums\BatchStatus::Loading], true)) {
            return back()->with('error', 'Tracking phase cannot be updated for batches that are still Open or Loading.');
        }
        $trackingSteps = $this->configuredTrackingSteps($trackingStepService);

        $validated = $request->validate([
            'tracking_phase' => [
                'required',
                'string',
                Rule::in($trackingSteps->pluck('key')->all()),
            ],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        if ($validated['tracking_phase'] === TrackingPhase::DELIVERED->value) {
            return back()->with('error', 'Delivered status must be manually updated 1 by 1 because this requires proof of delivery.');
        }

        $trackingStep = $trackingSteps->firstWhere('key', $validated['tracking_phase']);

        if (! $this->userCanApplyTrackingStep($request->user(), $trackingStep)) {
            abort(403, 'Unauthorized tracking phase.');
        }

        $latestTrackingPhase = $this->latestTrackingPhaseForBatch($batch);
        $latestOrder = $this->trackingStepOrder($trackingSteps, $latestTrackingPhase);
        $selectedOrder = $this->trackingStepOrder($trackingSteps, $validated['tracking_phase']);

        if ($latestOrder !== null && $selectedOrder !== null && $selectedOrder <= $latestOrder) {
            return back()->with(
                'error',
                'This batch is already at or past that tracking phase. Select a later phase to continue.',
            );
        }

        try {
            $updated = $batchService->bulkUpdateTrackingPhase(
                $batch,
                $validated['tracking_phase'],
                $request->user()?->id,
                $validated['description'] ?? null,
                $trackingStep['system_status'] ?? null,
            );
        } catch (\InvalidArgumentException|\RuntimeException $exception) {
            return back()->with('error', $exception->getMessage());
        }

        if ($updated === 0) {
            return back()->with('error', 'No boxes found in this batch to update.');
        }

        return back()->with(
            'success',
            sprintf(
                'Updated tracking phase to "%s" for %d box(es).',
                str_replace('_', ' ', (string) $validated['tracking_phase']),
                $updated,
            ),
        );
    }

    public function bulkUpdateStatus(Request $request, BatchService $batchService)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:batches,id',
            'status' => 'required|string',
        ]);

        $batches = Batch::findMany($validated['ids']);
        $updated = 0;
        $reverted = 0;

        foreach ($batches as $batch) {
            try {
                $updatedBatch = $batchService->update($batch, ['status' => $validated['status']]);

                if ($validated['status'] === BatchStatus::ReadyToClose->value && $updatedBatch->status === BatchStatus::Loading) {
                    $reverted++;
                } else {
                    $updated++;
                }
            } catch (\Exception $e) {
                // Skip if transition is not allowed
            }
        }

        $message = "{$updated} batches updated successfully.";

        if ($reverted > 0) {
            $message .= " {$reverted} batch(es) reverted to Loading because manifest thresholds were not met.";

            return redirect()->route('admin.batches.index')->with('warning', $message);
        }

        return redirect()->route('admin.batches.index')->with('success', $message);
    }

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:batches,id',
        ]);

        $batches = Batch::findMany($validated['ids']);
        $deleted = 0;

        foreach ($batches as $batch) {
            if (! $batch->boxes()->exists()) {
                $batch->delete();
                $deleted++;
            }
        }

        return redirect()->route('admin.batches.index')->with('success', "{$deleted} batches deleted (only empty batches can be deleted).");
    }

    public function destroy(Batch $batch): RedirectResponse
    {
        if ($batch->boxes()->exists()) {
            return back()->withErrors(['batch' => 'Cannot delete a batch that already has assigned boxes.']);
        }

        $batch->delete();

        return redirect()->route('admin.batches.index')->with('success', 'Batch deleted successfully.');
    }

    private function trackingPhaseOptionsForUser(\Illuminate\Support\Collection $trackingSteps, mixed $user): \Illuminate\Support\Collection
    {
        return $trackingSteps
            ->filter(fn (array $step): bool => $this->userCanApplyTrackingStep($user, $step))
            ->filter(fn (array $step): bool => $step['key'] !== TrackingPhase::DELIVERED->value)
            ->map(function (array $step): array {
                $phase = TrackingPhase::from((string) $step['key']);

                return [
                    'value' => $phase->value,
                    'label' => (string) ($step['label'] ?? $phase->label()),
                    'group' => (string) ($step['phase'] ?? $phase->phase()),
                    'order' => (int) ($step['order'] ?? 0),
                ];
            })
            ->values();
    }

    private function configuredTrackingSteps(TrackingStepService $trackingStepService): \Illuminate\Support\Collection
    {
        return collect($trackingStepService->getSteps())
            ->sortBy(fn (array $step): int => (int) ($step['order'] ?? 0))
            ->filter(fn (array $step): bool => TrackingPhase::tryFrom((string) ($step['key'] ?? '')) !== null)
            ->map(function (array $step): array {
                $phase = TrackingPhase::from((string) $step['key']);

                return array_merge($step, [
                    'key' => $phase->value,
                    'label' => $step['label'] ?? $phase->label(),
                    'phase' => $step['phase'] ?? $phase->phase(),
                    'allowed_roles' => $step['allowed_roles'] ?? [],
                ]);
            })
            ->values();
    }

    private function latestTrackingPhaseForBatch(Batch $batch): ?string
    {
        $boxIds = $batch->boxes()->pluck('id');

        if ($boxIds->isEmpty()) {
            return null;
        }

        return BoxUpdate::whereIn('box_id', $boxIds)
            ->whereNotNull('tracking_phase')
            ->latest()
            ->first()
            ?->tracking_phase
            ?->value;
    }

    private function trackingStepOrder(\Illuminate\Support\Collection $trackingSteps, ?string $trackingPhase): ?int
    {
        if ($trackingPhase === null) {
            return null;
        }

        return $trackingSteps->firstWhere('key', $trackingPhase)['order'] ?? null;
    }

    private function userCanApplyTrackingStep(mixed $user, mixed $step): bool
    {
        if (! is_array($step)) {
            return false;
        }

        $role = $this->userRoleValue($user);

        if (in_array($role, [Role::Admin->value, Role::SuperAdmin->value], true)) {
            return true;
        }

        return in_array($role, $step['allowed_roles'] ?? [], true);
    }

    private function userRoleValue(mixed $user): string
    {
        $role = $user?->role;

        if ($role instanceof BackedEnum) {
            return $role->value;
        }

        return (string) $role;
    }
}
