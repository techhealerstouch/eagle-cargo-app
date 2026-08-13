<?php

namespace Tests\Feature\Admin;

use App\Enums\CommissionStatus;
use App\Enums\PayoutMethod;
use App\Enums\Role;
use App\Models\Box;
use App\Models\Commission;
use App\Models\Payout;
use App\Models\User;
use App\Services\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommissionPayoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_stripe_transfer_failure_redirects_with_error_and_rolls_back_payout(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        $picker = User::factory()->create([
            'role' => Role::Picker,
            'stripe_account_id' => 'acct_test_picker',
            'stripe_onboarding_completed' => true,
        ]);
        $box = Box::factory()->create();
        $commission = Commission::create([
            'picker_id' => $picker->id,
            'box_id' => $box->id,
            'amount' => 51.00,
            'status' => CommissionStatus::PENDING->value,
        ]);

        $this->mock(PaymentService::class, function ($mock): void {
            $mock->shouldReceive('transferToConnectedAccount')
                ->once()
                ->andThrow(new \Exception('You have insufficient available funds in your Stripe account.'));
        });

        $this->actingAs($admin)
            ->post(route('admin.commissions.process-payout', $picker), [
                'payout_method' => PayoutMethod::Stripe->value,
                'reference_number' => null,
            ])
            ->assertRedirect()
            ->assertSessionHas('error', fn (string $message): bool => str_contains($message, 'insufficient available balance'));

        $this->assertDatabaseCount('payouts', 0);
        $this->assertDatabaseHas('commissions', [
            'id' => $commission->id,
            'status' => CommissionStatus::PENDING->value,
            'payout_id' => null,
        ]);
    }

    public function test_cash_payout_without_stripe_marks_commissions_paid(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        $picker = User::factory()->create(['role' => Role::Picker]);
        $box = Box::factory()->create();
        $commission = Commission::create([
            'picker_id' => $picker->id,
            'box_id' => $box->id,
            'amount' => 25.00,
            'status' => CommissionStatus::PENDING->value,
        ]);

        $this->actingAs($admin)
            ->post(route('admin.commissions.process-payout', $picker), [
                'payout_method' => PayoutMethod::Cash->value,
                'reference_number' => 'CASH-123',
            ])
            ->assertRedirect()
            ->assertSessionHas('success', 'Payout processed successfully.');

        $payout = Payout::query()->sole();
        $this->assertSame($picker->id, $payout->picker_id);
        $this->assertSame('25.00', $payout->total_amount);
        $this->assertSame(PayoutMethod::Cash->value, $payout->payout_method);
        $this->assertNull($payout->payout_provider);
        $this->assertSame('CASH-123', $payout->reference_number);

        $this->assertDatabaseHas('commissions', [
            'id' => $commission->id,
            'status' => CommissionStatus::PAID->value,
            'payout_id' => $payout->id,
        ]);
    }

    public function test_ewallet_payout_records_provider_and_reference(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        $picker = User::factory()->create(['role' => Role::Picker]);
        $box = Box::factory()->create();
        $commission = Commission::create([
            'picker_id' => $picker->id,
            'box_id' => $box->id,
            'amount' => 33.50,
            'status' => CommissionStatus::PENDING->value,
        ]);

        $this->actingAs($admin)
            ->post(route('admin.commissions.process-payout', $picker), [
                'payout_method' => PayoutMethod::Ewallet->value,
                'payout_provider' => 'GCash',
                'reference_number' => 'GCASH-987',
            ])
            ->assertRedirect()
            ->assertSessionHas('success', 'Payout processed successfully.');

        $payout = Payout::query()->sole();
        $this->assertSame('33.50', $payout->total_amount);
        $this->assertSame(PayoutMethod::Ewallet->value, $payout->payout_method);
        $this->assertSame('GCash', $payout->payout_provider);
        $this->assertSame('GCASH-987', $payout->reference_number);

        $this->assertDatabaseHas('commissions', [
            'id' => $commission->id,
            'status' => CommissionStatus::PAID->value,
            'payout_id' => $payout->id,
        ]);
    }
}
