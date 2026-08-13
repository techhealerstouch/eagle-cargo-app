<?php

namespace Tests\Feature\Picker;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxUpdate;
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class CollectionOnceTest extends TestCase
{
    use RefreshDatabase;

    public function test_box_can_only_be_collected_once_by_picker(): void
    {
        Storage::fake('public');
        Notification::fake();

        /** @var User $picker */
        $picker = User::factory()->create([
            'role' => Role::Picker->value,
        ]);

        $box = $this->createPendingBoxAssignedToPicker($picker);

        // First collection - should succeed
        $response = $this->actingAs($picker)
            ->put(route('picker.box.update', $box), [
                'tracking_step_key' => 'picked_up',
                'pickup_proof' => UploadedFile::fake()->image('pickup.jpg'),
                'serial_number' => 'COLLECTED-ONCE-SERIAL',
            ]);

        $response->assertSessionHas('success');
        $this->assertEquals(BoxStatus::Collected, $box->fresh()->status);
        $this->assertNotNull($box->fresh()->pickup_proof_path);
        $this->assertTrue(Storage::disk('public')->exists($box->fresh()->pickup_proof_path));
        $this->assertCount(1, BoxUpdate::where('box_id', $box->id)->get());

        // Second collection attempt - should fail/be blocked
        $response = $this->actingAs($picker)
            ->put(route('picker.box.update', $box), [
                'tracking_step_key' => 'picked_up',
                'pickup_proof' => UploadedFile::fake()->image('pickup2.jpg'),
            ]);

        $response->assertSessionHas('error', fn (?string $message) => $message && str_contains($message, 'No valid pickup tracking actions are available for this box status.'));

        // Ensure no duplicate BoxUpdate was created
        $this->assertCount(1, BoxUpdate::where('box_id', $box->id)->get());
    }

    private function createPendingBoxAssignedToPicker(User $picker): Box
    {
        $sender = Sender::factory()->create();

        $area = Area::factory()->create([
            'name' => 'Collection Area '.Str::uuid(),
        ]);

        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed->value,
            'payment_status' => PaymentStatus::Paid->value,
            'declaration_form_status' => 'submitted',
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'status' => BoxStatus::Pending->value,
            'weight' => 12.5,
        ]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'type' => RunsheetType::Pickup->value,
            'status' => RunsheetStatus::Assigned->value,
        ]);

        $runsheet->bookings()->attach($booking->id);

        return $box;
    }
}
