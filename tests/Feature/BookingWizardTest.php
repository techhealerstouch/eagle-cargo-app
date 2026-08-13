<?php

namespace Tests\Feature;

use App\Models\Area;
use App\Models\Booking;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class BookingWizardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
    }

#[Test]
    public function it_injects_sender_profile_into_the_booking_create_props()
    {
        /** @var User $user */
        $user = User::factory()->create();

        $sender = Sender::factory()->create([
            'user_id' => $user->id,
            'first_name' => 'John',
            'last_name' => 'Wizard',
            'address' => '123 Wizard Way',
        ]);

        $user->setRelation('sender', $sender);

        $response = $this->actingAs($user)->get(route('book'));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('sender/Book')
                ->has('sender')
                ->where('sender.first_name', 'John')
                ->where('sender.address', '123 Wizard Way')
            );
    }

#[Test]
    public function it_injects_sender_profile_into_the_booking_edit_props()
    {
        /** @var User $user */
        $user = User::factory()->create();

        $sender = Sender::factory()->create([
            'user_id' => $user->id,
            'first_name' => 'John',
            'last_name' => 'Wizard',
        ]);

        $user->setRelation('sender', $sender);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => 'pending',
        ]);

        $response = $this->actingAs($user)->get(route('bookings.edit', $booking));

        $response->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('sender/Book')
                ->has('sender')
                ->where('sender.last_name', 'Wizard')
            );
    }

#[Test]
    public function it_can_handle_wizard_submission_with_sender_details()
    {
        /** @var User $user */
        $user = User::factory()->create();

        $area = Area::create(['name' => 'Test Area', 'is_active' => true]);
        $boxType = BoxType::create(['name' => 'Test Box', 'is_active' => true]);
        BoxPrice::create(['area_id' => $area->id, 'box_type_id' => $boxType->id, 'price' => 100.00]);

        $payload = [
            'first_name' => 'John',
            'last_name' => 'Wizard',
            'email' => $user->email,
            'mobile' => '+61400000000',
            'address' => '123 Wizard Way',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'payment_method' => 'stripe',
            'preferred_date' => now()->addDays(2)->toDateString(),
            'boxes' => [
                [
                    'area_id' => $area->id,
                    'box_type_id' => $boxType->id,
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Recipient',
                    'recipient_address' => '456 Recipient Rd',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                    'recipient_phone' => '09123456789',
                    'recipient_email' => 'jane@example.com',
                ],
            ],
        ];

        $response = $this->actingAs($user)->post(route('bookings.store'), $payload);

        $response->assertRedirect();

        $this->assertDatabaseHas('senders', [
            'user_id' => $user->id,
            'last_name' => 'Wizard',
        ]);

        $this->assertDatabaseHas('boxes', [
            'price_charged' => 100.00,
        ]);
    }
}
