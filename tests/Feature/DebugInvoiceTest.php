<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\Invoice;
use App\Models\Recipient;
use App\Models\Sender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class DebugInvoiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_debug_invoice_with_pending_first(): void
    {
        \App\Models\Setting::updateOrCreate(
            ['key' => 'invoice_settings'],
            [
                'value' => json_encode([
                    'taxRate' => 12,
                    'isVatInclusive' => false,
                ]),
                'type' => 'json',
                'group' => 'invoice',
                'display_name' => 'Invoice Settings',
            ]
        );

        Cache::flush();
        $area = Area::factory()->create(['name' => 'TestArea', 'is_active' => true]);
        $boxType = BoxType::factory()->create(['name' => 'Jumbo', 'is_active' => true]);
        BoxPrice::create(['area_id' => $area->id, 'box_type_id' => $boxType->id, 'price' => 150.00]);

        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => \App\Enums\PaymentStatus::Pending,
        ]);

        for ($i = 0; $i < 3; $i++) {
            $recipient = Recipient::factory()->create([
                'sender_id' => $sender->id,
                'area_id' => $area->id,
            ]);

            Box::factory()->create([
                'booking_id' => $booking->id,
                'recipient_id' => $recipient->id,
                'box_type_id' => $boxType->id,
                'price_charged' => 150.00,
                'status' => \App\Enums\BoxStatus::Pending,
            ]);
        }

        // Now transition to Confirmed
        $booking->update(['status' => BookingStatus::Confirmed]);
        $booking = $booking->fresh();

        $invoice = Invoice::generateForBooking($booking);

        dump([
            'invoice_amount' => (float) $invoice->amount,
            'vatable_revenue' => (float) $invoice->vatable_revenue,
            'vat_amount' => (float) $invoice->vat_amount,
            'vat_exempt_revenue' => (float) $invoice->vat_exempt_revenue,
            'is_vat_inclusive' => $invoice->is_vat_inclusive,
        ]);

        // Also test with 0.12 tax rate set properly
        $settingsService = app(\App\Services\SettingsService::class);
        $invoiceSettings = $settingsService->getInvoiceSettings();
        dump('taxRate from getInvoiceSettings: ' . $invoiceSettings['taxRate']);

        $this->assertGreaterThan(0, (float) $invoice->amount, 'Invoice amount should be > 0');
    }
}
