<?php

namespace App\Http\Controllers;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Models\Batch;
use App\Models\Box;
use App\Models\DataIntegrityWarning;
use App\Repositories\Contracts\BoxRepositoryInterface;
use App\Services\BatchService;
use App\Services\RunsheetService;
use App\Services\TrackingStepService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class WarehouseController extends Controller
{
    public function __construct(
        private readonly BoxRepositoryInterface $boxRepo,
        private readonly BatchService $batchService,
        private readonly TrackingStepService $trackingStepService,
        private readonly RunsheetService $runsheetService,
    ) {}

    public function dashboard(Request $request)
    {
        $filters = $request->validate([
            'warehouse_location' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', 'max:50'],
            'batch_assignment' => ['nullable', 'in:all,batched,unbatched'],
            'aging_bucket' => ['nullable', 'in:all,under_24,24_48,48_plus,critical'],
        ]);

        // Active container batches for loading
        $activeBatches = Batch::whereIn('status', [BatchStatus::Open, BatchStatus::Loading])
            ->orderBy('created_at', 'desc')
            ->get(['id', 'batch_number', 'status', 'current_box_count', 'capacity_boxes', 'current_cbm', 'capacity_cbm']);

// 1. Origin Phase: Boxes collected by pickers but not yet received at warehouse
        $pendingReceiptQuery = Box::where('status', BoxStatus::Collected->value);
        if ($filters['warehouse_location'] ?? null) {
            $pendingReceiptQuery->where('warehouse_location', 'like', '%'.$filters['warehouse_location'].'%');
        }
        $pendingReceiptCount = $pendingReceiptQuery->count();

        // 2. Destination Phase: Boxes that have arrived at port/warehouse and need sorting
        $needsSortingQuery = Box::where('status', BoxStatus::Arrived->value)
            ->whereHas('batch', fn ($q) => $q->where('status', BatchStatus::Arrived->value));
        if ($filters['warehouse_location'] ?? null) {
            $needsSortingQuery->where('warehouse_location', 'like', '%'.$filters['warehouse_location'].'%');
        }
        $needsSortingCount = $needsSortingQuery->count();

        // 3. Ready to Load:
        // - At Origin: ReceivedByWarehouse & No Batch (awaiting container loading)
        $readyToLoadQuery = Box::with([
            'booking:id,reference_number,declaration_form_status,payment_status',
            'boxType:id,name',
            'recipient:id,city,province',
            'updates' => fn ($query) => $query->latest(),
        ])
            ->where('status', BoxStatus::ReceivedByWarehouse->value)
            ->whereNull('batch_id')
            ->when($filters['warehouse_location'] ?? null, function ($query, $location) {
                $query->where('warehouse_location', 'like', "%{$location}%");
            })
            ->when($filters['status'] ?? null, function ($query, $status) {
                $query->where('status', $status);
            })
            ->when(($filters['batch_assignment'] ?? 'all') !== 'all', function ($query) use ($filters) {
                if (($filters['batch_assignment'] ?? null) === 'batched') {
                    $query->whereNotNull('batch_id');

                    return;
                }

                $query->whereNull('batch_id');
            });

        $readyToLoad = $readyToLoadQuery
            ->orderBy('updated_at')
            ->get()
            ->map(function (Box $box) {
                // Determine the logical "Next Step" for the user
                $nextStep = match ($box->status) {
                    BoxStatus::ReceivedByWarehouse => 'Load into International Container',
                    BoxStatus::Arrived => 'Sort into Domestic Batch (Luzon/Visayas/Mindanao)',
                    default => 'Scan for Update',
                };

                // Get other boxes in the same booking that are NOT yet at the warehouse/port
                $missingSiblingBoxes = Box::where('booking_id', $box->booking_id)
                    ->where('id', '!=', $box->id)
                    ->whereNotIn('status', [
                        BoxStatus::ReceivedByWarehouse->value,
                        BoxStatus::LoadedToContainer->value,
                        BoxStatus::InTransit->value,
                        BoxStatus::Arrived->value,
                        BoxStatus::Delivered->value,
                        BoxStatus::Cancelled->value,
                    ])
                    ->get(['id', 'tracking_number', 'status']);

                $lastWarehouseEventAt = $box->updates->first()?->created_at ?? $box->updated_at ?? $box->created_at;
                $ageHours = $lastWarehouseEventAt ? (int) $lastWarehouseEventAt->diffInHours(now()) : 0;
                $agingBucket = $this->resolveAgingBucket($ageHours);

                return array_merge($box->toArray(), [
                    'next_step' => $nextStep,
                    'missing_siblings' => $missingSiblingBoxes->count(),
                    'missing_sibling_boxes' => $missingSiblingBoxes->map(fn (Box $sibling) => [
                        'id' => $sibling->id,
                        'tracking_number' => $sibling->tracking_number,
                        'status' => $sibling->status instanceof BoxStatus ? $sibling->status->value : (string) $sibling->status,
                    ])->values(),
                    'is_domestic' => $box->status === BoxStatus::Arrived,
                    'last_warehouse_event_at' => $lastWarehouseEventAt?->toISOString(),
                    'age_hours' => $ageHours,
                    'aging_bucket' => $agingBucket,
                    'aging_label' => $this->agingLabel($agingBucket),
                ]);
            })
            ->when(($filters['aging_bucket'] ?? 'all') !== 'all', fn ($collection) => $collection
                ->where('aging_bucket', $filters['aging_bucket'])
                ->values());

        $agingStats = [
            'under_24' => $readyToLoad->where('aging_bucket', 'under_24')->count(),
            '24_48' => $readyToLoad->where('aging_bucket', '24_48')->count(),
            '48_plus' => $readyToLoad->where('aging_bucket', '48_plus')->count(),
            'critical' => $readyToLoad->where('aging_bucket', 'critical')->count(),
        ];

        // Fetch allowed tracking steps for warehouse
        $allSteps = $this->trackingStepService->getSteps();
        $warehouseSteps = array_values(array_filter($allSteps, function ($step) {
            return in_array('warehouse', $step['allowed_roles'] ?? []);
        }));

        $receiveSteps = array_values(array_filter($warehouseSteps, fn ($step) => $step['key'] !== 'loading_container'));
        $loadSteps = array_values(array_filter($warehouseSteps, fn ($step) => $step['key'] === 'loading_container'));

        $exceptionBoxes = Box::with([
            'booking:id,reference_number',
            'recipient:id,city,province',
            'updates' => fn ($query) => $query->latest(),
        ])
            ->whereIn('status', [BoxStatus::Damaged->value, BoxStatus::Held->value])
            ->orderBy('updated_at', 'desc')
            ->get();

        return Inertia::render('warehouse/Dashboard', [
            'activeBatches' => $activeBatches,
            'readyToLoad' => $readyToLoad,
            'exceptionBoxes' => $exceptionBoxes,
            'stats' => [
                'pendingReceipt' => $pendingReceiptCount,
                'needsSorting' => $needsSortingCount,
                'readyToLoadCount' => $readyToLoad->count(),
                'aging' => $agingStats,
            ],
            'filters' => [
                'warehouse_location' => $filters['warehouse_location'] ?? '',
                'status' => $filters['status'] ?? '',
                'batch_assignment' => $filters['batch_assignment'] ?? 'all',
                'aging_bucket' => $filters['aging_bucket'] ?? 'all',
            ],
            'receiveSteps' => $receiveSteps,
            'loadSteps' => $loadSteps,
        ]);
    }

    /**
     * Handoff from Picker to Warehouse.
     */
    public function receiveBox(Request $request)
    {
        $request->validate([
            'tracking_number' => 'required|string',
            'warehouse_location' => 'nullable|string|max:50',
            'force_receive' => 'nullable|boolean',
        ]);

        $box = $this->boxRepo->findByIdentifier($request->tracking_number);

        if (! $box) {
            throw ValidationException::withMessages([
                'tracking_number' => 'Box not found.',
            ]);
        }

        $trackingStepKey = $request->input('tracking_step_key', 'received_by_branch');
        $allSteps = $this->trackingStepService->getSteps();
        $stepConfig = collect($allSteps)->firstWhere('key', $trackingStepKey);

        // Determine allowed source statuses based on the tracking step's phase.
        // Destination-phase steps (sorting, dispatching, etc.) operate on boxes that
        // have already arrived or are in transit within the destination country.
        $stepPhase = $stepConfig['phase'] ?? 'Origin';
        $isDestinationStep = in_array($stepPhase, ['Destination', 'International Transit']);

        $allowedStatuses = $isDestinationStep
            ? [BoxStatus::Arrived, BoxStatus::InTransit, BoxStatus::ReceivedByWarehouse]
            : [BoxStatus::Collected, BoxStatus::Pending];

if (! in_array($box->status, $allowedStatuses)) {
            $phaseHint = $isDestinationStep ? 'destination processing' : 'warehouse receipt';
            throw ValidationException::withMessages([
                'tracking_number' => "Cannot {$phaseHint} box with current status: {$box->status->value}",
            ]);
        }

        if (! $stepConfig || ! in_array('warehouse', $stepConfig['allowed_roles'] ?? [])) {
            throw ValidationException::withMessages([
                'tracking_step_key' => "Invalid or unauthorized tracking step: {$trackingStepKey}",
            ]);
        }

        if ($trackingStepKey === 'loading_container') {
            throw ValidationException::withMessages([
                'tracking_step_key' => "Cannot use a loading step for receive action.",
            ]);
        }

        // For origin-phase receipts, validate payment is confirmed
        // (Destination-phase steps like sorting don't require payment validation)
        $forceOverride = $request->boolean('force_receive');

        if (! $isDestinationStep && $box->booking->payment_status !== PaymentStatus::Paid) {
            if (!$forceOverride) {
                $hasProof = !empty($box->booking->proof_of_payment);
                return back()->with('payment_override', [
                    'tracking_number' => $box->tracking_number,
                    'message' => $hasProof 
                        ? 'This booking has a proof of payment uploaded but is not yet confirmed by an admin. You can override to receive this box, or contact admin.'
                        : 'Payment for this booking is not confirmed yet. You can override to receive this box, or contact admin.',
                ]);
            }
        }

        $systemStatus = $stepConfig['system_status'] ?? BoxStatus::ReceivedByWarehouse->value;
        $trackingLabel = $stepConfig['label'] ?? 'Received at Warehouse';

        $description = $trackingStepKey === 'received_by_branch'
            ? $trackingLabel.' from picker.'
            : $trackingLabel;

        try {
            DB::transaction(function () use ($box, $request, $systemStatus, $description, $trackingStepKey, $forceOverride, $isDestinationStep) {
                // Record the payment override on the booking
                if ($forceOverride && ! $isDestinationStep && $box->booking->payment_status !== PaymentStatus::Paid) {
                    $box->booking->update([
                        'payment_overridden_at' => now(),
                        'payment_overridden_by' => Auth::id(),
                    ]);
                }

                if ($request->warehouse_location) {
                    $box->update(['warehouse_location' => $request->warehouse_location]);
                }

                $this->boxRepo->updateStatus(
                    $box,
                    $systemStatus,
                    $description,
                    Auth::id(),
                    null,
                    null,
                    $trackingStepKey
                );
            });

            // Auto-sync related runsheets (e.g. completing pickup runsheet if all boxes received)
            $box->refresh();
            $this->runsheetService->syncRelatedRunsheets($box);

            return back()->with('success', "Box {$box->tracking_number} processed.");
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to receive box: '.$e->getMessage());
        }
    }

    /**
     * Load Box into Container Batch.
     */
    public function loadBox(Request $request)
    {
        $request->validate([
            'tracking_number' => 'required|string',
            'batch_id' => 'required|exists:batches,id',
        ]);

        $box = $this->boxRepo->findByIdentifier($request->tracking_number);

        if (! $box) {
            throw ValidationException::withMessages([
                'tracking_number' => 'Box not found.',
            ]);
        }

        if ($box->batch_id !== null && $box->batch_id != $request->batch_id) {
            $existingBatch = Batch::find($box->batch_id);
            $targetBatch = Batch::find($request->batch_id);

            DataIntegrityWarning::updateOrCreate(
                [
                    'type' => 'duplicate_batch_scan',
                    'record_type' => Box::class,
                    'record_id' => $box->id,
                    'is_resolved' => false,
                ],
                [
                    'severity' => 'error',
                    'message' => "Duplicate batch scan attempt: Box {$box->tracking_number} is already assigned to Batch " . ($existingBatch?->batch_number ?? $box->batch_id) . ". Scanned for Batch " . ($targetBatch?->batch_number ?? $request->batch_id) . ".",
                    'metadata' => [
                        'tracking_number' => $box->tracking_number,
                        'existing_batch_id' => $box->batch_id,
                        'existing_batch_number' => $existingBatch?->batch_number,
                        'target_batch_id' => $request->batch_id,
                        'target_batch_number' => $targetBatch?->batch_number,
                        'scanned_by' => Auth::id(),
                        'alert' => true,
                    ],
                ]
            );

            throw ValidationException::withMessages([
                'tracking_number' => "DUPLICATE SCAN ALERT: Box {$box->tracking_number} is already registered in Batch " . ($existingBatch?->batch_number ?? $box->batch_id) . ".",
            ]);
        }

        if ($box->status !== BoxStatus::ReceivedByWarehouse) {
            throw ValidationException::withMessages([
                'tracking_number' => "Box is not eligible to be loaded into a container. Current status is '{$box->status->label()}' ({$box->status->value}), but box must be in 'Received by Warehouse' status.",
            ]);
        }

        if ($box->booking->status === BookingStatus::Cancelled) {
            throw ValidationException::withMessages([
                'tracking_number' => 'Cannot load a box for a cancelled booking.',
            ]);
        }

        if ($box->booking->payment_status !== PaymentStatus::Paid) {
            throw ValidationException::withMessages([
                'tracking_number' => 'Payment not confirmed. Cannot load unpaid box to container.',
            ]);
        }

        if ($box->booking->needsDeclaration()) {
            throw ValidationException::withMessages([
                'tracking_number' => 'Customs declaration is missing. Cannot load box to container.',
            ]);
        }

        $invoice = $box->booking->invoice;
        if (! $invoice || $invoice->status === InvoiceStatus::Voided) {
            throw ValidationException::withMessages([
                'tracking_number' => 'No valid invoice found for this booking. Generate an invoice before loading to container.',
            ]);
        }

        if (! $box->recipient_id) {
            throw ValidationException::withMessages([
                'tracking_number' => 'No recipient assigned to this box. Cannot load to container.',
            ]);
        }

        $recipient = $box->recipient;
        if (! $recipient->city || ! $recipient->province) {
            throw ValidationException::withMessages([
                'tracking_number' => 'Recipient address is incomplete (missing city or province).',
            ]);
        }

        if (! $recipient->phone_number) {
            throw ValidationException::withMessages([
                'tracking_number' => 'Recipient phone number is missing.',
            ]);
        }
        
        if ($box->price_charged === null || (float) $box->price_charged <= 0) {
            throw ValidationException::withMessages([
                'tracking_number' => 'Box price is not set or zero.',
            ]);
        }

        if ($recipient->sender_id !== $box->booking->sender_id) {
            throw ValidationException::withMessages([
                'tracking_number' => 'Recipient does not belong to the booking sender.',
            ]);
        }



        $trackingStepKey = $request->input('tracking_step_key', 'loading_container');
        $allSteps = $this->trackingStepService->getSteps();
        $stepConfig = collect($allSteps)->firstWhere('key', $trackingStepKey);

        if (! $stepConfig || ! in_array('warehouse', $stepConfig['allowed_roles'] ?? [])) {
            throw ValidationException::withMessages([
                'tracking_step_key' => "Invalid or unauthorized tracking step: {$trackingStepKey}",
            ]);
        }

        if ($trackingStepKey !== 'loading_container') {
            throw ValidationException::withMessages([
                'tracking_step_key' => "Cannot use a receive step for load action.",
            ]);
        }

        $systemStatus = $stepConfig['system_status'] ?? $box->status->value;
        $trackingLabel = $stepConfig['label'] ?? 'Loaded to Container';
        $targetStatus = BoxStatus::tryFrom($systemStatus);

        if ($targetStatus && $box->status !== $targetStatus && ! $box->status->canTransitionTo($targetStatus)) {
            throw ValidationException::withMessages([
                'tracking_number' => "Cannot transition box status from '{$box->status->label()}' to '{$targetStatus->label()}'. The box is not eligible for this operation.",
            ]);
        }

        try {
            DB::transaction(function () use ($box, $request, $systemStatus, $trackingLabel, $trackingStepKey) {
                // Lock the batch inside the transaction to prevent race conditions
                $batch = Batch::query()
                    ->whereIn('status', [BatchStatus::Open->value, BatchStatus::Loading->value])
                    ->whereKey($request->batch_id)
                    ->lockForUpdate()
                    ->firstOrFail();

                // Capacity check with fresh locked data
                $capacityError = $this->batchService->checkCapacity($batch, 1);
                if ($capacityError) {
                    throw ValidationException::withMessages([
                        'batch_id' => $capacityError,
                    ]);
                }

                $this->boxRepo->updateStatus(
                    $box,
                    $systemStatus,
                    $trackingLabel.": {$batch->batch_number}",
                    Auth::id(),
                    null,
                    null,
                    $trackingStepKey
                );

                $oldBatchId = $box->batch_id;
                $box->update(['batch_id' => $batch->id]);

                // If moving from another batch, refresh the old one
                if ($oldBatchId && $oldBatchId !== $batch->id) {
                    $this->batchService->refreshAndEvaluateById($oldBatchId);
                }

                // Refresh batch metrics inside the transaction
                $this->batchService->refreshAndEvaluateById($batch->id);

                // Auto-transition batch to Loading if it was Open
                if ($batch->fresh()->status === BatchStatus::Open) {
                    $batch->update(['status' => BatchStatus::Loading]);
                }
            });

            $batch = Batch::find($request->batch_id);

            return back()->with('success', "Box {$box->tracking_number} loaded into batch {$batch->batch_number}.");
        } catch (\Exception $e) {
            if ($e instanceof ValidationException) {
                throw $e;
            }

            return back()->with('error', 'Failed to load box: '.$e->getMessage());
        }
    }

    /**
     * Remove Box from Batch.
     */
    public function unloadBox(Request $request)
    {
        $request->validate([
            'tracking_number' => 'required|string',
        ]);

        $box = $this->boxRepo->findByIdentifier($request->tracking_number);

        if (! $box || ! $box->batch_id) {
            return back()->with('error', 'Box not found or not in a batch.');
        }

        $batchId = $box->batch_id;

        try {
            DB::transaction(function () use ($box) {
                $oldBatchNumber = $box->batch?->batch_number;

                $box->update(['batch_id' => null]);

                $this->boxRepo->updateStatus(
                    $box,
                    BoxStatus::ReceivedByWarehouse->value,
                    "Unloaded from batch: {$oldBatchNumber}",
                    Auth::id(),
                    null,
                    null,
                    'received_by_branch'
                );
            });

$this->batchService->refreshAndEvaluateById($batchId);

            return back()->with('success', "Box {$box->tracking_number} unloaded from batch.");
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to unload box: '.$e->getMessage());
        }
    }

    /**
     * Mark box as damaged.
     */
    public function markDamaged(Request $request)
    {
        $request->validate([
            'tracking_number' => 'required|string',
            'notes' => 'required|string',
        ]);

        $box = $this->boxRepo->findByIdentifier($request->tracking_number);

        if (! $box) {
            return back()->with('error', 'Box not found.');
        }

        // Validate box status allows transition to Damaged
        if (! $box->status->canTransitionTo(BoxStatus::Damaged)) {
            return back()->with('error', "Cannot mark box as damaged. Current status: {$box->status->value} does not allow transition to damaged.");
        }

        try {
            $this->boxRepo->updateStatus(
                $box,
                BoxStatus::Damaged->value,
                "DAMAGED: {$request->notes}",
                Auth::id(),
            );

            return back()->with('success', "Box {$box->tracking_number} marked as DAMAGED.");
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to mark box as damaged: '.$e->getMessage());
        }
    }

    /**
     * Flag box for holding (Consolidation/Payment).
     */
    public function markHeld(Request $request)
    {
        $request->validate([
            'tracking_number' => 'required|string',
            'notes' => 'required|string',
        ]);

        $box = $this->boxRepo->findByIdentifier($request->tracking_number);

        if (! $box) {
            return back()->with('error', 'Box not found.');
        }

        // Validate box status allows transition to Held
        if (! $box->status->canTransitionTo(BoxStatus::Held)) {
            return back()->with('error', "Cannot hold box. Current status: {$box->status->value} does not allow transition to held.");
        }

        try {
            $this->boxRepo->updateStatus(
                $box,
                BoxStatus::Held->value,
                "HELD: {$request->notes}",
                Auth::id(),
            );

            return back()->with('success', "Box {$box->tracking_number} is now on HOLD.");
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to hold box: '.$e->getMessage());
        }
    }

    /**
     * Update weight, CBM, or location.
     */
    public function updatePhysicals(Request $request)
    {
        $request->validate([
            'tracking_number' => 'required|string',
            'weight' => 'nullable|numeric|min:0',
            'actual_cbm' => 'nullable|numeric|min:0',
            'warehouse_location' => 'nullable|string|max:50',
        ]);

        $box = $this->boxRepo->findByIdentifier($request->tracking_number);

        if (! $box) {
            return back()->with('error', 'Box not found.');
        }
        
        $box->loadMissing('boxType', 'booking.invoice');

        try {
            $oldBatchId = $box->batch_id;

            $updateData = $request->only(['weight', 'actual_cbm', 'warehouse_location']);

            if ($request->filled('actual_cbm')) {
                $standardCbm = $box->boxType?->getStandardCbm();
                if ($standardCbm) {
                    $tolerance = 1.05; // 5% tolerance
                    if ($request->actual_cbm > ($standardCbm * $tolerance)) {
                        $updateData['is_bulging'] = true;
                        $updateData['oversized_surcharge'] = ($request->actual_cbm - $standardCbm) * 5000;

                        // Transition status to HeldBulging if it allows
                        if ($box->status->canTransitionTo(BoxStatus::HeldBulging)) {
                            $this->boxRepo->updateStatus(
                                $box,
                                BoxStatus::HeldBulging->value,
                                "HELD (BULGING): Actual CBM ({$request->actual_cbm}) exceeds standard ({$standardCbm}).",
                                Auth::id(),
                            );
                        }
                    } else {
                        $updateData['is_bulging'] = false;
                        $updateData['oversized_surcharge'] = 0.00;
                    }
                }
            }

            $box->update($updateData);

            if ($oldBatchId) {
                $this->batchService->refreshAndEvaluateById($oldBatchId);
            }

            if ($box->wasChanged('oversized_surcharge') && $box->booking->invoice) {
                $box->booking->invoice->recalculateAmount();
            }

            return back()->with('success', "Physical measurements updated for {$box->tracking_number}.");
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to update physicals: '.$e->getMessage());
        }
    }

    private function resolveAgingBucket(int $ageHours): string
    {
        return match (true) {
            $ageHours < 24 => 'under_24',
            $ageHours < 48 => '24_48',
            $ageHours < 72 => '48_plus',
            default => 'critical',
        };
    }

    private function agingLabel(string $bucket): string
    {
        return match ($bucket) {
            'under_24' => 'Under 24h',
            '24_48' => '24-48h',
            '48_plus' => '48h+',
            'critical' => 'Critical 72h+',
            default => 'Unknown',
        };
    }

    public function apiBatchDetails(Batch $batch)
    {
        $batch->load([
            'boxes' => function ($query) {
                $query->with([
                    'booking:id,reference_number',
                    'recipient:id,city,province',
                    'boxType:id,name',
                ]);
            }
        ]);

        return response()->json($batch);
    }
}
