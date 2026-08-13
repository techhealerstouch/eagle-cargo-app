<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Models\Area;
use App\Models\BoxPrice;
use App\Models\Recipient;
use App\Models\Sender;
use App\Models\Suburb;
use App\Models\User;
use App\Models\BoxType;
use App\Models\PickupZone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AreaAndSuburbDeletionTest extends TestCase
{
    use RefreshDatabase;

    protected $admin;

    protected function setUp(): void
    {
        parent::setUp();
        
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
        $this->admin = User::factory()->create(['role' => Role::SuperAdmin]);
    }

    #[Test]
    public function it_prevents_deletion_of_area_linked_to_box_prices()
    {
        $area = Area::factory()->create();
        $boxType = BoxType::factory()->create();
        $pickupZone = PickupZone::factory()->create();
        
        BoxPrice::factory()->create([
            'area_id' => $area->id,
            'box_type_id' => $boxType->id,
            'pickup_zone_id' => $pickupZone->id,
        ]);

        $response = $this->actingAs($this->admin)->delete(route('admin.areas.destroy', $area));

        $response->assertRedirect(route('admin.areas.index'));
        $response->assertSessionHas('error', 'Cannot delete Area because it is linked to existing BoxPrice lookup tables. We recommend deactivation instead.');
        
        $this->assertDatabaseHas('areas', ['id' => $area->id]);
    }

    #[Test]
    public function it_prevents_deletion_of_area_linked_to_recipients()
    {
        $area = Area::factory()->create();
        
        Recipient::factory()->create(['area_id' => $area->id]);

        $response = $this->actingAs($this->admin)->delete(route('admin.areas.destroy', $area));

        $response->assertRedirect(route('admin.areas.index'));
        $response->assertSessionHas('error', 'Cannot delete Area because it is linked to active bookings. We recommend deactivation instead.');
        
        $this->assertDatabaseHas('areas', ['id' => $area->id]);
    }

    #[Test]
    public function it_allows_deletion_of_unlinked_area()
    {
        $area = Area::factory()->create();

        $response = $this->actingAs($this->admin)->delete(route('admin.areas.destroy', $area));

        $response->assertRedirect(route('admin.areas.index'));
        $response->assertSessionHas('success', 'Area deleted successfully.');
        
        $this->assertSoftDeleted('areas', ['id' => $area->id]);
    }

    #[Test]
    public function it_prevents_deletion_of_suburb_linked_to_sender()
    {
        $suburb = Suburb::factory()->create(['name' => 'Quezon City']);
        
        Sender::factory()->create(['suburb' => 'Quezon City']);

        $response = $this->actingAs($this->admin)->delete(route('admin.suburbs.destroy', $suburb));

        $response->assertRedirect();
        $response->assertSessionHas('error', 'Cannot delete Suburb because it is linked to active senders/bookings. We recommend deactivation instead.');
        
        $this->assertDatabaseHas('suburbs', ['id' => $suburb->id]);
    }

    #[Test]
    public function it_allows_deletion_of_unlinked_suburb()
    {
        $suburb = Suburb::factory()->create();

        $response = $this->actingAs($this->admin)->delete(route('admin.suburbs.destroy', $suburb));

        $response->assertRedirect();
        $response->assertSessionHas('success', 'Suburb deleted successfully.');
        
        $this->assertDatabaseMissing('suburbs', ['id' => $suburb->id]);
    }
}
