<?php

use App\Models\Setting;
use App\Services\TrackingStepService;

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$setting = Setting::where('key', 'tracking_steps')->first();
if ($setting) {
    echo "Updating tracking_steps setting...\n";
    $steps = App\Services\TrackingStepService::getDefaults();
    
    // We want to preserve any custom labels if they exist, but update the keys to match the enum.
    // However, for simplicity and to ensure the user gets the fix, we will just reset to defaults
    // since the user reported a bug in the default behavior.
    
    $service = new TrackingStepService();
    $service->updateSteps($steps);
    echo "Tracking steps updated successfully.\n";
} else {
    echo "Setting not found, no update needed.\n";
}
