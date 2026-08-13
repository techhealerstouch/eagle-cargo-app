<?php

namespace Tests\Feature\Warehouse;

use App\Enums\BoxStatus;
use App\Models\Box;
use App\Models\BoxType;
use App\Models\Booking;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BulgingBoxTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $warehouseUser;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->admin = User::factory()->create(['role' => 'admin']);
        $this->warehouseUser = User::factory()->create(['role' => 'warehouse']);
    }

    public function test_warehouse_intake_flags_bulging_box_and_adds_surcharge()
    {
        $this->withoutExceptionHandling();
        $this->withoutMiddleware();
        
        // 1. Setup a BoxType with standard dimensions (e.g., 50x50x50 cm = 0.125 CBM)
        $boxType = BoxType::factory()->create([
            'dimensions' => '50x50x50',
        ]);
        
        $booking = Booking::factory()->create();
        
        // 2. Setup a Box with normal physicals and price
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'box_type_id' => $boxType->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'price_charged' => 5000.00,
            'is_bulging' => false,
            'oversized_surcharge' => 0.00,
        ]);
        
        // 3. Generate an initial invoice
        $invoice = Invoice::generateForBooking($booking);
        $initialAmount = $invoice->amount;
        
        // Assert base amount equals box price
        $this->assertEquals(5000.00, $initialAmount);

        // 4. Warehouse scans and updates actual_cbm to an oversized value (e.g. 0.150 CBM)
        $oversizedCbm = 0.150;
        
        $response = $this->actingAs($this->warehouseUser)->post(route('warehouse.update-physicals'), [
            'tracking_number' => $box->tracking_number,
            'actual_cbm' => $oversizedCbm,
        ]);
        
        $response->assertSessionHasNoErrors();
        $response->assertSessionHas('success');
        $response->assertSessionMissing('error');
        
        // 5. Verify the box is flagged as bulging and status transitioned to HeldBulging
        $box->refresh();
        $this->assertTrue($box->is_bulging);
        $this->assertEquals(BoxStatus::HeldBulging, $box->status);
        
        // Verify oversized surcharge logic: (0.150 - 0.125) * 5000 = 0.025 * 5000 = 125
        $expectedSurcharge = 125.00;
        $this->assertEquals($expectedSurcharge, $box->oversized_surcharge);
        
        // 6. Verify the invoice total is updated
        $invoice->refresh();
        // Base amount should now be 5000 (base box) + 125 (oversized surcharge) = 5125
        $this->assertEquals(5125.00, $invoice->amount);
    }
    
    public function test_warehouse_intake_does_not_flag_normal_box()
    {
        $this->withoutExceptionHandling();
        $this->withoutMiddleware();
        
        $boxType = BoxType::factory()->create([
            'dimensions' => '50x50x50', // 0.125 CBM
        ]);
        
        $booking = Booking::factory()->create();
        
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'box_type_id' => $boxType->id,
            'status' => BoxStatus::ReceivedByWarehouse,
            'price_charged' => 5000.00,
        ]);
        
        // Actual CBM is exactly standard
        $response = $this->actingAs($this->warehouseUser)->post(route('warehouse.update-physicals'), [
            'tracking_number' => $box->tracking_number,
            'actual_cbm' => 0.125,
        ]);
        
        $response->assertSessionHasNoErrors();
        
        $box->refresh();
        $this->assertFalse($box->is_bulging);
        $this->assertEquals(BoxStatus::ReceivedByWarehouse, $box->status);
        $this->assertEquals(0.00, $box->oversized_surcharge);
    }
}
