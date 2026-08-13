<?php

namespace App\Repositories\Eloquent;

use App\Enums\BoxStatus;
use App\Models\Batch;
use App\Models\Box;
use App\Repositories\Contracts\BatchRepositoryInterface;

class BatchRepository implements BatchRepositoryInterface
{
    public function create(array $attributes): Batch
    {
        return Batch::create($attributes);
    }

    public function update(Batch $batch, array $attributes): Batch
    {
        $batch->update($attributes);

        return $batch->fresh();
    }

    public function nextSequence(string $prefix, string|int $code): int
    {
        $query = Batch::query()->where('batch_number', 'like', $prefix.'-'.$code.'-%');

        // MySQL optimized ordering
        if (config('database.default') === 'mysql') {
            $lastBatch = $query->orderByRaw('CAST(SUBSTRING_INDEX(batch_number, "-", -1) AS UNSIGNED) DESC')
                ->first(['batch_number']);
        } else {
            // Fallback for SQLite/others: load numbers and sort in PHP (safe for tests)
            $batchNumbers = $query->pluck('batch_number');
            if ($batchNumbers->isEmpty()) {
                return 1;
            }

            $lastSequence = $batchNumbers->map(function ($bn) {
                $parts = explode('-', (string) $bn);

                return (int) end($parts);
            })->max();

            return $lastSequence + 1;
        }

        if (! $lastBatch) {
            return 1;
        }

        $parts = explode('-', (string) $lastBatch->batch_number);
        $lastSequence = (int) end($parts);

        return $lastSequence + 1;
    }

    public function recalculateMetrics(Batch $batch): Batch
    {
        $boxes = Box::query()
            ->with('boxType:id,dimensions')
            ->where('batch_id', $batch->id)
            ->where('status', '!=', BoxStatus::Cancelled->value)
            ->get(['id', 'weight', 'actual_cbm', 'box_type_id', 'status']);

        $currentBoxCount = $boxes->count();
        $currentWeightKg = (float) $boxes->sum(fn (Box $box) => (float) ($box->weight ?? 0));
        $currentCbm = (float) $boxes->sum(fn (Box $box) => $this->calculateBoxCbm($box));

        $batch->forceFill([
            'current_box_count' => $currentBoxCount,
            'current_weight_kg' => round($currentWeightKg, 2),
            'current_cbm' => round($currentCbm, 3),
        ])->saveQuietly();

        return $batch->fresh();
    }

    private function calculateBoxCbm(Box $box): float
    {
        if ($box->actual_cbm !== null) {
            return (float) $box->actual_cbm;
        }

        $dimensions = (string) ($box->boxType?->dimensions ?? '');
        if (preg_match('/(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/', $dimensions, $matches) !== 1) {
            return 0.0;
        }

        $length = (float) $matches[1];
        $width = (float) $matches[2];
        $height = (float) $matches[3];
        $rawVolume = $length * $width * $height;
        $normalized = strtolower($dimensions);

        if (str_contains($normalized, 'cm')) {
            return $rawVolume * 0.000001;
        }

        if (str_contains($normalized, ' m')) {
            return $rawVolume;
        }

        // Default to inches when no explicit unit is present.
        return $rawVolume * 0.000016387064;
    }
}
