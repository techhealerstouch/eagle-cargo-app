<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Booking;
use App\Models\Box;
use App\Services\SettingsService;
use Barryvdh\DomPDF\Facade\Pdf;

// Create a mock booking structure
$booking = new Booking();
$booking->reference_number = 'BK-TEST-001';
$booking->preferred_date = now()->addDays(5);
$booking->sender = (object)[
    'first_name' => 'Sender',
    'last_name' => 'User',
    'address' => '123 Fake St',
    'suburb' => 'Arundel',
    'state' => 'QLD',
    'postcode' => '4214',
    'mobile' => '0412345678',
    'email' => 'sender@example.com'
];

$boxes = collect();
for ($i = 1; $i <= 20; $i++) {
    $box = new Box();
    $box->id = $i;
    $box->tracking_number = "TRK-00$i";
    $box->recipient = (object)[
        'name' => "Recipient $i",
        'address' => "Address $i",
        'city' => "City $i",
        'province' => "Province $i",
        'zip_code' => "100$i",
        'phone_number' => "09123456$i",
        'email' => "recipient$i@example.com"
    ];
    $box->boxType = (object)['name' => 'Jumbo'];
    $boxes->push($box);
}

$items = [];
for ($j = 0; $j < 15; $j++) {
    $items[] = [
        'qty' => $j + 1,
        'name' => "Item $j",
        'category' => 'Clothing',
        'value' => 10.5 * ($j + 1)
    ];
}

$declaration_boxes = [];
foreach ($boxes as $box) {
    $declaration_boxes[] = [
        'id' => $box->id,
        'tracking_number' => $box->tracking_number,
        'items' => $items
    ];
}

$booking->declaration_data = [
    'boxes' => $declaration_boxes,
    'certification' => [
        'date' => now()->format('Y-m-d'),
        'signed_by' => 'Sender User',
        'signature' => null
    ]
];

$boxCount = $boxes->count();
$settingsService = app(SettingsService::class);
$declarationSettings = $settingsService->getDeclarationSettings();
// TEMPORARILY REMOVE TERMS TO TEST SPEED
unset($declarationSettings['terms']);

try {
    $startTime = microtime(true);
    $pdf = Pdf::loadView('declaration-blank', compact('booking', 'boxes', 'boxCount', 'declarationSettings'))
        ->setPaper('a4', 'portrait');
    $output = $pdf->output();
    $endTime = microtime(true);
    echo "Generated $boxCount pages (WITHOUT TERMS) in " . ($endTime - $startTime) . " seconds\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
