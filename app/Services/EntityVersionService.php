<?php

namespace App\Services;

use App\Models\EntityVersion;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class EntityVersionService
{
    public function capture(Model $model, string $reason = 'updated', ?array $context = null): ?EntityVersion
    {
        if (! $model->exists || $model instanceof EntityVersion) {
            return null;
        }

        $entityType = $model::class;
        $entityId = (int) $model->getKey();
        $snapshot = $this->normalizeSnapshot($model->attributesToArray());

        return DB::transaction(function () use ($entityType, $entityId, $reason, $context, $snapshot): EntityVersion {
            $latestVersion = EntityVersion::query()
                ->where('entity_type', $entityType)
                ->where('entity_id', $entityId)
                ->lockForUpdate()
                ->max('version_number');

            return EntityVersion::create([
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'version_number' => ((int) $latestVersion) + 1,
                'reason' => $reason,
                'context_type' => $context['type'] ?? null,
                'context_id' => isset($context['id']) ? (int) $context['id'] : null,
                'created_by' => Auth::id(),
                'snapshot' => $snapshot,
            ]);
        });
    }

    public function latestVersionId(Model $model): ?int
    {
        return EntityVersion::query()
            ->where('entity_type', $model::class)
            ->where('entity_id', (int) $model->getKey())
            ->latest('version_number')
            ->value('id');
    }

    private function normalizeSnapshot(array $snapshot): array
    {
        foreach ($snapshot as $key => $value) {
            if ($value instanceof \BackedEnum) {
                $snapshot[$key] = $value->value;

                continue;
            }

            if ($value instanceof \UnitEnum) {
                $snapshot[$key] = $value->name;
            }
        }

        return $snapshot;
    }
}
