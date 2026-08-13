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
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PickerStatusUpdateGuardTest extends TestCase
{
    use RefreshDatabase;

    public function test_picker_update_on_delivered_box_returns_user_error_instead_of_500(): void
    {
        /** @var User $picker */
        $picker = User::factory()->create([
            'role' => Role::Picker->value,
        ]);

        $box = $this->createDeliveredBoxAssignedToPicker($picker);

        $this->actingAs($picker)
            ->put(route('picker.box.update', $box), [
                'tracking_step_key' => 'picked_up',
                'courier_notes' => 'Attempting update from picker scanner.',
            ])
            ->assertSessionHas('error', fn (?string $message) => $message && str_contains($message, 'No valid pickup tracking actions are available for this box status.'));

        $this->assertDatabaseHas('boxes', [
            'id' => $box->id,
            'status' => BoxStatus::Delivered->value,
        ]);
    }

    private function createDeliveredBoxAssignedToPicker(User $picker): Box
    {
        $sender = Sender::factory()->create();

        $area = Area::factory()->create([
            'name' => 'Picker Guard Area '.Str::uuid(),
        ]);

        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed->value,
            'payment_status' => PaymentStatus::Paid->value,
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'status' => BoxStatus::Delivered->value,
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
