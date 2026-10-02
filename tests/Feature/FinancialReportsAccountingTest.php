<?php

namespace Tests\Feature;

use App\Enums\CommissionStatus;
use App\Enums\InvoiceStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Commission;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class FinancialReportsAccountingTest extends TestCase
{
    use DatabaseTransactions;

    protected function createAdmin(): User
    {
        return User::factory()->create([
            'role' => Role::Admin,
            'email_verified_at' => now(),
        ]);
    }

    public function test_financial_dashboard_properly_reconciles_settled_and_unconfirmed_cash(): void
    {
        $admin = $this->createAdmin();

        /** @var User $courier */
        $courier = User::factory()->create([
            'role' => Role::Courier,
            'name' => 'Test Courier Driver',
        ]);

        $booking = Booking::factory()->create();

        // Invoice: $1,000.00
        $invoice = Invoice::factory()->create([
            'booking_id' => $booking->id,
            'amount' => 1000.00,
            'status' => InvoiceStatus::Partial,
            'due_date' => now()->subDays(5),
            'created_at' => now()->startOfMonth()->addDays(2),
        ]);

        // Settled Bank Transfer payment: $400.00
        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 400.00,
            'payment_method' => 'bank_transfer',
            'is_cash_payment' => false,
            'paid_at' => now()->startOfMonth()->addDays(3),
        ]);

        // Unconfirmed Cash payment in transit: $300.00
        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 300.00,
            'payment_method' => 'cash',
            'is_cash_payment' => true,
            'collected_by' => $courier->id,
            'paid_at' => now()->startOfMonth()->addDays(4),
            'confirmed_at' => null, // In transit!
        ]);

        // Confirmed Cash payment: $150.00
        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 150.00,
            'payment_method' => 'cash',
            'is_cash_payment' => true,
            'collected_by' => $courier->id,
            'paid_at' => now()->startOfMonth()->addDays(5),
            'confirmed_at' => now()->startOfMonth()->addDays(5),
            'confirmed_by' => $admin->id,
        ]);

        $response = $this->actingAs($admin)
            ->get(route('admin.reports.financial', [
                'start_date' => now()->startOfMonth()->toDateString(),
                'end_date' => now()->endOfMonth()->toDateString(),
            ]));

        $response->assertStatus(200);

        $response->assertInertia(fn (Assert $page) => $page
            ->component('admin/reports/financial')
            // Settled collections must be $400 (bank) + $150 (confirmed cash) = $550.00
            ->where('stats.total_collected', 550)
            // Unconfirmed cash in transit must be $300.00
            ->where('stats.unconfirmed_cash', 300)
            // Outstanding amount must only deduct settled collections: $1,000 - $550 = $450.00 (NOT $150!)
            ->where('stats.outstanding_amount', 450)
            // Courier float breakdown should list courier with $150 confirmed, $300 unconfirmed
            ->has('stats.courier_cash_collections', 1, fn (Assert $item) => $item
                ->where('collector_id', $courier->id)
                ->where('confirmed_total', 150)
                ->where('unconfirmed_total', 300)
                ->where('total', 450)
                ->etc()
            )
            ->etc()
        );
    }

    public function test_historical_point_in_time_aging_evaluates_against_reference_end_date(): void
    {
        $admin = $this->createAdmin();

        $booking = Booking::factory()->create();

        // Invoice due on Jan 20, 2025 (11 days overdue as of Jan 31, 2025)
        Invoice::factory()->create([
            'booking_id' => $booking->id,
            'amount' => 500.00,
            'status' => InvoiceStatus::Unpaid,
            'due_date' => '2025-01-20',
            'created_at' => '2025-01-10',
        ]);

        $response = $this->actingAs($admin)
            ->get(route('admin.reports.financial', [
                'start_date' => '2025-01-01',
                'end_date' => '2025-01-31',
            ]));

        $response->assertStatus(200);

        $response->assertInertia(fn (Assert $page) => $page
            ->component('admin/reports/financial')
            // 11 days overdue relative to Jan 31, 2025 falls into overdue_30 bucket
            ->where('stats.aging_buckets.overdue_30', 500)
            ->where('stats.aging_buckets.overdue_60', 0)
            ->where('stats.aging_buckets.overdue_90_plus', 0)
            ->where('stats.aging_buckets.current', 0)
            ->where('stats.reference_date', '2025-01-31')
            ->etc()
        );
    }

    public function test_commissions_and_clawbacks_normalize_properly(): void
    {
        $admin = $this->createAdmin();

        $startDate = now()->startOfMonth();
        $endDate = now()->endOfMonth();

        $box = Box::factory()->create();

        Commission::create([
            'picker_id' => $admin->id,
            'box_id' => $box->id,
            'amount' => 250.00,
            'type' => 'pickup',
            'status' => CommissionStatus::PAID->value,
            'created_at' => now()->startOfMonth()->addDay(),
        ]);

        Commission::create([
            'picker_id' => $admin->id,
            'box_id' => $box->id,
            'amount' => -50.00, // Negative or positive clawback amount in database
            'type' => 'clawback',
            'status' => CommissionStatus::PAID->value,
            'created_at' => now()->startOfMonth()->addDays(2),
        ]);

        $response = $this->actingAs($admin)
            ->get(route('admin.reports.financial', [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
            ]));

        $response->assertStatus(200);

        $response->assertInertia(fn (Assert $page) => $page
            ->component('admin/reports/financial')
            ->where('stats.total_commissions', 250)
            ->where('stats.total_clawbacks', 50)
            ->where('stats.net_commissions', 200) // 250 - 50 = 200
            ->etc()
        );
    }

    public function test_csv_export_contains_reconciliation_sections(): void
    {
        $admin = $this->createAdmin();

        $booking = Booking::factory()->create();
        $invoice = Invoice::factory()->create([
            'booking_id' => $booking->id,
            'amount' => 500.00,
            'status' => InvoiceStatus::Partial,
            'created_at' => now(),
        ]);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 200.00,
            'payment_method' => 'cash',
            'is_cash_payment' => true,
            'collected_by' => $admin->id,
            'paid_at' => now(),
            'confirmed_at' => null, // in-transit
        ]);

        $response = $this->actingAs($admin)
            ->get(route('admin.reports.financial.csv', [
                'start_date' => now()->startOfMonth()->toDateString(),
                'end_date' => now()->endOfMonth()->toDateString(),
            ]));

        $response->assertStatus(200);
        $content = $response->streamedContent();

        $this->assertStringContainsString('Total Settled Collections', $content);
        $this->assertStringContainsString('Period Unconfirmed Cash', $content);
        $this->assertStringContainsString('--- COURIER CASH COLLECTIONS & IN-TRANSIT FLOAT ---', $content);
        $this->assertStringContainsString('--- RECEIVABLES AGING BREAKDOWN', $content);
    }

    public function test_pdf_export_renders_successfully_with_reconciliation_data(): void
    {
        $admin = $this->createAdmin();

        $booking = Booking::factory()->create();
        $invoice = Invoice::factory()->create([
            'booking_id' => $booking->id,
            'amount' => 500.00,
            'status' => InvoiceStatus::Partial,
            'created_at' => now(),
        ]);

        Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 200.00,
            'payment_method' => 'cash',
            'is_cash_payment' => true,
            'collected_by' => $admin->id,
            'paid_at' => now(),
            'confirmed_at' => null,
        ]);

        $response = $this->actingAs($admin)
            ->get(route('admin.reports.financial.pdf', [
                'start_date' => now()->startOfMonth()->toDateString(),
                'end_date' => now()->endOfMonth()->toDateString(),
            ]));

        $response->assertStatus(200);
        $this->assertEquals('application/pdf', $response->headers->get('content-type'));
    }
}
