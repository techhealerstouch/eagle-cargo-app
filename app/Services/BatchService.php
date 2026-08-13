<?php

namespace App\Services;

use App\Enums\BatchStatus;
use App\Enums\BoxStatus;
use App\Enums\TrackingPhase;
use App\Models\Batch;
use App\Models\BoxUpdate;
use App\Repositories\Contracts\BatchRepositoryInterface;
use DateTimeInterface;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class BatchService
{
    public function __construct(
        private readonly BatchRepositoryInterface $batchRepository,
        private readonly TrackingStepService $trackingStepService,
    ) {}

    public function create(array $attributes): Batch
    {
        return $this->createWithGeneratedNumber($attributes);
    }

    private function createWithGeneratedNumber(array $attributes, bool $evaluate = true): Batch
    {
        $maxRetries = 3;
        $attempt = 0;

        while ($attempt < $maxRetries) {
            try {
                return DB::transaction(function () use ($attributes, $evaluate): Batch {
                    if (empty($attributes['batch_number'])) {
                        $date = ! empty($attributes['cutoff_at']) ? Carbon::parse($attributes['cutoff_at']) : now();
                        $attributes['batch_number'] = $this->generateBatchNumber($date);
                    }

                    $attributes['status'] = $attributes['status'] ?? BatchStatus::Open;

                    $batch = $this->batchRepository->create($attributes);

                    return $evaluate ? $this->refreshAndEvaluate($batch) : $batch;
                });
            } catch (QueryException $e) {
                // Check if it's a unique constraint violation for batch_number
                if ($e->getCode() === '23000' && str_contains($e->getMessage(), 'batch_number') && empty($attributes['batch_number'])) {
                    $attempt++;

                    continue;
                }
                throw $e;
            }
        }

        throw new \RuntimeException('Failed to generate a unique batch number after multiple attempts.');
    }

    public function update(Batch $batch, array $attributes): Batch
    {
        return DB::transaction(function () use ($batch, $attributes): Batch {
            if (array_key_exists('status', $attributes)) {
                $this->assertValidTransition($batch, $attributes['status']);
                $attributes = $this->applyStatusTimestamps($batch, $attributes['status'], $attributes);
            }

            $updated = $this->batchRepository->update($batch, $attributes);

            return $this->refreshAndEvaluate($updated);
        });
    }

    public function confirmManifest(Batch $batch): Batch
    {
        return DB::transaction(function () use ($batch): Batch {
            $batch = $this->refreshAndEvaluate($batch);

            if ($batch->status !== BatchStatus::ReadyToClose) {
                throw new \InvalidArgumentException('Batch is not yet ready to close.');
            }

            return $this->batchRepository->update($batch, [
                'status' => BatchStatus::Sailed,
                'sailed_at' => now(),
            ]);
        });
    }

    public function confirmArrival(Batch $batch): Batch
    {
        return DB::transaction(function () use ($batch): Batch {
            $this->assertValidTransition($batch, BatchStatus::Arrived);

            return $this->batchRepository->update($batch, [
                'status' => BatchStatus::Arrived,
                'arrived_at' => now(),
            ]);
        });
    }

    public function bulkUpdateTrackingPhase(
        Batch $batch,
        TrackingPhase|string $trackingPhase,
        ?int $updatedBy = null,
        ?string $description = null,
        BoxStatus|string|null $systemStatus = null,
    ): int {
        $trackingPhase = $trackingPhase instanceof TrackingPhase
            ? $trackingPhase
            : TrackingPhase::from((string) $trackingPhase);

        $targetStatus = $systemStatus instanceof BoxStatus
            ? $systemStatus
            : ($systemStatus ? BoxStatus::tryFrom((string) $systemStatus) : $this->resolveSystemStatusForTrackingPhase($trackingPhase));

        if ($systemStatus && $targetStatus === null) {
            throw new \InvalidArgumentException(sprintf(
                'Tracking phase "%s" has an invalid system status.',
                $trackingPhase->label(),
            ));
        }

        $updated = DB::transaction(function () use ($batch, $trackingPhase, $updatedBy, $description, $targetStatus): int {
            $boxes = $batch->boxes()->select(['id', 'status', 'tracking_number'])->get();

            if ($boxes->isEmpty()) {
                return 0;
            }

            $now = now();
            $actorId = $updatedBy !== null && $updatedBy > 0 ? $updatedBy : null;
            $resolvedDescription = $description ?: sprintf(
                'Tracking phase updated to %s.',
                str_replace('_', ' ', $trackingPhase->value),
            );

            $updates = [];

            foreach ($boxes as $box) {
                $currentStatus = $box->status instanceof BoxStatus
                    ? $box->status
                    : BoxStatus::from((string) $box->status);

                $resolvedStatus = $targetStatus ?? $currentStatus;

                if ($targetStatus !== null && $currentStatus !== $targetStatus) {
                    if (! $currentStatus->canTransitionTo($targetStatus)) {
                        throw new \InvalidArgumentException(sprintf(
                            'Cannot apply "%s" to box %s because %s cannot transition to %s.',
                            $trackingPhase->label(),
                            $box->tracking_number,
                            $currentStatus->label(),
                            $targetStatus->label(),
                        ));
                    }

                    $box->update(['status' => $targetStatus]);
                }

                $updates[] = [
                    'box_id' => $box->id,
                    'status' => $resolvedStatus->value,
                    'tracking_phase' => $trackingPhase->value,
                    'location' => $trackingPhase->phase(),
                    'description' => $resolvedDescription,
                    'updated_by' => $actorId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            BoxUpdate::query()->insert($updates);

            return count($updates);
        });

        if ($updated > 0) {
            $this->syncBatchStatusWithTrackingPhase($batch, $trackingPhase);
            app(TrackingCacheService::class)->forgetBatch($batch);
        }

        return $updated;
    }

    /**
     * Automatically synchronize the batch status when a tracking phase is applied.
     */
    private function syncBatchStatusWithTrackingPhase(Batch $batch, TrackingPhase $phase): void
    {
        $currentStatus = $batch->status;
        $targetStatus = null;

        // Map specific tracking phases to major batch statuses.
        // This ensures the batch progress bar/status aligns with the bulk tracking updates.
        switch ($phase) {
            case TrackingPhase::DEPARTED_FROM_ORIGIN:
            case TrackingPhase::IN_TRANSIT_SEA:
                $targetStatus = BatchStatus::Sailed;
                break;

            case TrackingPhase::ARRIVED_MANILA_PORT:
            case TrackingPhase::CUSTOMS_CLEARANCE:
            case TrackingPhase::RELEASED_BY_BOC:
            case TrackingPhase::RECEIVED_MANILA_WAREHOUSE:
            case TrackingPhase::SORTING:
            case TrackingPhase::DISPATCHED_TO_LOCAL_HUB:
            case TrackingPhase::OUT_FOR_DELIVERY:
                $targetStatus = BatchStatus::Arrived;
                break;

            case TrackingPhase::DELIVERED:
                $targetStatus = BatchStatus::Delivered;
                break;
        }

        if ($targetStatus && $currentStatus !== $targetStatus) {
            try {
                // We use the update() method here because it handles transition validation
                // and applies the necessary timestamps (sailed_at, arrived_at, etc.)
                $this->update($batch, ['status' => $targetStatus]);
            } catch (\InvalidArgumentException $e) {
                // If the transition is not allowed (e.g., trying to go back or skipping states),
                // we leave the batch status as is to avoid breaking business rules.
            }
        }
    }

    public function resolveTrackingPhaseForStatus(BatchStatus $status): ?TrackingPhase
    {
        return match ($status) {
            BatchStatus::Sailed => TrackingPhase::IN_TRANSIT_SEA,
            BatchStatus::Arrived => TrackingPhase::ARRIVED_MANILA_PORT,
            default => null,
        };
    }

    public function resolveSystemStatusForTrackingPhase(TrackingPhase $trackingPhase): ?BoxStatus
    {
        $step = collect($this->trackingStepService->getSteps())
            ->firstWhere('key', $trackingPhase->value);

        if (! is_array($step)) {
            return null;
        }

        return BoxStatus::tryFrom((string) ($step['system_status'] ?? ''));
    }

    /**
     * Check if adding more boxes would exceed batch capacity.
     * Returns an error message if at capacity, null if OK.
     */
    public function checkCapacity(Batch $batch, int $additionalBoxes = 1): ?string
    {
        if ((int) ($batch->capacity_boxes ?? 0) <= 0) {
            return null; // No capacity limit set
        }

        $currentCount = (int) $batch->current_box_count;
        $capacity = (int) $batch->capacity_boxes;

        if (($currentCount + $additionalBoxes) > $capacity) {
            return "Batch {$batch->batch_number} is at capacity ({$currentCount}/{$capacity} boxes). Please manifest this batch or open a new one.";
        }

        return null;
    }

    public function refreshAndEvaluateById(?int $batchId): void
    {
        if (! $batchId) {
            return;
        }

        $batch = Batch::find($batchId);
        if (! $batch) {
            return;
        }

        $this->refreshAndEvaluate($batch);
    }

public function refreshAndEvaluate(Batch $batch): Batch
    {
        $batch = $this->batchRepository->recalculateMetrics($batch);

        $batch = $this->evaluateManifestCandidate($batch);

        // Do not silently auto-create next batch without admin permission and confirmation dialog
        return $batch;
    }

    public function generateBatchNumber(?DateTimeInterface $date = null): string
    {
        $date = $date ?? now();
        $year = (int) $date->format('Y');
        $month = (int) $date->format('m');
        $prefix = 'LBB';

        // Use YYMM format (e.g., 2605) for more granularity and better chronological sorting
        $dateCode = sprintf('%s%02d', substr((string) $year, -2), $month);

        $sequence = $this->batchRepository->nextSequence($prefix, $dateCode);

        return sprintf('%s-%s-%03d', $prefix, $dateCode, $sequence);
    }

    private function evaluateManifestCandidate(Batch $batch): Batch
    {
        if (! in_array($batch->status, [BatchStatus::Open, BatchStatus::Loading, BatchStatus::ReadyToClose], true)) {
            return $batch;
        }

        $thresholdReached = $this->isManifestThresholdReached($batch);

        if ($thresholdReached && in_array($batch->status, [BatchStatus::Open, BatchStatus::Loading], true)) {
            return $this->batchRepository->update($batch, ['status' => BatchStatus::ReadyToClose]);
        }

        if (! $thresholdReached && $batch->status === BatchStatus::ReadyToClose) {
            return $this->batchRepository->update($batch, ['status' => BatchStatus::Loading]);
        }

        return $batch;
    }

    private function isManifestThresholdReached(Batch $batch): bool
    {
        if ((int) ($batch->capacity_boxes ?? 0) > 0 && (int) $batch->current_box_count >= (int) $batch->capacity_boxes) {
            return true;
        }

        if ((float) ($batch->capacity_weight_kg ?? 0) > 0 && (float) $batch->current_weight_kg >= (float) $batch->capacity_weight_kg) {
            return true;
        }

        if ((float) ($batch->capacity_cbm ?? 0) > 0 && (float) $batch->current_cbm >= (float) $batch->capacity_cbm) {
            return true;
        }

        return $batch->cutoff_at !== null && now()->greaterThanOrEqualTo($batch->cutoff_at);
    }

    private function ensureNextBatchExists(Batch $batch): void
    {
        $nextCutoff = $this->nextFutureBatchCutoff($batch);

        $exists = Batch::whereIn('status', [BatchStatus::Open, BatchStatus::Loading, BatchStatus::ReadyToClose])
            ->whereYear('cutoff_at', $nextCutoff->year)
            ->whereMonth('cutoff_at', $nextCutoff->month)
            ->where('branch_name', $batch->branch_name)
            ->where('origin_port', $batch->origin_port)
            ->where('destination_port', $batch->destination_port)
            ->where('container_size', $batch->container_size)
            ->where('shipping_line', $batch->shipping_line)
            ->exists();

        if ($exists) {
            return;
        }

        $this->createNextBatchFromTemplate($batch);
    }

    private function createNextBatchFromTemplate(Batch $batch): Batch
    {
        $nextCutoff = $this->nextFutureBatchCutoff($batch);

        $nextEta = $this->nextBatchEta($batch, $nextCutoff);

        // Selective cloning: keep operational specifics blank for the new container
        $attributes = [
            'branch_name' => $batch->branch_name,
            'container_size' => $batch->container_size,
            'origin_port' => $batch->origin_port,
            'destination_port' => $batch->destination_port,
            'capacity_boxes' => $batch->capacity_boxes,
            'capacity_weight_kg' => $batch->capacity_weight_kg,
            'capacity_cbm' => $batch->capacity_cbm,
            'cutoff_at' => $nextCutoff,
            'eta_at' => $nextEta,
            'status' => BatchStatus::Open,
            // Retain important details like vessel name, shipping line, and voyage number
            'vessel_name' => $batch->vessel_name,
            'voyage_number' => $batch->voyage_number,
            'container_number' => null,
            'seal_number' => null,
            'shipping_line' => $batch->shipping_line,
        ];

        // Re-use the retry-safe creation path
        return $this->createWithGeneratedNumber($attributes, false);
    }

    private function nextFutureBatchCutoff(Batch $batch): Carbon
    {
        $nextCutoff = $batch->cutoff_at
            ? Carbon::parse($batch->cutoff_at)->addMonth()
            : Carbon::now()->addMonth()->startOfDay()->addHours(17);

        while ($nextCutoff->lessThanOrEqualTo(now())) {
            $nextCutoff->addMonth();
        }

        return $nextCutoff;
    }

    private function nextBatchEta(Batch $batch, Carbon $nextCutoff): Carbon
    {
        if (! $batch->eta_at || ! $batch->cutoff_at) {
            return $nextCutoff->copy()->addMonths(1);
        }

        $sourceCutoff = Carbon::parse($batch->cutoff_at);
        $sourceEta = Carbon::parse($batch->eta_at);
        $daysAfterCutoff = max(0, $sourceCutoff->diffInDays($sourceEta, false));

        return $nextCutoff->copy()
            ->addDays($daysAfterCutoff)
            ->setTimeFrom($sourceEta);
    }

    private function assertValidTransition(Batch $batch, BatchStatus|string $targetStatus): void
    {
        $current = $batch->status instanceof BatchStatus
            ? $batch->status
            : BatchStatus::from((string) $batch->status);

        $target = $targetStatus instanceof BatchStatus
            ? $targetStatus
            : BatchStatus::from((string) $targetStatus);

        if ($current !== $target && ! $current->canTransitionTo($target)) {
            throw new \InvalidArgumentException(sprintf(
                'Invalid batch transition from %s to %s.',
                $current->value,
                $target->value,
            ));
        }
    }

    private function applyStatusTimestamps(Batch $batch, BatchStatus|string $targetStatus, array $attributes): array
    {
        $target = $targetStatus instanceof BatchStatus
            ? $targetStatus
            : BatchStatus::from((string) $targetStatus);

        return match ($target) {
            BatchStatus::Sailed => array_merge(['sailed_at' => $batch->sailed_at ?? now()], $attributes),
            BatchStatus::Arrived => array_merge(['arrived_at' => $batch->arrived_at ?? now()], $attributes),
            BatchStatus::Delivered => array_merge(['delivered_at' => $batch->delivered_at ?? now()], $attributes),
            default => $attributes,
        };
    }
}
