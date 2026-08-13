<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Area;
use App\Models\AreaMilestone;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReferenceDataCrudTest extends TestCase
{
    use RefreshDatabase;

    protected function createAdmin(): User
    {
        return User::factory()->create([
            'role' => Role::Admin,
            'email_verified_at' => now(),
        ]);
    }

    // ---------------------------------------------------------------
    // 1. Areas CRUD
    // ---------------------------------------------------------------

    public function test_admin_can_create_area(): void
    {
        $admin = $this->createAdmin();

        $response = $this->withoutMiddleware()
            ->actingAs($admin)
            ->post(route('admin.areas.store'), [
                'name' => 'Unique Custom Area',
                'door_to_door_fee' => 150.00,
                'is_active' => true,
            ]);

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('areas', [
            'name' => 'Unique Custom Area',
            'door_to_door_fee' => '150.00',
        ]);
    }

    public function test_admin_can_update_area(): void
    {
        $admin = $this->createAdmin();
        $area = Area::factory()->create(['name' => 'Old Name']);

        $response = $this->actingAs($admin)
            ->put(route('admin.areas.update', $area), [
                'name' => 'New Name',
                'is_active' => true,
            ]);

        $response->assertSessionHasNoErrors();
        $this->assertEquals('New Name', $area->fresh()->name);
    }

    public function test_admin_can_delete_area(): void
    {
        $admin = $this->createAdmin();
        $area = Area::factory()->create();

        $response = $this->actingAs($admin)
            ->delete(route('admin.areas.destroy', $area));

        $response->assertSessionHasNoErrors();
        $this->assertSoftDeleted($area);
    }

    public function test_admin_can_list_areas(): void
    {
        $admin = $this->createAdmin();
        Area::factory()->count(5)->create();

        $response = $this->actingAs($admin)
            ->get(route('admin.areas.index'));

        $response->assertStatus(200);
    }

    // ---------------------------------------------------------------
    // 2. Box Types CRUD
    // ---------------------------------------------------------------

    public function test_admin_can_create_box_type(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)
            ->post(route('admin.box-types.store'), [
                'name' => 'Jumbo',
                'dimensions' => '24x24x24',
                'is_active' => true,
            ]);

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('box_types', ['name' => 'Jumbo']);
    }

    public function test_admin_can_update_box_type(): void
    {
        $admin = $this->createAdmin();
        $boxType = BoxType::factory()->create(['name' => 'Regular']);

        $response = $this->actingAs($admin)
            ->put(route('admin.box-types.update', $boxType), [
                'name' => 'Large',
                'dimensions' => '30x30x30',
                'is_active' => true,
            ]);

        $response->assertSessionHasNoErrors();
        $this->assertEquals('Large', $boxType->fresh()->name);
    }

    public function test_admin_can_delete_box_type(): void
    {
        $admin = $this->createAdmin();
        $boxType = BoxType::factory()->create();

        $response = $this->actingAs($admin)
            ->delete(route('admin.box-types.destroy', $boxType));

        $response->assertSessionHasNoErrors();
        $this->assertSoftDeleted($boxType);
    }

    // ---------------------------------------------------------------
    // 3. Box Prices CRUD
    // ---------------------------------------------------------------

    public function test_admin_can_create_box_price(): void
    {
        $admin = $this->createAdmin();
        $area = Area::factory()->create();
        $boxType = BoxType::factory()->create();

        $response = $this->actingAs($admin)
            ->post(route('admin.box-prices.store'), [
                'area_id' => $area->id,
                'box_type_id' => $boxType->id,
                'price' => 150.00,
            ]);

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('box_prices', [
            'area_id' => $area->id,
            'box_type_id' => $boxType->id,
            'price' => 150.00,
        ]);
    }

    public function test_admin_can_update_box_price(): void
    {
        $admin = $this->createAdmin();
        $area = Area::factory()->create();
        $boxType = BoxType::factory()->create();
        $boxPrice = BoxPrice::create([
            'area_id' => $area->id,
            'box_type_id' => $boxType->id,
            'price' => 100.00,
        ]);

        $response = $this->actingAs($admin)
            ->put(route('admin.box-prices.update', $boxPrice), [
                'area_id' => $area->id,
                'box_type_id' => $boxType->id,
                'price' => 200.00,
            ]);

        $response->assertSessionHasNoErrors();
        $this->assertEqualsWithDelta(200.00, (float) $boxPrice->fresh()->price, 0.01);
    }

    // ---------------------------------------------------------------
    // 4. Area Milestones CRUD
    // ---------------------------------------------------------------

    public function test_admin_can_create_area_milestone(): void
    {
        $admin = $this->createAdmin();
        $area = Area::factory()->create();

        $response = $this->actingAs($admin)
            ->post(route('admin.areas.milestones.store', $area), [
                'name' => 'Warehouse Handoff',
                'description' => 'Boxes moved to loading bay',
                'is_warehouse_handoff' => true,
            ]);

        $response->assertSessionHasNoErrors();
        $this->assertDatabaseHas('area_milestones', [
            'area_id' => $area->id,
            'name' => 'Warehouse Handoff',
        ]);
    }

    // ---------------------------------------------------------------
    // 5. Authorization
    // ---------------------------------------------------------------

    public function test_sender_cannot_access_area_crud(): void
    {
        /** @var User $sender */
        $sender = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($sender)
            ->get(route('admin.areas.index'));

        $response->assertStatus(403);
    }

    public function test_sender_cannot_create_area(): void
    {
        /** @var User $sender */
        $sender = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($sender)
            ->post(route('admin.areas.store'), [
                'name' => 'Hacked Area',
                'is_active' => true,
            ]);

        $response->assertStatus(403);
    }
}
