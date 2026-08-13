<?php

// Fix boxes incorrectly marked as in_transit in batches that haven't sailed yet

use App\Enums\BoxStatus;
use App\Models\Batch;
use App\Models\Box;
use App\Models\BoxUpdate;

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// Find batches that have NOT sailed (open, loading, ready_to_close)
$unsailedBatchIds = Batch::whereNotIn('status', ['sailed', 'arrived', 'delivered'])
    ->pluck('id');

echo "Unsailed batch IDs: " . $unsailedBatchIds->implode(', ') . PHP_EOL;

// Find boxes in those batches that are incorrectly in_transit
$badBoxes = Box::whereIn('batch_id', $unsailedBatchIds)
    ->where('status', BoxStatus::InTransit->value)
    ->get();

echo "Found {$badBoxes->count()} boxes incorrectly in_transit in unsailed batches." . PHP_EOL;

foreach ($badBoxes as $box) {
    echo "  Fixing: {$box->tracking_number} (batch_id={$box->batch_id}) -> received_by_branch" . PHP_EOL;

    // Use forceFill + saveQuietly to bypass the status transition validation
    $box->forceFill(['status' => BoxStatus::ReceivedByWarehouse->value])->saveQuietly();

    // Add a tracking history entry
    BoxUpdate::create([
        'box_id' => $box->id,
        'status' => BoxStatus::ReceivedByWarehouse->value,
        'tracking_phase' => 'received_by_branch',
        'location' => 'Origin',
        'description' => 'Status corrected: box in unsailed batch should not be in_transit.',
        'updated_by' => null,
    ]);
}

echo "Done. Fixed {$badBoxes->count()} boxes." . PHP_EOL;
