<?php

namespace App\Repositories\Contracts;

use App\Models\Batch;

interface BatchRepositoryInterface
{
    public function create(array $attributes): Batch;

    public function update(Batch $batch, array $attributes): Batch;

    public function nextSequence(string $prefix, string|int $code): int;

    public function recalculateMetrics(Batch $batch): Batch;
}
