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
use App\Services\DeveloperAccess;
use App\Http\Requests\Admin\StoreBatchRequest;
use App\Http\Resources\Admin\BatchResource;
use App\Models\Batch;
use App\Models\Box;
use App\Models\BoxUpdate;
use App\Services\BatchService;
use App\Services\TrackingStepService;
use BackedEnum;
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

    /**
     * Real-time uniqueness check for batch fields (container number, seal number, batch number).
     */
    public function checkUnique(Request $request)
    {
        $validated = $request->validate([
            'field' => 'required|string|in:container_number,batch_number,seal_number',
            'value' => 'required|string|max:255',
            'exclude_id' => 'nullable|integer|exists:batches,id',
        ]);

        $query = Batch::where($validated['field'], $validated['value']);

        if (! empty($validated['exclude_id'])) {
            $query->where('id', '!=', $validated['exclude_id']);
        }

        return response()->json([
            'available' => ! $query->exists(),
        ]);
    }

    public function store(StoreBatchRequest $request, BatchService $batchService): RedirectResponse
    {
        $batchService->create($request->validated());

        return redirect($this->adminReturnUrl('admin.batches.index'))->with('success', 'Batch created successfully.');
    }

    public function show(Batch $batch, TrackingStepService $trackingStepService)
    {
        if (! $batch->is_read) {
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

    public function edit(Batch $batch, TrackingStepService $trackingStepService)
    {
        $batch->load(['boxes']);
        $trackingSteps = $this->configuredTrackingSteps($trackingStepService);

        return Inertia::render('admin/batches/edit', [
            'batch' => new BatchResource($batch),
            'trackingPhases' => $this->trackingPhaseOptionsForUser($trackingSteps, request()->user()),
        ]);
    }

    public function update(
        StoreBatchRequest $request,
        Batch $batch,
        BatchService $batchService,
        TrackingStepService $trackingStepService,
    ): RedirectResponse {
        $validated = $request->validated();
        $trackingPhase = $validated['tracking_phase'] ?? null;
        $trackingDescription = $validated['tracking_description'] ?? null;
        unset($validated['tracking_phase'], $validated['tracking_description']);

        try {
            DB::transaction(function () use ($batch, $validated, $trackingPhase, $trackingDescription, $batchService, $trackingStepService, $request) {
                $batchService->update($batch, $validated);

                if (! empty($trackingPhase)) {
                    $trackingSteps = $this->configuredTrackingSteps($trackingStepService);
                    $trackingStep = $trackingSteps->firstWhere('key', $trackingPhase);

                    if ($trackingPhase !== TrackingPhase::DELIVERED->value && $this->userCanApplyTrackingStep($request->user(), $trackingStep)) {
                        $batchService->bulkUpdateTrackingPhase(
                            $batch,
                            $trackingPhase,
                            $request->user()?->id,
                            $trackingDescription,
                            $trackingStep['system_status'] ?? null,
                        );
                    }
                }
            });
        } catch (\InvalidArgumentException $exception) {
            return back()->withErrors(['status' => $exception->getMessage()]);
        }

        return redirect($this->adminReturnUrl('admin.batches.index'))->with('success', 'Batch updated successfully.');
    }

    public function confirmManifest(Request $request, Batch $batch, BatchService $batchService): RedirectResponse
    {
        $validated = $request->validate([
            'eta_at' => 'nullable|date',
        ]);

        try {
            $sailedBatch = $batchService->confirmManifest($batch, $validated['eta_at'] ?? null);
        } catch (\InvalidArgumentException $exception) {
            return back()->withErrors(['status' => $exception->getMessage()]);
        }

        return redirect($this->adminReturnUrl('admin.batches.index'))->with(
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

    /**
     * Search for boxes available to load into this batch.
     */
    public function availableBoxes(Request $request, Batch $batch)
    {
        $query = Box::whereIn('status', [
                BoxStatus::Pending,
                BoxStatus::Collected,
                BoxStatus::ReceivedByWarehouse,
                BoxStatus::Arrived,
            ])
            ->where(function ($q) use ($batch) {
                $q->whereNull('batch_id')
                    ->orWhere('batch_id', '!=', $batch->id);
            })
            ->whereHas('booking', function ($bq) {
                $bq->whereNotIn('status', [BookingStatus::Cancelled, BookingStatus::Pending, BookingStatus::Draft]);
            })
            ->with(['booking.sender', 'booking.invoice', 'recipient', 'boxType', 'batch']);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('tracking_number', 'like', "%{$search}%")
                    ->orWhere('serial_number', 'like', "%{$search}%")
                    ->orWhereHas('booking', function ($bq) use ($search) {
                        $bq->where('reference_number', 'like', "%{$search}%")
                            ->orWhereHas('sender', function ($sq) use ($search) {
                                $sq->where('first_name', 'like', "%{$search}%")
                                    ->orWhere('last_name', 'like', "%{$search}%")
                                    ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"])
                                    ->orWhere('email', 'like', "%{$search}%")
                                    ->orWhere('mobile', 'like', "%{$search}%");
                            });
                    })
                    ->orWhereHas('recipient', function ($rq) use ($search) {
                        $rq->where('name', 'like', "%{$search}%")
                            ->orWhere('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"])
                            ->orWhere('phone_number', 'like', "%{$search}%");
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
            if (! empty($boxIds)) {
                $q->whereIn('id', $boxIds);
            }
            if (! empty($trackingNumbers)) {
                $q->orWhereIn('tracking_number', $trackingNumbers);
            }
        })->get();

        // Hybrid capacity check: warn if adding these boxes would exceed capacity, but do not block
        $capacityWarning = $batchService->checkCapacity($batch, count($boxes));

        $loaded = 0;
        $skipped = 0;
        $skippedReasons = [];

        // Identify missing tracking numbers
        if (! empty($trackingNumbers)) {
            $foundTrackingNumbers = $boxes->pluck('tracking_number')->toArray();
            foreach ($trackingNumbers as $tn) {
                if (! in_array($tn, $foundTrackingNumbers)) {
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

                if (in_array($box->booking->status, [BookingStatus::Cancelled, BookingStatus::Pending, BookingStatus::Draft])) {
                    $skipped++;
                    $skippedReasons[] = "{$box->tracking_number}: booking is {$box->booking->status->value} (must be confirmed)";

                    continue;
                }

                $isPaid = $box->booking->payment_status === PaymentStatus::Paid
                    || $box->booking->payment_status === PaymentStatus::CashCollected
                    || ($box->booking->invoice && $box->booking->invoice->status === InvoiceStatus::Paid);

                if (! $isPaid) {
                    $skipped++;
                    $skippedReasons[] = "{$box->tracking_number}: payment is not settled";

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

        if (in_array($batch->status, [BatchStatus::Open, BatchStatus::Loading], true)) {
            return back()->with('error', 'Cannot apply tracking updates to a batch that is still open or loading.');
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
            'ids' => 'required_without:select_all|array',
            'ids.*' => 'exists:batches,id',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string|max:255',
            'status_filter' => 'nullable|string|in:all,open,loading,ready_to_close,sailed,arrived,under_customs_clearance,released_by_boc,received_at_warehouse',
            'status' => 'required|string|in:open,loading,ready_to_close,sailed,arrived,under_customs_clearance,released_by_boc,received_at_warehouse',
        ]);

        $batches = $this->bulkBatchSelection($request, $validated);
        $updated = 0;
        $skipped = 0;

        foreach ($batches as $batch) {
            try {
                $batchService->update($batch, ['status' => $validated['status']]);
                $updated++;
            } catch (\Exception $e) {
                $skipped++;
            }
        }

        $result = [
            'requested' => $batches->count(),
            'updated' => $updated,
            'skipped' => $skipped,
            'reasons' => $skipped > 0 ? ['invalid_transition' => $skipped] : [],
        ];
        $message = "{$updated} batches updated successfully.";
        if ($skipped > 0) {
            $message .= " {$skipped} batches skipped.";
        }

        $returnUrl = request()->input('return_to') ?? session('admin_return_url') ?? route('admin.batches.index');
        return redirect($returnUrl)->with('success', $message)->with('bulk_result', $result);
    }

    public function bulkUpdateBatchesTrackingPhase(
        Request $request,
        BatchService $batchService,
        TrackingStepService $trackingStepService,
    ): RedirectResponse {
        $trackingSteps = $this->configuredTrackingSteps($trackingStepService);

        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'ids.*' => 'exists:batches,id',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string|max:255',
            'status_filter' => 'nullable|string|in:all,open,loading,ready_to_close,sailed,arrived,under_customs_clearance,released_by_boc,received_at_warehouse',
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

        $batches = $this->bulkBatchSelection($request, $validated);
        $updatedBatches = 0;
        $totalBoxesUpdated = 0;
        $skipped = 0;

        foreach ($batches as $batch) {
            if (in_array($batch->status, [BatchStatus::Open, BatchStatus::Loading], true)) {
                $skipped++;
                continue;
            }

            $latestTrackingPhase = $this->latestTrackingPhaseForBatch($batch);
            $latestOrder = $this->trackingStepOrder($trackingSteps, $latestTrackingPhase);
            $selectedOrder = $this->trackingStepOrder($trackingSteps, $validated['tracking_phase']);

            if ($latestOrder !== null && $selectedOrder !== null && $selectedOrder <= $latestOrder) {
                $skipped++;
                continue;
            }

            try {
                $updatedBoxes = $batchService->bulkUpdateTrackingPhase(
                    $batch,
                    $validated['tracking_phase'],
                    $request->user()?->id,
                    $validated['description'] ?? null,
                    $trackingStep['system_status'] ?? null,
                );

                if ($updatedBoxes > 0) {
                    $updatedBatches++;
                    $totalBoxesUpdated += $updatedBoxes;
                } else {
                    $skipped++;
                }
            } catch (\Exception $e) {
                $skipped++;
            }
        }

        $message = sprintf(
            'Updated tracking phase to "%s" for %d batch(es) (%d boxes total).',
            str_replace('_', ' ', (string) $validated['tracking_phase']),
            $updatedBatches,
            $totalBoxesUpdated,
        );
        if ($skipped > 0) {
            $message .= " {$skipped} batch(es) skipped.";
        }

        $returnUrl = request()->input('return_to') ?? session('admin_return_url') ?? route('admin.batches.index');
        return redirect($returnUrl)->with('success', $message);
    }

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'ids.*' => 'exists:batches,id',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string|max:255',
            'status_filter' => 'nullable|string|in:all,open,loading,ready_to_close,sailed,arrived,delivered',
        ]);

        $batches = $this->bulkBatchSelection($request, $validated);
        $deleted = 0;
        $skipped = 0;

        foreach ($batches as $batch) {
            if (! $batch->boxes()->exists()) {
                $batch->delete();
                $deleted++;
            } else {
                $skipped++;
            }
        }

        $result = [
            'requested' => $batches->count(),
            'deleted' => $deleted,
            'skipped' => $skipped,
            'reasons' => $skipped > 0 ? ['assigned_boxes' => $skipped] : [],
        ];
        $message = "{$deleted} batches deleted (only empty batches can be deleted).";
        if ($skipped > 0) {
            $message .= " {$skipped} batches skipped because they have assigned boxes.";
        }

        $returnUrl = request()->input('return_to') ?? session('admin_return_url') ?? route('admin.batches.index');
        return redirect($returnUrl)->with('success', $message)->with('bulk_result', $result);
    }

    private function bulkBatchSelection(Request $request, array $validated)
    {
        if (! $request->boolean('select_all')) {
            return Batch::whereIn('id', $validated['ids'] ?? [])->get();
        }

        return Batch::query()
            ->when($request->filled('search'), function ($query) use ($request) {
                $search = $request->string('search')->toString();
                $query->where(function ($searchQuery) use ($search) {
                    $searchQuery->where('batch_number', 'like', "%{$search}%")
                        ->orWhere('voyage_number', 'like', "%{$search}%")
                        ->orWhere('container_number', 'like', "%{$search}%");
                });
            })
            ->when($request->filled('status_filter') && $request->status_filter !== 'all', function ($query) use ($request) {
                $query->where('status', $request->status_filter);
            })
            ->get();
    }

    public function destroy(Batch $batch): RedirectResponse
    {
        if ($batch->boxes()->exists()) {
            return back()->withErrors(['batch' => 'Cannot delete a batch that already has assigned boxes.']);
        }

        $batch->delete();

        $returnUrl = request()->input('return_to') ?? session('admin_return_url') ?? route('admin.batches.index');
        return redirect($returnUrl)->with('success', 'Batch deleted successfully.');
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

        if (app(DeveloperAccess::class)->isDeveloperOrAdmin($user)) {
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
