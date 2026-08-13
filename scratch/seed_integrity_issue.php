<?php

use App\Models\Booking;
use App\Models\Sender;
use App\Enums\BookingStatus;
use Illuminate\Support\Str;

// Ensure we have at least one sender
$sender = Sender::first();
if (!$sender) {
    echo "No sender found. Creating one...\n";
    $sender = Sender::create([
        'first_name' => 'John',
        'last_name' => 'Doe',
        'email' => 'john@example.com',
        'phone' => '1234567890',
        'address' => '123 Test St',
    ]);
}

echo "Creating a 'broken' booking for data integrity testing...\n";

$booking = Booking::create([
    'sender_id' => $sender->id,
    'reference_number' => 'TEST-' . strtoupper(Str::random(6)),
    'status' => BookingStatus::Confirmed,
    'declaration_form_status' => 'missing',
    'total_boxes' => 1,
    'payment_status' => \App\Enums\PaymentStatus::Pending,
]);

echo "Created Booking: {$booking->reference_number} (ID: {$booking->id})\n";
echo "Status: {$booking->status->value}, Declaration: {$booking->declaration_form_status}\n";

echo "Running data integrity audit...\n";
Artisan::call('app:audit-data-integrity');

echo "Audit command output:\n";
echo Artisan::output();

echo "\nChecking for created warning...\n";
$warning = App\Models\DataIntegrityWarning::where('record_type', Booking::class)
    ->where('record_id', $booking->id)
    ->first();

if ($warning) {
    echo "SUCCESS: Warning created!\n";
    echo "Message: {$warning->message}\n";
    echo "Severity: {$warning->severity}\n";
} else {
    echo "FAILURE: No warning found.\n";
}
