<?php

namespace Tests\Feature\Admin;

use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Models\Area;
use App\Models\Box;
use App\Models\Recipient;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BoxBulkUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_bulk_update_specific_boxes_status(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);

        $box1 = Box::factory()->create(['status' => BoxStatus::Pending]);
        $box2 = Box::factory()->create(['status' => BoxStatus::Pending]);
        $box3 = Box::factory()->create(['status' => BoxStatus::Pending]);

        $response = $this->actingAs($admin)->post('/admin/boxes/bulk-update-status', [
            'ids' => [$box1->id, $box2->id],
            'select_all' => false,
            'status' => BoxStatus::Collected->value,
        ]);

        $response->assertRedirect('/admin/boxes');
        $response->assertSessionHas('success');

        $this->assertEquals(BoxStatus::Collected, $box1->fresh()->status);
        $this->assertEquals(BoxStatus::Collected, $box2->fresh()->status);
        $this->assertEquals(BoxStatus::Pending, $box3->fresh()->status); // Should remain untouched
    }

    public function test_admin_can_bulk_update_boxes_filtered_by_area(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin]);

        $manilaArea = Area::factory()->create(['name' => 'Metro Manila']);
        $cebuArea = Area::factory()->create(['name' => 'Cebu']);

        $recipientManila1 = Recipient::factory()->create(['area_id' => $manilaArea->id]);
        $recipientManila2 = Recipient::factory()->create(['area_id' => $manilaArea->id]);
        $recipientCebu = Recipient::factory()->create(['area_id' => $cebuArea->id]);

        $box1 = Box::factory()->create(['status' => BoxStatus::Pending, 'recipient_id' => $recipientManila1->id]);
        $box2 = Box::factory()->create(['status' => BoxStatus::Pending, 'recipient_id' => $recipientManila2->id]);
        $box3 = Box::factory()->create(['status' => BoxStatus::Pending, 'recipient_id' => $recipientCebu->id]);

        // Bulk update using "select_all" and applying "area_id" filter
        $response = $this->actingAs($admin)->post('/admin/boxes/bulk-update-status', [
            'ids' => [], 
            'select_all' => true,
            'status' => BoxStatus::Collected->value,
            'area_id' => $manilaArea->id,
        ]);

        $response->assertRedirect('/admin/boxes');
        $response->assertSessionHas('success');

        $this->assertEquals(BoxStatus::Collected, $box1->fresh()->status);
        $this->assertEquals(BoxStatus::Collected, $box2->fresh()->status);
        $this->assertEquals(BoxStatus::Pending, $box3->fresh()->status); // Should remain untouched as it is in Cebu
    }
}
