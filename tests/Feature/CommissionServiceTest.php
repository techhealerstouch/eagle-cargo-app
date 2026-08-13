<?php

namespace Tests\Feature;

use App\Enums\CommissionStatus;
use App\Enums\CommissionType;
use App\Models\Box;
use App\Models\BoxType;
use App\Models\Commission;
use App\Models\User;
use App\Services\CommissionService;
use App\Services\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CommissionServiceTest extends TestCase
{
    use RefreshDatabase;

    private CommissionService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(CommissionService::class);
    }

    public function test_calculate_flat_rate()
    {
        $picker = User::factory()->create([
            'commission_type' => CommissionType::FLAT,
            'commission_rates' => ['flat' => 15.50],
        ]);
        $box = Box::factory()->create();

        $amount = $this->service->calculateForBox($box, $picker);
        $this->assertEquals(15.50, $amount);
    }

    public function test_calculate_size_based_rate()
    {
        $picker = User::factory()->create([
            'commission_type' => CommissionType::SIZE,
            'commission_rates' => [
                'sizes' => [
                    'Jumbo' => 20.00,
                    'Regular' => 15.00,
                    'default' => 10.00,
                ]
            ],
        ]);

        $jumboType = BoxType::factory()->create(['name' => 'Jumbo']);
        $regularType = BoxType::factory()->create(['name' => 'Regular']);
        $unknownType = BoxType::factory()->create(['name' => 'Unknown']);

        $jumboBox = Box::factory()->create(['box_type_id' => $jumboType->id]);
        $regularBox = Box::factory()->create(['box_type_id' => $regularType->id]);
        $unknownBox = Box::factory()->create(['box_type_id' => $unknownType->id]);

        $this->assertEquals(20.00, $this->service->calculateForBox($jumboBox, $picker));
        $this->assertEquals(15.00, $this->service->calculateForBox($regularBox, $picker));
        $this->assertEquals(10.00, $this->service->calculateForBox($unknownBox, $picker));
    }

    public function test_calculate_percentage_based_rate()
    {
        $picker = User::factory()->create([
            'commission_type' => CommissionType::PERCENTAGE,
            'commission_rates' => ['percentage' => 10], // 10%
        ]);

        // Box price doesn't have price_charged in factory, need to add it or fake it in DB if column exists, 
        // wait, does Box have declared_value or price_charged? Let's assume declared_value exists or set it directly.
        $box = Box::factory()->create();
        $box->declared_value = 150.00; // Mocking the value

        $amount = $this->service->calculateForBox($box, $picker);
        $this->assertEquals(15.00, $amount);
    }

    public function test_create_commission()
    {
        $picker = User::factory()->create([
            'commission_type' => CommissionType::FLAT,
            'commission_rates' => ['flat' => 25.00],
        ]);
        $box = Box::factory()->create();

        $commission = $this->service->createCommission($box, $picker);

        $this->assertNotNull($commission);
        $this->assertEquals($picker->id, $commission->picker_id);
        $this->assertEquals($box->id, $commission->box_id);
        $this->assertEquals(25.00, $commission->amount);
        $this->assertEquals(CommissionStatus::PENDING, $commission->status);

        $this->assertDatabaseHas('commissions', [
            'box_id' => $box->id,
            'picker_id' => $picker->id,
            'amount' => 25.00,
            'status' => CommissionStatus::PENDING->value,
        ]);
    }

    public function test_does_not_create_duplicate_commission()
    {
        $picker = User::factory()->create([
            'commission_type' => CommissionType::FLAT,
            'commission_rates' => ['flat' => 25.00],
        ]);
        $box = Box::factory()->create();

        // Create first time
        $this->service->createCommission($box, $picker);

        // Attempt second time
        $commission2 = $this->service->createCommission($box, $picker);

        $this->assertNull($commission2);
        $this->assertEquals(1, Commission::where('box_id', $box->id)->count());
    }

    public function test_does_not_create_zero_amount_commission()
    {
        $picker = User::factory()->create([
            'commission_type' => CommissionType::FLAT,
            'commission_rates' => ['flat' => 0],
        ]);
        $box = Box::factory()->create();

        $commission = $this->service->createCommission($box, $picker);

        $this->assertNull($commission);
        $this->assertDatabaseEmpty('commissions');
    }

    public function test_cancel_commission()
    {
        $picker = User::factory()->create([
            'commission_type' => CommissionType::FLAT,
            'commission_rates' => ['flat' => 15.00],
        ]);
        $box = Box::factory()->create();

        $this->service->createCommission($box, $picker);
        $this->assertDatabaseHas('commissions', [
            'box_id' => $box->id,
            'status' => CommissionStatus::PENDING->value,
        ]);

        $this->service->cancelCommission($box);

        $this->assertDatabaseHas('commissions', [
            'box_id' => $box->id,
            'status' => CommissionStatus::CANCELLED->value,
        ]);
    }

    public function test_cancel_paid_commission_creates_clawback()
    {
        $picker = User::factory()->create([
            'commission_type' => CommissionType::FLAT,
            'commission_rates' => ['flat' => 20.00],
        ]);
        $box = Box::factory()->create();

        $commission = $this->service->createCommission($box, $picker);
        $commission->update(['status' => CommissionStatus::PAID->value]);

        // Cancellation fee is 0 by default in tests unless set
        $this->service->cancelCommission($box);

        $this->assertDatabaseHas('commissions', [
            'box_id' => $box->id,
            'amount' => 20.00,
            'status' => CommissionStatus::PAID->value,
        ]);

        $this->assertDatabaseHas('commissions', [
            'box_id' => $box->id,
            'amount' => -20.00,
            'type' => 'clawback',
            'status' => CommissionStatus::PENDING->value,
        ]);
    }

    public function test_cancel_paid_commission_with_cancellation_fee()
    {
        $settings = app(SettingsService::class);
        $settings->set('cancellation_flat_fee', 5.00);

        $picker = User::factory()->create([
            'commission_type' => CommissionType::FLAT,
            'commission_rates' => ['flat' => 20.00],
        ]);
        $box = Box::factory()->create();

        $commission = $this->service->createCommission($box, $picker);
        $commission->update(['status' => CommissionStatus::PAID->value]);

        $this->service->cancelCommission($box);

        // Clawback should be -20 + 5 = -15
        $this->assertDatabaseHas('commissions', [
            'box_id' => $box->id,
            'amount' => -15.00,
            'type' => 'clawback',
            'status' => CommissionStatus::PENDING->value,
        ]);
    }
}
