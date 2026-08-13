<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class BoxSerialNumberTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_box_has_null_serial_number(): void
    {
        $box = Box::factory()->create()->refresh();

        $this->assertNull($box->serial_number);
    }

    public function test_admin_can_search_boxes_by_serial_number(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin->value]);
        $box = Box::factory()->create(['serial_number' => '123456']);

        $this->actingAs($admin)
            ->get(route('admin.boxes.index', ['search' => $box->serial_number]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('boxes.data.0.id', $box->id)
                ->where('boxes.data.0.serial_number', $box->serial_number)
            );
    }

    public function test_picker_must_assign_serial_number_when_collecting_single_box(): void
    {
        Storage::fake('public');
        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $box = $this->createBoxForStatusUpdate($picker);

        // Try updating to Collected without serial number - should fail validation
        $this->actingAs($picker)
            ->put(route('picker.box.update', $box), [
                'status' => BoxStatus::Collected->value,
                'courier_notes' => 'Picked up.',
                'pickup_proof' => UploadedFile::fake()->image('pickup.jpg'),
            ])
            ->assertSessionHasErrors(['serial_number']);

        $this->assertNull($box->fresh()->serial_number);

        // Try with serial number - should succeed
        $this->actingAs($picker)
            ->put(route('picker.box.update', $box), [
                'status' => BoxStatus::Collected->value,
                'courier_notes' => 'Picked up.',
                'pickup_proof' => UploadedFile::fake()->image('pickup.jpg'),
                'serial_number' => 'NEW-UNIQUE-SERIAL',
            ])
            ->assertSessionHas('success');

        $this->assertEquals('NEW-UNIQUE-SERIAL', $box->fresh()->serial_number);
        $this->assertEquals(BoxStatus::Collected, $box->fresh()->status);
    }

    public function test_picker_cannot_assign_duplicate_serial_number_when_collecting_single_box(): void
    {
        Storage::fake('public');
        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $box1 = $this->createBoxForStatusUpdate($picker);
        $box2 = $this->createBoxForStatusUpdate($picker);

        // Seed box1 with a serial
        $box1->serial_number = 'DUPLICATE-SERIAL';
        $box1->save();

        // Try updating box2 to Collected with duplicate serial - should fail validation
        $this->actingAs($picker)
            ->put(route('picker.box.update', $box2), [
                'status' => BoxStatus::Collected->value,
                'courier_notes' => 'Picked up.',
                'pickup_proof' => UploadedFile::fake()->image('pickup.jpg'),
                'serial_number' => 'DUPLICATE-SERIAL',
            ])
            ->assertSessionHasErrors(['serial_number']);

        $this->assertNull($box2->fresh()->serial_number);
    }

    public function test_picker_cannot_assign_soft_deleted_duplicate_serial_number_when_collecting_single_box(): void
    {
        Storage::fake('public');
        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $box = $this->createBoxForStatusUpdate($picker);
        $reservedBox = Box::factory()->create(['serial_number' => 'SOFT-DELETED-SERIAL']);
        $reservedBox->delete();

        $this->actingAs($picker)
            ->put(route('picker.box.update', $box), [
                'status' => BoxStatus::Collected->value,
                'courier_notes' => 'Picked up.',
                'pickup_proof' => UploadedFile::fake()->image('pickup.jpg'),
                'serial_number' => 'SOFT-DELETED-SERIAL',
            ])
            ->assertSessionHasErrors(['serial_number']);

        $this->assertNull($box->fresh()->serial_number);
    }

    public function test_picker_cannot_assign_serial_number_longer_than_column_when_collecting_single_box(): void
    {
        Storage::fake('public');
        $picker = User::factory()->create(['role' => Role::Picker->value]);
        $box = $this->createBoxForStatusUpdate($picker);

        $this->actingAs($picker)
            ->put(route('picker.box.update', $box), [
                'status' => BoxStatus::Collected->value,
                'courier_notes' => 'Picked up.',
                'pickup_proof' => UploadedFile::fake()->image('pickup.jpg'),
                'serial_number' => str_repeat('A', 31),
            ])
            ->assertSessionHasErrors(['serial_number']);

        $this->assertNull($box->fresh()->serial_number);
    }

    private function createBoxForStatusUpdate(User $picker): Box
    {
        $sender = Sender::factory()->create();
        $area = Area::create([
            'name' => 'Test Area '.Str::uuid(),
            'is_active' => true,
        ]);
        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
        ]);
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
            'declaration_form_status' => 'submitted_online',
        ]);
        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'status' => BoxStatus::Pending->value,
            'weight' => 10.0,
        ]);
        $runsheet = Runsheet::factory()->create([
            'status' => RunsheetStatus::Assigned->value,
            'type' => RunsheetType::Pickup->value,
            'picker_id' => $picker->id,
            'courier_id' => null,
        ]);
        $runsheet->bookings()->attach($booking->id);

        return $box;
    }
}
