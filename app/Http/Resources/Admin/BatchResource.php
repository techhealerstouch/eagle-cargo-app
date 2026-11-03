<?php

namespace App\Http\Resources\Admin;

use App\Models\ActivityLog;
use App\Models\Batch;
use App\Models\BoxUpdate;
use App\Services\TrackingStepService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

class BatchResource extends JsonResource
{
    /**
     * @var Batch
     */
    public $resource;

    public static $wrap = null;

    public function toArray(Request $request): array
    {
        $trackingStepService = app(TrackingStepService::class);
        $trackingSteps = $this->getConfiguredTrackingSteps($trackingStepService);

        $latestTrackingPhase = $this->resolveLatestTrackingPhase($trackingSteps);

        return [
            'id' => $this->resource->id,
            'batch_number' => $this->resource->batch_number,
            'branch_name' => $this->resource->branch_name,
            'container_number' => $this->resource->container_number,
            'seal_number' => $this->resource->seal_number,
            'container_size' => $this->resource->container_size,
            'vessel_name' => $this->resource->vessel_name,
            'shipping_line' => $this->resource->shipping_line,
            'voyage_number' => $this->resource->voyage_number,
            'origin_port' => $this->resource->origin_port,
            'destination_port' => $this->resource->destination_port,
            'capacity_boxes' => $this->resource->capacity_boxes,
            'capacity_weight_kg' => $this->resource->capacity_weight_kg,
            'capacity_cbm' => $this->resource->capacity_cbm,
            'current_box_count' => $this->resource->current_box_count,
            'current_weight_kg' => $this->resource->current_weight_kg,
            'current_cbm' => $this->resource->current_cbm,
            'cutoff_at' => $this->resource->cutoff_at,
            'eta_at' => $this->resource->eta_at,
            'sailed_at' => $this->resource->sailed_at,
            'arrived_at' => $this->resource->arrived_at,
            'delivered_at' => $this->resource->delivered_at,
            'status' => $this->resource->status,
            'override_note' => $this->resource->override_note,
            'override_details' => $this->getOverrideDetails(),
            'boxes' => $this->resource->relationLoaded('boxes') ? $this->resource->boxes : [],
            'latest_tracking_phase' => $latestTrackingPhase,
            'latest_tracking_phase_order' => $this->getTrackingStepOrder($trackingSteps, $latestTrackingPhase),
            'warnings' => $this->getWarnings(),
        ];
    }

    private function getOverrideDetails(): ?array
    {
        if (! $this->resource->override_note) {
            return null;
        }

        $log = ActivityLog::with('user')
            ->where('model_type', Batch::class)
            ->where('model_id', $this->resource->id)
            ->where('action', 'updated')
            ->latest('id')
            ->get()
            ->first(function ($log) {
                return isset($log->changes['status']);
            });

        if (! $log) {
            return null;
        }

        return [
            'from_status' => $log->changes['status']['old'] ?? null,
            'to_status' => $log->changes['status']['new'] ?? null,
            'overridden_by' => $log->user?->first_name ? trim($log->user->first_name.' '.$log->user->last_name) : ($log->user?->name ?? 'System'),
            'overridden_at' => $log->created_at->format('M j, Y h:i A'),
        ];
    }

    private function getWarnings(): array
    {
        $warnings = [];
        $batch = $this->resource;

        if ((int) ($batch->capacity_boxes ?? 0) > 0 && (int) $batch->current_box_count >= (int) $batch->capacity_boxes) {
            $warnings[] = 'Box capacity reached';
        }

        if ((float) ($batch->capacity_weight_kg ?? 0) > 0 && (float) $batch->current_weight_kg >= (float) $batch->capacity_weight_kg) {
            $warnings[] = 'Weight capacity reached';
        }

        if ((float) ($batch->capacity_cbm ?? 0) > 0 && (float) $batch->current_cbm >= (float) $batch->capacity_cbm) {
            $warnings[] = 'CBM capacity reached';
        }

        if ($batch->cutoff_at !== null && now()->greaterThanOrEqualTo($batch->cutoff_at)) {
            $warnings[] = 'Cut-off date has passed';
        }

        return $warnings;
    }

    private function resolveLatestTrackingPhase(Collection $trackingSteps): ?string
    {
        $boxes = $this->resource->boxes;
        if (! $boxes || $boxes->isEmpty()) {
            return null;
        }

        $activeBoxes = $boxes->reject(function ($box): bool {
            $status = $box->status instanceof \BackedEnum ? $box->status->value : (string) $box->status;

            return in_array($status, ['delivered', 'cancelled'], true);
        });

        $targetBoxes = $activeBoxes->isNotEmpty() ? $activeBoxes : $boxes;

        $highestPhase = null;
        $highestOrder = -1;
        $missingStepBoxIds = [];

        foreach ($targetBoxes as $box) {
            $stepKey = $box->tracking_step_key;
            if (! empty($stepKey)) {
                $order = $this->getTrackingStepOrder($trackingSteps, (string) $stepKey);
                if ($order !== null && $order > $highestOrder) {
                    $highestOrder = $order;
                    $highestPhase = (string) $stepKey;
                }
            } else {
                $missingStepBoxIds[] = $box->id;
            }
        }

        if (! empty($missingStepBoxIds) || $highestPhase === null) {
            $lookupIds = ! empty($missingStepBoxIds) ? $missingStepBoxIds : $targetBoxes->pluck('id')->all();
            $latestUpdate = BoxUpdate::whereIn('box_id', $lookupIds)
                ->whereNotNull('tracking_phase')
                ->latest()
                ->orderBy('id', 'desc')
                ->first();

            $fallbackPhase = $latestUpdate?->tracking_phase?->value;
            if ($fallbackPhase) {
                $fallbackOrder = $this->getTrackingStepOrder($trackingSteps, $fallbackPhase);
                if ($fallbackOrder !== null && $fallbackOrder > $highestOrder) {
                    $highestOrder = $fallbackOrder;
                    $highestPhase = $fallbackPhase;
                }
            }
        }

        return $highestPhase;
    }

    private function getConfiguredTrackingSteps(TrackingStepService $service): Collection
    {
        return collect($service->getSteps())
            ->sortBy(fn ($step) => $step['order'] ?? 0);
    }

    private function getTrackingStepOrder(Collection $steps, ?string $phase): ?int
    {
        if (! $phase) {
            return null;
        }
        $step = $steps->firstWhere('key', $phase);

        return $step['order'] ?? null;
    }
}
