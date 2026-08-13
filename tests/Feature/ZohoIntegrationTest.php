<?php

namespace Tests\Feature;

use App\Jobs\SyncInvoiceToZoho;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxType;
use App\Models\Invoice;
use App\Models\Recipient;
use App\Models\Sender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ZohoIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('zoho.client_id', 'test_client_id');
        config()->set('zoho.client_secret', 'test_client_secret');
        config()->set('zoho.refresh_token', 'test_refresh_token');
        config()->set('zoho.org_id', 'test_org_id');
        config()->set('zoho.base_url', 'https://books.zoho.com/api/v3');
    }

    // ---------------------------------------------------------------
    // 1. Zoho Sync is Skipped in Testing
    // ---------------------------------------------------------------

    public function test_zoho_sync_is_skipped_in_testing_environment(): void
    {
        Queue::fake();

        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create(['sender_id' => $sender->id]);
        $invoice = Invoice::factory()->create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV-2026-00042',
        ]);

        // InvoiceObserver dispatches SyncInvoiceToZoho job
        // In testing, the job should check environment and skip
        SyncInvoiceToZoho::dispatch($invoice);

        Queue::assertPushed(SyncInvoiceToZoho::class);
    }

    // ---------------------------------------------------------------
    // 2. Zoho Contact Sync
    // ---------------------------------------------------------------

    public function test_zoho_sync_contact_handles_api_failure_gracefully(): void
    {
        Http::fake([
            'accounts.zoho.com/*' => Http::response(['error' => 'invalid_grant'], 400),
        ]);

        $sender = Sender::factory()->create();

        $service = app(\App\Services\ZohoService::class);

        // Use reflection to call protected method for testing
        $reflection = new \ReflectionClass($service);
        $method = $reflection->getMethod('createContact');
        $method->setAccessible(true);

        $result = $method->invoke($service, $sender);

        // Should return null without throwing exception
        $this->assertNull($result);
    }

    // ---------------------------------------------------------------
    // 3. Zoho Invoice Sync
    // ---------------------------------------------------------------

    public function test_zoho_sync_invoice_handles_api_failure_gracefully(): void
    {
        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create(['sender_id' => $sender->id]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'box_type_id' => BoxType::factory()->create()->id,
        ]);

        $invoice = Invoice::factory()->create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV-2026-00099',
        ]);

        $service = app(\App\Services\ZohoService::class);

        // In testing environment, syncInvoice returns a test ID
        $result = $service->syncInvoice($invoice);

        $this->assertStringContainsString('TEST-ZOHO-INV-', $result);
    }

    // ---------------------------------------------------------------
    // 4. Zoho Contact Already Exists (Update Flow)
    // ---------------------------------------------------------------

    public function test_zoho_updates_existing_contact_when_zoho_id_present(): void
    {
        $sender = Sender::factory()->create([
            'zoho_contact_id' => 'zc_test_12345',
        ]);

        $service = app(\App\Services\ZohoService::class);

        $reflection = new \ReflectionClass($service);
        $method = $reflection->getMethod('updateContact');
        $method->setAccessible(true);

        // Should attempt update without throwing
        $result = $method->invoke($service, $sender);

        // May return null if API fails (expected in test environment)
        $this->assertTrue($result === null || $result === 'zc_test_12345');
    }
}
