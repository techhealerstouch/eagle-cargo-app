<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Booking;
use App\Models\Box;
use App\Services\SettingsService;
use Barryvdh\DomPDF\Facade\Pdf;

// Create a mock booking structure with 1 box
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
$box = new Box();
$box->id = 1;
$box->tracking_number = "TRK-001";
$box->recipient = (object)[
    'name' => "Recipient 1",
    'address' => "Address 1",
    'city' => "City 1",
    'province' => "Province 1",
    'zip_code' => "1001",
    'phone_number' => "09123456",
    'email' => "recipient1@example.com"
];
$box->boxType = (object)['name' => 'Jumbo'];
$boxes->push($box);

$items = [];
for ($j = 0; $j < 15; $j++) {
    $items[] = [
        'qty' => $j + 1,
        'name' => "Item $j",
        'category' => 'Clothing',
        'value' => 10.5 * ($j + 1)
    ];
}

$declaration_boxes = [
    [
        'id' => $box->id,
        'tracking_number' => $box->tracking_number,
        'items' => $items
    ]
];

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

try {
    $startTime = microtime(true);
    $pdf = Pdf::loadView('declaration-blank', compact('booking', 'boxes', 'boxCount', 'declarationSettings'))
        ->setPaper('a4', 'portrait');
    file_put_contents('scratch/test.pdf', $pdf->output());
    $endTime = microtime(true);
    echo "Generated $boxCount page in " . ($endTime - $startTime) . " seconds\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
