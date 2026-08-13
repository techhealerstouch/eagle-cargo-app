<?php

namespace App\Services;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Enums\TrackingPhase;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxUpdate;
use App\Models\DataIntegrityWarning;
use App\Models\Invoice;
use App\Models\Runsheet;
use Carbon\CarbonInterface;

class DataIntegrityService
{
    private const DELAYED_RECEIPT_HOURS = 24;

    private const MISSED_PICKUP_HOURS = 24;

    private const OVERDUE_LOADING_HOURS = 24;

    private const ARRIVED_SORTING_HOURS = 48;

    private const DELIVERY_OVERDUE_HOURS = 12;

    private const MISSED_ETA_HOURS = 24;

    private const STALE_SCAN_HOURS = 72;

    private const OPERATIONS_WARNING_TYPES = [
        'stale_scan',
        'missed_pickup',
        'partial_pickup',
        'delayed_receipt',
        'missing_warehouse_location',
        'overdue_loading',
        'batch_capacity_overrun',
        'batch_status_blocked',
        'missed_eta',
        'held_box',
        'damaged_box',
        'unpaid_loading_block',
        'delivery_overdue',
        'partial_delivery',
        'delivery_proof_missing',
        'paid_no_payment_record',
        'payment_balance_mismatch',
        'delivered_no_invoice',
        'paid_no_invoice',
        'booking_status_mismatch',
        'duplicate_batch_scan',
    ];

    /**
     * Run all integrity checks and persist warnings.
     */
    public function performAudit(): array
    {
        $results = [
            'missing_declarations' => $this->checkMissingDeclarations(),
            'orphan_boxes' => $this->checkOrphanBoxes(),
            'box_count_mismatches' => $this->checkBoxCountMismatches(),
            'stale_scan' => $this->checkStaleScans(),
            'missed_pickup' => $this->checkMissedPickups(),
            'partial_pickup' => $this->checkPartialPickups(),
            'delayed_receipt' => $this->checkDelayedReceipts(),
            'missing_warehouse_location' => $this->checkMissingWarehouseLocations(),
            'overdue_loading' => $this->checkOverdueLoading(),
            'batch_capacity_overrun' => $this->checkBatchCapacityOverruns(),
            'batch_status_blocked' => $this->checkBatchStatusBlocks(),
            'missed_eta' => $this->checkMissedEta(),
            'held_box' => $this->checkHeldBoxes(),
            'damaged_box' => $this->checkDamagedBoxes(),
            'unpaid_loading_block' => $this->checkUnpaidLoadingBlocks(),
            'delivery_overdue' => $this->checkDeliveryOverdue(),
            'partial_delivery' => $this->checkPartialDeliveries(),
            'delivery_proof_missing' => $this->checkDeliveryProofMissing(),
            'paid_no_payment_record' => $this->checkPaidBookingsWithoutPaymentRecords(),
            'payment_balance_mismatch' => $this->checkPaymentBalanceMismatches(),
            'delivered_no_invoice' => $this->checkDeliveredBookingsWithoutInvoice(),
            'paid_no_invoice' => $this->checkPaidBookingsWithoutInvoice(),
            'booking_status_mismatch' => $this->checkBookingStatusMismatches(),
        ];

        return $results;
    }

    /**
     * Check for Confirmed/Collected bookings with missing declarations.
     */
    public function checkMissingDeclarations(): int
    {
        $bookings = Booking::whereIn('status', [BookingStatus::Confirmed->value, BookingStatus::Collected->value])
            ->where('declaration_form_status', 'missing')
            ->get();

        foreach ($bookings as $booking) {
            DataIntegrityWarning::updateOrCreate(
                [
                    'type' => 'missing_declaration',
                    'record_type' => Booking::class,
                    'record_id' => $booking->id,
                    'is_resolved' => false,
                ],
                [
                    'severity' => 'high',
                    'message' => "Booking {$booking->reference_number} is confirmed but missing customs declaration.",
                    'metadata' => [
                        'status' => $booking->status->value,
                        'sender' => $booking->sender?->full_name,
                        'recommended_action' => 'Go to the customs declaration page to complete, verify, or upload the required declaration form.',
                        'severity_reason' => 'Confirmed or collected bookings require a completed customs declaration before loading.',
                        'target_url' => route('admin.bookings.show', $booking, false),
                        'resolve_url' => route('admin.bookings.declaration.view', $booking, false),
                    ],
                ]
            );
        }

        return $bookings->count();
    }

    /**
     * Check for boxes received at warehouse but not assigned to a batch.
     */
    public function checkOrphanBoxes(): int
    {
        // Boxes received more than 24 hours ago but not in a batch
        $boxes = Box::where('status', BoxStatus::ReceivedByWarehouse->value)
            ->whereNull('batch_id')
            ->where('updated_at', '<=', now()->subHours(24))
            ->get();

        foreach ($boxes as $box) {
            DataIntegrityWarning::updateOrCreate(
                [
                    'type' => 'orphan_box',
                    'record_type' => Box::class,
                    'record_id' => $box->id,
                    'is_resolved' => false,
                ],
                [
                    'severity' => 'medium',
                    'message' => "Box {$box->tracking_number} received at warehouse 24h+ ago but not assigned to a batch.",
                    'metadata' => [
                        'received_at' => $box->updated_at->toDateTimeString(),
                        'recommended_action' => 'Assign this box to an open container batch to schedule its shipment.',
                        'severity_reason' => 'Boxes received at the warehouse should be batched within 24 hours to prevent shipment delays.',
                        'target_url' => route('admin.boxes.show', $box, false),
                        'resolve_url' => route('admin.boxes.edit', $box, false),
                    ],
                ]
            );
        }

        return $boxes->count();
    }

    /**
     * Check for bookings where relation count doesn't match expected count (if applicable).
     * Note: This assumes we have a way to know the expected count.
     * For now, let's check for bookings with NO boxes (unless they are drafts).
     */
    public function checkBoxCountMismatches(): int
    {
        $bookings = Booking::where('status', '!=', BookingStatus::Draft->value)
            ->where('status', '!=', BookingStatus::Cancelled->value)
            ->doesntHave('boxes')
            ->get();

        foreach ($bookings as $booking) {
            DataIntegrityWarning::updateOrCreate(
                [
                    'type' => 'box_count_mismatch',
                    'record_type' => Booking::class,
                    'record_id' => $booking->id,
                    'is_resolved' => false,
                ],
                [
                    'severity' => 'high',
                    'message' => "Booking {$booking->reference_number} has no boxes assigned.",
                    'metadata' => [
                        'status' => $booking->status->value,
                        'recommended_action' => 'Assign boxes to this booking or update/cancel the booking status if it was confirmed by mistake.',
                        'severity_reason' => 'Confirmed bookings should contain at least one box to be processed.',
                        'target_url' => route('admin.bookings.show', $booking, false),
                        'resolve_url' => route('admin.bookings.edit', $booking, false),
                    ],
                ]
            );
        }

        return $bookings->count();
    }

    public function checkStaleScans(): int
    {
        $boxes = Box::with(['booking', 'updates' => fn ($query) => $query->latest()])
            ->whereIn('status', [
                BoxStatus::Collected->value,
                BoxStatus::ReceivedByWarehouse->value,
                BoxStatus::LoadedToContainer->value,
                BoxStatus::InTransit->value,
                BoxStatus::Arrived->value,
                BoxStatus::OutForDelivery->value,
            ])
            ->where(function ($query) {
                $query->whereHas('updates', function ($updates) {
                    $updates->where('created_at', '<=', now()->subHours($this->slaHours('arrived_sorting')));
                })->orWhere(function ($noUpdates) {
                    $noUpdates->doesntHave('updates')
                        ->where('updated_at', '<=', now()->subHours($this->slaHours('arrived_sorting')));
                });
            })
            ->get()
            ->filter(fn (Box $box) => $this->lastScanAt($box)?->lessThanOrEqualTo(now()->subHours($this->staleThresholdHoursFor($box))));

        /** @var Box $box */
        foreach ($boxes as $box) {
            $thresholdHours = $this->staleThresholdHoursFor($box);

            $this->upsertBoxWarning(
                type: 'stale_scan',
                box: $box,
                severity: 'medium',
                message: "Box {$box->tracking_number} has not received a scan update in {$thresholdHours}+ hours.",
                recommendedAction: 'Review the latest operational handoff and scan the box at its current location.',
                severityReason: 'No recent scan event for an active box.',
                resolveUrl: route('admin.boxes.edit', $box, false),
            );
        }

        return $boxes->count();
    }

    public function checkMissedPickups(): int
    {
        $thresholdHours = $this->slaHours('missed_pickup');

        $runsheets = Runsheet::with(['picker', 'bookings.boxes'])
            ->where('type', RunsheetType::Pickup->value)
            ->whereIn('status', RunsheetStatus::activeValues())
            ->where('scheduled_date', '<=', now()->subHours($thresholdHours))
            ->whereHas('bookings.boxes', fn ($query) => $query->where('status', BoxStatus::Pending->value))
            ->get();

        foreach ($runsheets as $runsheet) {
            $pendingBoxes = $runsheet->bookings
                ->flatMap(fn (Booking $booking) => $booking->boxes)
                ->filter(fn (Box $box) => $box->status === BoxStatus::Pending);

            $this->upsertRecordWarning(
                type: 'missed_pickup',
                record: $runsheet,
                severity: 'high',
                message: "Pickup runsheet #{$runsheet->id} has {$pendingBoxes->count()} pending box(es) {$thresholdHours}+ hours after schedule.",
                metadata: [
                    'runsheet_id' => $runsheet->id,
                    'picker' => $runsheet->picker?->name,
                    'scheduled_date' => $runsheet->scheduled_date?->toDateTimeString(),
                    'pending_boxes' => $pendingBoxes->pluck('tracking_number')->values()->all(),
                    'age_hours' => $runsheet->scheduled_date ? (int) $runsheet->scheduled_date->diffInHours(now()) : null,
                    'recommended_action' => 'Contact the picker and sender, then reschedule, reassign, or cancel the unresolved pickup stop.',
                    'severity_reason' => 'Assigned pickup remained pending past the pickup SLA.',
                    'target_url' => route('admin.runsheets.show', $runsheet, false),
                    'resolve_url' => route('admin.runsheets.edit', $runsheet, false),
                ],
            );
        }

        return $runsheets->count();
    }

    public function checkPartialPickups(): int
    {
        $bookings = Booking::with(['boxes', 'runsheets'])
            ->whereHas('runsheets', function ($query) {
                $query->where('type', RunsheetType::Pickup->value)
                    ->whereIn('status', RunsheetStatus::activeValues());
            })
            ->whereHas('boxes', fn ($query) => $query->where('status', BoxStatus::Pending->value))
            ->whereHas('boxes', fn ($query) => $query->where('status', '!=', BoxStatus::Pending->value))
            ->get();

        foreach ($bookings as $booking) {
            $pendingBoxes = $booking->boxes->filter(fn (Box $box) => $box->status === BoxStatus::Pending);
            $actedBoxes = $booking->boxes->reject(fn (Box $box) => $box->status === BoxStatus::Pending);

            $this->upsertRecordWarning(
                type: 'partial_pickup',
                record: $booking,
                severity: 'medium',
                message: "Booking {$booking->reference_number} has a partial pickup: {$actedBoxes->count()} acted, {$pendingBoxes->count()} pending.",
                metadata: [
                    'booking_reference' => $booking->reference_number,
                    'pending_boxes' => $pendingBoxes->pluck('tracking_number')->values()->all(),
                    'acted_boxes' => $actedBoxes->pluck('tracking_number')->values()->all(),
                    'recommended_action' => 'Confirm whether remaining boxes should be recollected, cancelled, or moved to a new pickup runsheet.',
                    'severity_reason' => 'Multi-box booking has mixed pickup states.',
                    'target_url' => route('admin.bookings.show', $booking, false),
                    'resolve_url' => route('admin.bookings.edit', $booking, false),
                ],
            );
        }

        return $bookings->count();
    }

    public function checkDelayedReceipts(): int
    {
        $boxes = Box::with(['booking', 'updates' => fn ($query) => $query->latest()])
            ->where('status', BoxStatus::Collected->value)
            ->get()
            ->filter(fn (Box $box) => $this->lastScanAt($box)?->lessThanOrEqualTo(now()->subHours($this->slaHours('delayed_receipt'))));

        foreach ($boxes as $box) {
            $thresholdHours = $this->slaHours('delayed_receipt');

            $this->upsertBoxWarning(
                type: 'delayed_receipt',
                box: $box,
                severity: 'high',
                message: "Box {$box->tracking_number} was collected but has not been received by warehouse after {$thresholdHours}+ hours.",
                recommendedAction: 'Contact the picker or receiving warehouse and confirm handoff.',
                severityReason: 'Collected boxes should reach warehouse within the SLA window.',
                resolveUrl: route('admin.boxes.edit', $box, false),
            );
        }

        return $boxes->count();
    }

    public function checkMissingWarehouseLocations(): int
    {
        $boxes = Box::with(['booking', 'updates' => fn ($query) => $query->latest()])
            ->where('status', BoxStatus::ReceivedByWarehouse->value)
            ->where(function ($query) {
                $query->whereNull('warehouse_location')
                    ->orWhere('warehouse_location', '');
            })
            ->get();

        foreach ($boxes as $box) {
            $this->upsertBoxWarning(
                type: 'missing_warehouse_location',
                box: $box,
                severity: 'medium',
                message: "Box {$box->tracking_number} is received by warehouse but has no shelf/bin location.",
                recommendedAction: 'Assign a warehouse location so staff can find and load the box quickly.',
                severityReason: 'Received boxes need a physical warehouse location.',
                resolveUrl: route('admin.boxes.edit', $box, false),
            );
        }

        return $boxes->count();
    }

    public function checkOverdueLoading(): int
    {
        $boxes = Box::with(['booking', 'updates' => fn ($query) => $query->latest()])
            ->where('status', BoxStatus::ReceivedByWarehouse->value)
            ->whereNull('batch_id')
            ->get()
            ->filter(fn (Box $box) => $this->lastScanAt($box)?->lessThanOrEqualTo(now()->subHours($this->slaHours('overdue_loading'))));

        foreach ($boxes as $box) {
            $thresholdHours = $this->slaHours('overdue_loading');

            $this->upsertBoxWarning(
                type: 'overdue_loading',
                box: $box,
                severity: 'medium',
                message: "Box {$box->tracking_number} has been at warehouse {$thresholdHours}+ hours without batch assignment.",
                recommendedAction: 'Assign the box to an open/loading batch or hold it with a clear reason.',
                severityReason: 'Warehouse dwell time exceeded loading SLA.',
                resolveUrl: route('admin.boxes.edit', $box, false),
            );
        }

        return $boxes->count();
    }

    public function checkBatchCapacityOverruns(): int
    {
        $batches = Batch::query()
            ->where(function ($query) {
                $query->where(function ($boxes) {
                    $boxes->whereNotNull('capacity_boxes')
                        ->whereColumn('current_box_count', '>', 'capacity_boxes');
                })->orWhere(function ($cbm) {
                    $cbm->whereNotNull('capacity_cbm')
                        ->whereColumn('current_cbm', '>', 'capacity_cbm');
                });
            })
            ->get();

        foreach ($batches as $batch) {
            $this->upsertRecordWarning(
                type: 'batch_capacity_overrun',
                record: $batch,
                severity: 'high',
                message: "Batch {$batch->batch_number} is over configured capacity.",
                metadata: [
                    'batch_number' => $batch->batch_number,
                    'box_count' => "{$batch->current_box_count}/{$batch->capacity_boxes}",
                    'cbm' => "{$batch->current_cbm}/{$batch->capacity_cbm}",
                    'recommended_action' => 'Remove boxes or increase/confirm capacity before closing or sailing this batch.',
                    'severity_reason' => 'Batch metrics exceed configured capacity limits.',
                    'target_url' => route('admin.batches.show', $batch, false),
                    'resolve_url' => route('admin.batches.edit', $batch, false),
                ],
            );
        }

        return $batches->count();
    }

    public function checkBatchStatusBlocks(): int
    {
        $batches = Batch::with(['boxes.booking'])
            ->whereIn('status', [
                BatchStatus::ReadyToClose->value,
                BatchStatus::Sailed->value,
                BatchStatus::Arrived->value,
            ])
            ->whereHas('boxes', function ($query) {
                $query->whereIn('status', [BoxStatus::Held->value, BoxStatus::Damaged->value])
                    ->orWhereHas('booking', fn ($booking) => $booking->whereNotIn('payment_status', [
                        PaymentStatus::Paid->value,
                        PaymentStatus::CashCollected->value,
                    ]));
            })
            ->get();

        foreach ($batches as $batch) {
            $blockedBoxes = $batch->boxes->filter(function (Box $box) {
                return in_array($box->status, [BoxStatus::Held, BoxStatus::Damaged], true)
                    || ! in_array($box->booking?->payment_status, [PaymentStatus::Paid, PaymentStatus::CashCollected], true);
            });

            $this->upsertRecordWarning(
                type: 'batch_status_blocked',
                record: $batch,
                severity: 'high',
                message: "Batch {$batch->batch_number} has held, damaged, or unpaid boxes while marked {$batch->status->label()}.",
                metadata: [
                    'batch_number' => $batch->batch_number,
                    'status' => $batch->status->value,
                    'blocked_boxes' => $blockedBoxes->pluck('tracking_number')->values()->all(),
                    'recommended_action' => 'Resolve held/damaged/payment blockers or remove affected boxes before continuing the batch lifecycle.',
                    'severity_reason' => 'Blocked boxes should not move through closed, sailed, or arrived batch stages.',
                    'target_url' => route('admin.batches.show', $batch, false),
                    'resolve_url' => route('admin.batches.edit', $batch, false),
                ],
            );
        }

        return $batches->count();
    }

    public function checkMissedEta(): int
    {
        $boxes = Box::with(['booking', 'batch', 'updates' => fn ($query) => $query->latest()])
            ->whereHas('batch', function ($query) {
                $query->whereNotNull('eta_at')
                    ->where('eta_at', '<=', now()->subHours($this->slaHours('missed_eta')))
                    ->where('status', '!=', BatchStatus::Delivered->value);
            })
            ->whereNotIn('status', [BoxStatus::Delivered->value, BoxStatus::Cancelled->value])
            ->get();

        foreach ($boxes as $box) {
            $thresholdHours = $this->slaHours('missed_eta');

            $this->upsertBoxWarning(
                type: 'missed_eta',
                box: $box,
                severity: 'high',
                message: "Box {$box->tracking_number} is in batch {$box->batch?->batch_number} with an ETA missed by {$thresholdHours}+ hours.",
                recommendedAction: 'Update the batch ETA or advance the shipment tracking phase with the latest carrier/customs status.',
                severityReason: 'Batch ETA has passed while the box remains undelivered.',
                resolveUrl: $box->batch ? route('admin.batches.edit', $box->batch, false) : null,
            );
        }

        return $boxes->count();
    }

    public function checkHeldBoxes(): int
    {
        $boxes = Box::with(['booking', 'updates' => fn ($query) => $query->latest()])
            ->where('status', BoxStatus::Held->value)
            ->get();

        foreach ($boxes as $box) {
            $this->upsertBoxWarning(
                type: 'held_box',
                box: $box,
                severity: 'medium',
                message: "Box {$box->tracking_number} is currently on hold.",
                recommendedAction: 'Review the hold reason, resolve the blocker, or update the customer-facing tracking note.',
                severityReason: 'Held boxes need active operational follow-up.',
                resolveUrl: route('admin.boxes.edit', $box, false),
            );
        }

        return $boxes->count();
    }

    public function checkDamagedBoxes(): int
    {
        $boxes = Box::with(['booking', 'updates' => fn ($query) => $query->latest()])
            ->where('status', BoxStatus::Damaged->value)
            ->get();

        foreach ($boxes as $box) {
            $this->upsertBoxWarning(
                type: 'damaged_box',
                box: $box,
                severity: 'high',
                message: "Box {$box->tracking_number} is marked as damaged.",
                recommendedAction: 'Inspect the box, document photos/notes, and contact the sender before continuing movement.',
                severityReason: 'Damaged boxes may require customer communication and special handling.',
                resolveUrl: route('admin.boxes.edit', $box, false),
            );
        }

        return $boxes->count();
    }

    public function checkUnpaidLoadingBlocks(): int
    {
        $boxes = Box::with(['booking', 'updates' => fn ($query) => $query->latest()])
            ->where('status', BoxStatus::ReceivedByWarehouse->value)
            ->whereNull('batch_id')
            ->whereHas('booking', fn ($query) => $query->whereNotIn('payment_status', [
                PaymentStatus::Paid->value,
                PaymentStatus::CashCollected->value,
            ]))
            ->get();

        foreach ($boxes as $box) {
            $this->upsertBoxWarning(
                type: 'unpaid_loading_block',
                box: $box,
                severity: 'medium',
                message: "Box {$box->tracking_number} is ready for loading but payment is not confirmed.",
                recommendedAction: 'Confirm payment or contact the sender before loading to a container.',
                severityReason: 'Warehouse loading is blocked by unpaid booking status.',
                resolveUrl: $box->booking ? route('admin.bookings.edit', $box->booking, false) : null,
            );
        }

        return $boxes->count();
    }

    public function checkDeliveryOverdue(): int
    {
        $updates = BoxUpdate::with(['box.booking', 'box.updates' => fn ($query) => $query->latest()])
            ->where('tracking_phase', TrackingPhase::OUT_FOR_DELIVERY->value)
            ->where('created_at', '<=', now()->subHours($this->slaHours('delivery_overdue')))
            ->whereHas('box', fn ($query) => $query->whereNotIn('status', [BoxStatus::Delivered->value, BoxStatus::Cancelled->value]))
            ->latest()
            ->get()
            ->unique('box_id');

        foreach ($updates as $update) {
            $box = $update->box;
            if (! $box) {
                continue;
            }

            $thresholdHours = $this->slaHours('delivery_overdue');

            $this->upsertBoxWarning(
                type: 'delivery_overdue',
                box: $box,
                severity: 'high',
                message: "Box {$box->tracking_number} has been out for delivery for {$thresholdHours}+ hours without delivery confirmation.",
                recommendedAction: 'Contact the courier and update the delivery result, hold reason, or failed-attempt note.',
                severityReason: 'Out-for-delivery boxes should be resolved within the delivery-day SLA.',
                resolveUrl: route('admin.boxes.edit', $box, false),
            );
        }

        return $updates->count();
    }

    public function checkPartialDeliveries(): int
    {
        $bookings = Booking::with('boxes')
            ->whereHas('boxes', fn ($query) => $query->where('status', BoxStatus::Delivered->value))
            ->whereHas('boxes', fn ($query) => $query->whereNotIn('status', [
                BoxStatus::Delivered->value,
                BoxStatus::Cancelled->value,
            ]))
            ->get();

        foreach ($bookings as $booking) {
            $deliveredBoxes = $booking->boxes->filter(fn (Box $box) => $box->status === BoxStatus::Delivered);
            $undeliveredBoxes = $booking->boxes->filter(fn (Box $box) => ! in_array($box->status, [BoxStatus::Delivered, BoxStatus::Cancelled], true));

            $this->upsertRecordWarning(
                type: 'partial_delivery',
                record: $booking,
                severity: 'medium',
                message: "Booking {$booking->reference_number} is partially delivered: {$deliveredBoxes->count()} delivered, {$undeliveredBoxes->count()} unresolved.",
                metadata: [
                    'booking_reference' => $booking->reference_number,
                    'delivered_boxes' => $deliveredBoxes->pluck('tracking_number')->values()->all(),
                    'undelivered_boxes' => $undeliveredBoxes->pluck('tracking_number')->values()->all(),
                    'recommended_action' => 'Confirm remaining boxes with the courier or schedule a follow-up delivery attempt.',
                    'severity_reason' => 'Multi-box booking has mixed delivery states.',
                    'target_url' => route('admin.bookings.show', $booking, false),
                    'resolve_url' => route('admin.bookings.edit', $booking, false),
                ],
            );
        }

        return $bookings->count();
    }

    public function checkDeliveryProofMissing(): int
    {
        $boxes = Box::with(['booking', 'updates' => fn ($query) => $query->latest()])
            ->where('status', BoxStatus::Delivered->value)
            ->where(function ($query) {
                $query->whereNull('delivery_proof_path')
                    ->orWhere('delivery_proof_path', '')
                    ->orWhereNull('signature_path')
                    ->orWhere('signature_path', '');
            })
            ->get();

        foreach ($boxes as $box) {
            $this->upsertBoxWarning(
                type: 'delivery_proof_missing',
                box: $box,
                severity: 'high',
                message: "Box {$box->tracking_number} is marked delivered but proof or signature is missing.",
                recommendedAction: 'Upload delivery proof/signature or review whether the delivered status should stand.',
                severityReason: 'Delivered boxes require proof of delivery.',
                resolveUrl: route('admin.boxes.edit', $box, false),
            );
        }

        return $boxes->count();
    }

    public function checkPaidBookingsWithoutPaymentRecords(): int
    {
        $bookings = Booking::with('invoice.payments')
            ->where('payment_status', PaymentStatus::Paid->value)
            ->whereHas('invoice')
            ->where(function ($query) {
                // No payments at all, OR only unsettled payments (e.g. failed Stripe attempts)
                $query->whereDoesntHave('invoice.payments')
                    ->orWhereDoesntHave('invoice.payments', function ($payments) {
                        $payments->where(function ($settled) {
                            $settled->where(function ($nonCash) {
                                $nonCash->where('is_cash_payment', false)
                                        ->orWhereNull('is_cash_payment');
                            })->whereNotNull('paid_at');
                        })->orWhere(function ($cash) {
                            $cash->where('is_cash_payment', true)
                                 ->whereNotNull('confirmed_at');
                        });
                    });
            })
            ->where(function ($query) {
                // Also flag only if there's no reference or proof on the booking itself
                $query->whereNull('payment_reference')
                      ->whereNull('proof_of_payment');
            })
            ->get();

        foreach ($bookings as $booking) {
            $this->upsertRecordWarning(
                type: 'paid_no_payment_record',
                record: $booking,
                severity: 'high',
                message: "Booking {$booking->reference_number} is marked paid but has no payment record.",
                metadata: [
                    'booking_reference' => $booking->reference_number,
                    'recommended_action' => 'Review the invoice/payment history and add or correct the payment record.',
                    'severity_reason' => 'Paid booking status should be backed by auditable payment data.',
                    'target_url' => route('admin.bookings.show', $booking, false),
                    'resolve_url' => route('admin.payments.index', [], false),
                ],
            );
        }

        return $bookings->count();
    }

    public function checkDeliveredBookingsWithoutInvoice(): int
    {
        $bookings = Booking::where('status', BookingStatus::Delivered->value)
            ->whereDoesntHave('invoice')
            ->get();

        foreach ($bookings as $booking) {
            $this->upsertRecordWarning(
                type: 'delivered_no_invoice',
                record: $booking,
                severity: 'high',
                message: "Booking {$booking->reference_number} is marked delivered but has no invoice.",
                metadata: [
                    'booking_reference' => $booking->reference_number,
                    'recommended_action' => 'Review the booking and generate the missing invoice.',
                    'severity_reason' => 'Delivered bookings must be invoiced for proper accounting.',
                    'target_url' => route('admin.bookings.show', $booking, false),
                    'resolve_url' => route('admin.bookings.edit', $booking, false),
                ],
            );
        }

        return $bookings->count();
    }

    public function checkPaidBookingsWithoutInvoice(): int
    {
        $bookings = Booking::where('payment_status', PaymentStatus::Paid->value)
            ->whereDoesntHave('invoice')
            ->get();

        foreach ($bookings as $booking) {
            $this->upsertRecordWarning(
                type: 'paid_no_invoice',
                record: $booking,
                severity: 'high',
                message: "Booking {$booking->reference_number} is marked paid but has no invoice.",
                metadata: [
                    'booking_reference' => $booking->reference_number,
                    'recommended_action' => 'Review the booking and generate an invoice to attach the payment.',
                    'severity_reason' => 'A paid booking must have an invoice to record the payment against.',
                    'target_url' => route('admin.bookings.show', $booking, false),
                    'resolve_url' => route('admin.bookings.edit', $booking, false),
                ],
            );
        }

        return $bookings->count();
    }

    public function checkBookingStatusMismatches(): int
    {
        $bookings = Booking::with('boxes')
            ->whereIn('status', [BookingStatus::Delivered->value, BookingStatus::PartiallyDelivered->value])
            ->get()
            ->filter(function (Booking $booking) {
                if ($booking->boxes->isEmpty()) {
                    return false;
                }

                if ($booking->status === BookingStatus::Delivered) {
                    return $booking->boxes->contains(fn ($b) => ! in_array($b->status, [BoxStatus::Delivered, BoxStatus::Cancelled], true));
                }

                if ($booking->status === BookingStatus::PartiallyDelivered) {
                    $deliveredCount = $booking->boxes->filter(fn ($b) => $b->status === BoxStatus::Delivered)->count();
                    $activeCount = $booking->boxes->filter(fn ($b) => $b->status !== BoxStatus::Cancelled)->count();

                    return $deliveredCount === 0 || $deliveredCount === $activeCount;
                }

                return false;
            });

        foreach ($bookings as $booking) {
            $this->upsertRecordWarning(
                type: 'booking_status_mismatch',
                record: $booking,
                severity: 'medium',
                message: "Booking {$booking->reference_number} status ({$booking->status->label()}) does not match its boxes' statuses.",
                metadata: [
                    'booking_reference' => $booking->reference_number,
                    'booking_status' => $booking->status->value,
                    'recommended_action' => 'Update the booking status to accurately reflect the state of its boxes.',
                    'severity_reason' => 'Booking status contradicts the operational reality of the physical boxes.',
                    'target_url' => route('admin.bookings.show', $booking, false),
                    'resolve_url' => route('admin.bookings.edit', $booking, false),
                ],
            );
        }

        return $bookings->count();
    }

    public function checkPaymentBalanceMismatches(): int
    {
        $invoices = Invoice::with(['booking', 'payments'])
            ->whereHas('payments')
            ->get()
            ->filter(function (Invoice $invoice) {
                $settledPayments = $invoice->payments->filter(fn ($p) => $p->isSettled());
                if ($settledPayments->isEmpty()) {
                    return false;
                }
                $paid = (float) $settledPayments->sum('amount');

                return abs($paid - (float) $invoice->amount) > 0.01;
            });

        foreach ($invoices as $invoice) {
            $settledPayments = $invoice->payments->filter(fn ($p) => $p->isSettled());
            $paid = (float) $settledPayments->sum('amount');

            $this->upsertRecordWarning(
                type: 'payment_balance_mismatch',
                record: $invoice,
                severity: 'medium',
                message: "Invoice {$invoice->invoice_number} payment total does not match invoice amount.",
                metadata: [
                    'invoice_number' => $invoice->invoice_number,
                    'booking_reference' => $invoice->booking?->reference_number,
                    'invoice_amount' => round((float) $invoice->amount, 2),
                    'payment_total' => round($paid, 2),
                    'difference' => round($paid - (float) $invoice->amount, 2),
                    'recommended_action' => 'Review payment entries for overpayment, underpayment, duplicate payment, or invoice pricing errors.',
                    'severity_reason' => 'Payment records should reconcile to invoice amount.',
                    'target_url' => route('admin.invoices.show', $invoice, false),
                    'resolve_url' => route('admin.invoices.edit', $invoice, false),
                ],
            );
        }

        return $invoices->count();
    }

    /**
     * Resolve warnings that are no longer applicable.
     */
    public function cleanupResolvedWarnings(): void
    {
        // Resolve missing declaration warnings if declaration is now present
        $warnings = DataIntegrityWarning::where('type', 'missing_declaration')
            ->where('is_resolved', false)
            ->get();

        foreach ($warnings as $warning) {
            $booking = $warning->record;
            if (! $booking || $booking->declaration_form_status !== 'missing' || $booking->status === BookingStatus::Cancelled) {
                $warning->update([
                    'is_resolved' => true,
                    'resolved_at' => now(),
                ]);
            }
        }

        // Resolve orphan box warnings if box is now assigned or no longer at warehouse
        $warnings = DataIntegrityWarning::where('type', 'orphan_box')
            ->where('is_resolved', false)
            ->get();

        foreach ($warnings as $warning) {
            $box = $warning->record;
            if (! $box || $box->batch_id !== null || $box->status !== BoxStatus::ReceivedByWarehouse) {
                $warning->update([
                    'is_resolved' => true,
                    'resolved_at' => now(),
                ]);
            }
        }

        DataIntegrityWarning::whereIn('type', self::OPERATIONS_WARNING_TYPES)
            ->where('is_resolved', false)
            ->get()
            ->each(function (DataIntegrityWarning $warning) {
                if (! $this->operationsWarningStillApplies($warning)) {
                    $warning->update([
                        'is_resolved' => true,
                        'resolved_at' => now(),
                    ]);
                }
            });
    }

    private function upsertBoxWarning(
        string $type,
        Box $box,
        string $severity,
        string $message,
        string $recommendedAction,
        string $severityReason,
        ?string $resolveUrl = null,
    ): void {
        $lastScanAt = $this->lastScanAt($box);

        DataIntegrityWarning::updateOrCreate(
            [
                'type' => $type,
                'record_type' => Box::class,
                'record_id' => $box->id,
                'is_resolved' => false,
            ],
            [
                'severity' => $severity,
                'message' => $message,
                'metadata' => [
                    'tracking_number' => $box->tracking_number,
                    'booking_reference' => $box->booking?->reference_number,
                    'status' => $box->status instanceof BoxStatus ? $box->status->value : (string) $box->status,
                    'last_scan_at' => $lastScanAt?->toDateTimeString(),
                    'age_hours' => $lastScanAt ? (int) $lastScanAt->diffInHours(now()) : null,
                    'recommended_action' => $recommendedAction,
                    'severity_reason' => $severityReason,
                    'target_url' => route('admin.boxes.show', $box, false),
                    'resolve_url' => $resolveUrl,
                ],
            ],
        );
    }

    private function upsertRecordWarning(
        string $type,
        \Illuminate\Database\Eloquent\Model $record,
        string $severity,
        string $message,
        array $metadata,
    ): void {
        DataIntegrityWarning::updateOrCreate(
            [
                'type' => $type,
                'record_type' => $record::class,
                'record_id' => $record->getKey(),
                'is_resolved' => false,
            ],
            [
                'severity' => $severity,
                'message' => $message,
                'metadata' => $metadata,
            ],
        );
    }

    private function lastScanAt(Box $box): ?CarbonInterface
    {
        $latestUpdate = $box->relationLoaded('updates')
            ? $box->updates->sortByDesc('created_at')->first()
            : $box->updates()->latest()->first();

        return $latestUpdate?->created_at ?? $box->updated_at ?? $box->created_at;
    }

    private function operationsWarningStillApplies(DataIntegrityWarning $warning): bool
    {
        if (in_array($warning->type, [
            'missed_pickup',
            'partial_pickup',
            'batch_capacity_overrun',
            'batch_status_blocked',
            'partial_delivery',
            'paid_no_payment_record',
            'payment_balance_mismatch',
            'delivered_no_invoice',
            'paid_no_invoice',
            'booking_status_mismatch',
        ], true)) {
            return match ($warning->type) {
                'missed_pickup' => $this->missedPickupStillApplies($warning),
                'partial_pickup' => $this->partialPickupStillApplies($warning),
                'batch_capacity_overrun' => $this->batchCapacityOverrunStillApplies($warning),
                'batch_status_blocked' => $this->batchStatusBlockedStillApplies($warning),
                'partial_delivery' => $this->partialDeliveryStillApplies($warning),
                'paid_no_payment_record' => $this->paidNoPaymentRecordStillApplies($warning),
                'payment_balance_mismatch' => $this->paymentBalanceMismatchStillApplies($warning),
                'delivered_no_invoice' => $this->deliveredNoInvoiceStillApplies($warning),
                'paid_no_invoice' => $this->paidNoInvoiceStillApplies($warning),
                'booking_status_mismatch' => $this->bookingStatusMismatchStillApplies($warning),
            };
        }

        $box = $warning->record;

        if (! $box instanceof Box) {
            return false;
        }

        $box->loadMissing(['booking', 'batch', 'updates']);
        $lastScanAt = $this->lastScanAt($box);

        return match ($warning->type) {
            'stale_scan' => in_array($box->status, [
                BoxStatus::Collected,
                BoxStatus::ReceivedByWarehouse,
                BoxStatus::LoadedToContainer,
                BoxStatus::InTransit,
                BoxStatus::Arrived,
                BoxStatus::OutForDelivery,
            ], true) && $lastScanAt?->lessThanOrEqualTo(now()->subHours($this->staleThresholdHoursFor($box))),
            'delayed_receipt' => $box->status === BoxStatus::Collected
                && $lastScanAt?->lessThanOrEqualTo(now()->subHours($this->slaHours('delayed_receipt'))),
            'missing_warehouse_location' => $box->status === BoxStatus::ReceivedByWarehouse
                && blank($box->warehouse_location),
            'overdue_loading' => $box->status === BoxStatus::ReceivedByWarehouse
                && $box->batch_id === null
                && $lastScanAt?->lessThanOrEqualTo(now()->subHours($this->slaHours('overdue_loading'))),
            'missed_eta' => $box->batch !== null
                && $box->batch->status !== BatchStatus::Delivered
                && $box->batch->eta_at !== null
                && $box->batch->eta_at->lessThanOrEqualTo(now()->subHours($this->slaHours('missed_eta')))
                && ! in_array($box->status, [BoxStatus::Delivered, BoxStatus::Cancelled], true),
            'held_box' => $box->status === BoxStatus::Held,
            'damaged_box' => $box->status === BoxStatus::Damaged,
            'unpaid_loading_block' => $box->status === BoxStatus::ReceivedByWarehouse
                && $box->batch_id === null
                && ! in_array($box->booking?->payment_status, [PaymentStatus::Paid, PaymentStatus::CashCollected], true),
            'delivery_overdue' => ! in_array($box->status, [BoxStatus::Delivered, BoxStatus::Cancelled], true)
                && $box->updates
                    ->where('tracking_phase', TrackingPhase::OUT_FOR_DELIVERY)
                    ->sortByDesc('created_at')
                    ->first()
                    ?->created_at
                    ?->lessThanOrEqualTo(now()->subHours($this->slaHours('delivery_overdue'))),
            'delivery_proof_missing' => $box->status === BoxStatus::Delivered
                && (blank($box->delivery_proof_path) || blank($box->signature_path)),
            default => false,
        };
    }

    private function missedPickupStillApplies(DataIntegrityWarning $warning): bool
    {
        $runsheet = $warning->record;

        if (! $runsheet instanceof Runsheet) {
            return false;
        }

        $runsheet->loadMissing('bookings.boxes');

        return $runsheet->type === RunsheetType::Pickup
            && in_array($runsheet->status, [RunsheetStatus::Assigned, RunsheetStatus::InProgress], true)
            && $runsheet->scheduled_date?->lessThanOrEqualTo(now()->subHours($this->slaHours('missed_pickup')))
            && $runsheet->bookings
                ->flatMap(fn (Booking $booking) => $booking->boxes)
                ->contains(fn (Box $box) => $box->status === BoxStatus::Pending);
    }

    private function partialPickupStillApplies(DataIntegrityWarning $warning): bool
    {
        $booking = $warning->record;

        if (! $booking instanceof Booking) {
            return false;
        }

        $booking->loadMissing(['boxes', 'runsheets']);

        $hasActivePickupRunsheet = $booking->runsheets->contains(fn (Runsheet $runsheet) => $runsheet->type === RunsheetType::Pickup
            && in_array($runsheet->status, [RunsheetStatus::Assigned, RunsheetStatus::InProgress], true));

        return $hasActivePickupRunsheet
            && $booking->boxes->contains(fn (Box $box) => $box->status === BoxStatus::Pending)
            && $booking->boxes->contains(fn (Box $box) => $box->status !== BoxStatus::Pending);
    }

    private function batchCapacityOverrunStillApplies(DataIntegrityWarning $warning): bool
    {
        $batch = $warning->record;

        if (! $batch instanceof Batch) {
            return false;
        }

        return ($batch->capacity_boxes !== null && $batch->current_box_count > $batch->capacity_boxes)
            || ($batch->capacity_weight_kg !== null && $batch->current_weight_kg > $batch->capacity_weight_kg)
            || ($batch->capacity_cbm !== null && $batch->current_cbm > $batch->capacity_cbm);
    }

    private function batchStatusBlockedStillApplies(DataIntegrityWarning $warning): bool
    {
        $batch = $warning->record;

        if (! $batch instanceof Batch) {
            return false;
        }

        $batch->loadMissing('boxes.booking');

        return in_array($batch->status, [BatchStatus::ReadyToClose, BatchStatus::Sailed, BatchStatus::Arrived], true)
            && $batch->boxes->contains(function (Box $box) {
                return in_array($box->status, [BoxStatus::Held, BoxStatus::Damaged], true)
                    || ! in_array($box->booking?->payment_status, [PaymentStatus::Paid, PaymentStatus::CashCollected], true);
            });
    }

    private function partialDeliveryStillApplies(DataIntegrityWarning $warning): bool
    {
        $booking = $warning->record;

        if (! $booking instanceof Booking) {
            return false;
        }

        $booking->loadMissing('boxes');

        return $booking->boxes->contains(fn (Box $box) => $box->status === BoxStatus::Delivered)
            && $booking->boxes->contains(fn (Box $box) => ! in_array($box->status, [BoxStatus::Delivered, BoxStatus::Cancelled], true));
    }

    private function deliveredNoInvoiceStillApplies(DataIntegrityWarning $warning): bool
    {
        $booking = $warning->record;

        if (! $booking instanceof Booking) {
            return false;
        }

        return $booking->status === BookingStatus::Delivered
            && ! $booking->invoice()->exists();
    }

    private function paidNoInvoiceStillApplies(DataIntegrityWarning $warning): bool
    {
        $booking = $warning->record;

        if (! $booking instanceof Booking) {
            return false;
        }

        return $booking->payment_status === PaymentStatus::Paid
            && ! $booking->invoice()->exists();
    }

    private function bookingStatusMismatchStillApplies(DataIntegrityWarning $warning): bool
    {
        $booking = $warning->record;

        if (! $booking instanceof Booking) {
            return false;
        }

        $booking->loadMissing('boxes');

        if ($booking->boxes->isEmpty()) {
            return false;
        }

        if ($booking->status === BookingStatus::Delivered) {
            return $booking->boxes->contains(fn ($b) => ! in_array($b->status, [BoxStatus::Delivered, BoxStatus::Cancelled], true));
        }

        if ($booking->status === BookingStatus::PartiallyDelivered) {
            $deliveredCount = $booking->boxes->filter(fn ($b) => $b->status === BoxStatus::Delivered)->count();
            $activeCount = $booking->boxes->filter(fn ($b) => $b->status !== BoxStatus::Cancelled)->count();

            return $deliveredCount === 0 || $deliveredCount === $activeCount;
        }

        return false;
    }

    private function paidNoPaymentRecordStillApplies(DataIntegrityWarning $warning): bool
    {
        $booking = $warning->record;

        if (! $booking instanceof Booking) {
            return false;
        }

        return $booking->payment_status === PaymentStatus::Paid
            && $booking->invoice !== null
            && ! $booking->invoice->payments()
                ->where(function ($query) {
                    $query->where(function ($nonCash) {
                        $nonCash->where(function ($inner) {
                            $inner->where('is_cash_payment', false)
                                  ->orWhereNull('is_cash_payment');
                        })->whereNotNull('paid_at');
                    })->orWhere(function ($cash) {
                        $cash->where('is_cash_payment', true)
                             ->whereNotNull('confirmed_at');
                    });
                })
                ->exists();
    }

    private function paymentBalanceMismatchStillApplies(DataIntegrityWarning $warning): bool
    {
        $invoice = $warning->record;

        if (! $invoice instanceof Invoice) {
            return false;
        }

        $invoice->loadMissing('payments');
        $settledPayments = $invoice->payments->filter(fn ($p) => $p->isSettled());
        if ($settledPayments->isEmpty()) {
            return false;
        }
        $paid = (float) $settledPayments->sum('amount');

        return abs($paid - (float) $invoice->amount) > 0.01;
    }

    private function staleThresholdHoursFor(Box $box): int
    {
        return $box->status === BoxStatus::Arrived
            ? $this->slaHours('arrived_sorting')
            : $this->slaHours('stale_scan');
    }

    private function slaHours(string $key): int
    {
        return (int) config("logistics.sla_hours.{$key}", match ($key) {
            'delayed_receipt' => self::DELAYED_RECEIPT_HOURS,
            'missed_pickup' => self::MISSED_PICKUP_HOURS,
            'overdue_loading' => self::OVERDUE_LOADING_HOURS,
            'arrived_sorting' => self::ARRIVED_SORTING_HOURS,
            'delivery_overdue' => self::DELIVERY_OVERDUE_HOURS,
            'missed_eta' => self::MISSED_ETA_HOURS,
            'stale_scan' => self::STALE_SCAN_HOURS,
            default => 24,
        });
    }
}
