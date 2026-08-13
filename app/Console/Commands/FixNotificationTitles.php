<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FixNotificationTitles extends Command
{
    protected $signature = 'app:fix-notification-titles';

    protected $description = 'Backfill title and message fields on existing notifications that are missing them';

    public function handle(): int
    {
        $this->info('Fixing BookingStatusChanged notifications...');
        $bookingNotifications = DB::table('notifications')
            ->where('type', 'App\\Notifications\\BookingStatusChanged')
            ->get();

        $bookingCount = 0;
        foreach ($bookingNotifications as $notification) {
            $data = json_decode($notification->data, true);

            if (! isset($data['title'])) {
                $statusLabel = ucfirst(str_replace('_', ' ', $data['status'] ?? 'Updated'));
                $reference = $data['reference'] ?? 'N/A';

                $data['type'] = 'booking';
                $data['status_label'] = $statusLabel;
                $data['title'] = "Booking {$statusLabel}";
                $data['message'] = "Your booking {$reference} status has been updated to {$statusLabel}.";
                $data['url'] = $data['url'] ?? "/tracking/{$reference}";

                DB::table('notifications')
                    ->where('id', $notification->id)
                    ->update(['data' => json_encode($data)]);

                $bookingCount++;
            }
        }
        $this->info("  Updated {$bookingCount} BookingStatusChanged notifications.");

        $this->info('Fixing BookingPaymentReceived notifications...');
        $paymentNotifications = DB::table('notifications')
            ->where('type', 'App\\Notifications\\BookingPaymentReceived')
            ->get();

        $paymentCount = 0;
        foreach ($paymentNotifications as $notification) {
            $data = json_decode($notification->data, true);

            if (! isset($data['title'])) {
                $reference = $data['reference'] ?? 'N/A';
                $invoiceNumber = $data['invoice_number'] ?? 'N/A';

                $data['type'] = 'payment';
                $data['title'] = 'Payment Received';
                $data['message'] = "Payment received for booking {$reference} (Invoice {$invoiceNumber}).";
                $data['url'] = $data['url'] ?? '/bookings';

                DB::table('notifications')
                    ->where('id', $notification->id)
                    ->update(['data' => json_encode($data)]);

                $paymentCount++;
            }
        }
        $this->info("  Updated {$paymentCount} BookingPaymentReceived notifications.");

        $this->info('Fixing BoxStatusChanged notifications without title...');
        $boxNotifications = DB::table('notifications')
            ->where('type', 'App\\Notifications\\BoxStatusChanged')
            ->get();

        $boxCount = 0;
        foreach ($boxNotifications as $notification) {
            $data = json_decode($notification->data, true);

            if (! isset($data['title'])) {
                $statusLabel = $data['status_label'] ?? ucfirst(str_replace('_', ' ', $data['status'] ?? 'Updated'));
                $data['title'] = "Box: {$statusLabel}";

                DB::table('notifications')
                    ->where('id', $notification->id)
                    ->update(['data' => json_encode($data)]);

                $boxCount++;
            }
        }
        $this->info("  Updated {$boxCount} BoxStatusChanged notifications.");

        $total = $bookingCount + $paymentCount + $boxCount;
        $this->info("Done! Fixed {$total} notifications total.");

        return self::SUCCESS;
    }
}
