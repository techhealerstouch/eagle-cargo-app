<?php

namespace Tests\Feature;

use App\Models\Area;
use App\Models\Booking;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\Recipient;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class BookingOwnershipTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
    }

    public function test_sender_booking_uses_authenticated_users_sender_profile_even_when_email_matches_another_sender(): void
    {
        $area = Area::factory()->create(['is_active' => true]);
        $boxType = BoxType::factory()->create(['is_active' => true]);
        BoxPrice::create(['area_id' => $area->id, 'box_type_id' => $boxType->id, 'price' => 125.00]);

        /** @var User $user */
        $user = User::factory()->create(['email_verified_at' => now()]);

        $ownedSender = $user->sender;
        $ownedSender->update([
            'email' => 'owner@sender.test',
        ]);

        $otherSender = Sender::factory()->create([
            'email' => 'spoof@sender.test',
        ]);

        $payload = $this->validPayload($area, $boxType, [
            'email' => 'spoof@sender.test',
        ]);

        $this->actingAs($user)
            ->post(route('bookings.store'), $payload)
            ->assertSessionHasNoErrors();

        $booking = Booking::query()->latest('id')->first();

        $this->assertNotNull($booking);
        $this->assertSame($ownedSender->id, $booking->sender_id);
        $this->assertNotSame($otherSender->id, $booking->sender_id);
    }

    public function test_sender_cannot_attach_recipient_owned_by_another_sender(): void
    {
        $area = Area::factory()->create(['is_active' => true]);
        $boxType = BoxType::factory()->create(['is_active' => true]);
        BoxPrice::create(['area_id' => $area->id, 'box_type_id' => $boxType->id, 'price' => 90.00]);

        /** @var User $user */
        $user = User::factory()->create(['email_verified_at' => now()]);
        $sender = Sender::factory()->create([
            'user_id' => $user->id,
            'email' => 'owner@sender.test',
        ]);

        $otherSender = Sender::factory()->create();
        $foreignRecipient = Recipient::factory()->create([
            'sender_id' => $otherSender->id,
            'area_id' => $area->id,
        ]);

        $payload = $this->validPayload($area, $boxType, [
            'email' => $sender->email,
            'boxes' => [[
                'recipient_id' => $foreignRecipient->id,
                'area_id' => $area->id,
                'box_type_id' => $boxType->id,
            ]],
        ]);

        $this->actingAs($user)
            ->post(route('bookings.store'), $payload)
            ->assertSessionHasErrors(['boxes.0.recipient_id']);

        $this->assertDatabaseCount('bookings', 0);
    }

    public function test_first_booking_creates_sender_profile_linked_to_authenticated_user(): void
    {
        $area = Area::factory()->create(['is_active' => true]);
        $boxType = BoxType::factory()->create(['is_active' => true]);
        BoxPrice::create(['area_id' => $area->id, 'box_type_id' => $boxType->id, 'price' => 110.00]);

        /** @var User $user */
        $user = User::factory()->create(['email_verified_at' => now()]);

        $payload = $this->validPayload($area, $boxType, [
            'email' => 'new.sender@example.test',
        ]);

        $this->actingAs($user)
            ->post(route('bookings.store'), $payload)
            ->assertSessionHasNoErrors();

        $sender = Sender::query()->where('user_id', $user->id)->first();

        $this->assertNotNull($sender);
        $this->assertSame('new.sender@example.test', $sender->email);

        $booking = Booking::query()->latest('id')->first();
        $this->assertNotNull($booking);
        $this->assertSame($sender->id, $booking->sender_id);
    }

    private function validPayload(Area $area, BoxType $boxType, array $overrides = []): array
    {
        $payload = [
            'first_name' => 'Alice',
            'last_name' => 'Sender',
            'email' => 'alice@example.test',
            'mobile' => '+61400000000',
            'address' => '100 Example Street',
            'suburb' => 'Parramatta',
            'state' => 'NSW',
            'postcode' => '2150',
            'payment_method' => 'stripe',
            'preferred_date' => now()->addDays(2)->toDateString(),
            'boxes' => [[
                'area_id' => $area->id,
                'box_type_id' => $boxType->id,
                'recipient_first_name' => 'Juan',
                'recipient_last_name' => 'Dela Cruz',
                'recipient_email' => 'juan@example.test',
                'recipient_address' => '1 Barangay Road',
                'recipient_city' => 'Cebu City',
                'recipient_province' => 'Cebu',
                'recipient_zip_code' => '6000',
                'recipient_phone' => '+639111111111',
            ]],
        ];

        return array_replace_recursive($payload, $overrides);
    }
}
