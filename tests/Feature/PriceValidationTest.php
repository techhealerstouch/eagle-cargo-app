<?php

namespace Tests\Feature;

use App\Models\Area;
use App\Models\BoxType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PriceValidationTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function it_prevents_booking_creation_without_price_configuration()
    {
        /** @var User $user */
        $user = User::factory()->create();

        $area = Area::create(['name' => 'Test Area', 'is_active' => true]);
        $boxType = BoxType::create(['name' => 'Test Box', 'is_active' => true]);
        // Note: NO BoxPrice is created - this should cause validation to fail

        $payload = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => $user->email,
            'mobile' => '+61400000000',
            'address' => '123 Test St',
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

        // Should fail with InvalidArgumentException about missing price
        $this->withoutExceptionHandling();
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('No price configured for box 1');
        
        $response = $this->actingAs($user)->post(route('bookings.store'), $payload);
        
        // If we get here, the exception wasn't thrown
        $this->fail('Expected InvalidArgumentException was not thrown');
    }

#[Test]
    public function it_allows_booking_creation_with_price_configuration()
    {
        /** @var User $user */
        $user = User::factory()->create();

        $area = Area::create(['name' => 'Test Area', 'is_active' => true]);
        $boxType = BoxType::create(['name' => 'Test Box', 'is_active' => true]);
        
        // Create a price for this area/box type combination
        \App\Models\BoxPrice::create([
            'area_id' => $area->id,
            'box_type_id' => $boxType->id,
            'price' => 150.00,
        ]);

        $payload = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => $user->email,
            'mobile' => '+61400000000',
            'address' => '123 Test St',
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

        // Should succeed and redirect to payment page
        $response->assertRedirect();
        
        // Check that booking was created with correct price
        $this->assertDatabaseHas('bookings', [
            'payment_method' => 'stripe',
        ]);
        
        $this->assertDatabaseHas('boxes', [
            'price_charged' => 150.00,
        ]);
    }

    #[Test]
    public function it_prevents_payment_initialization_with_zero_total()
    {
        /** @var User $user */
        $user = User::factory()->create();

        $area = Area::create(['name' => 'Test Area', 'is_active' => true]);
        $boxType = BoxType::create(['name' => 'Test Box', 'is_active' => true]);
        
        // Create a booking manually with 0 price (simulating old bug)
        $sender = $user->sender;
        $booking = \App\Models\Booking::factory()->pending()->create([
            'sender_id' => $sender->id,
            'payment_method' => 'stripe',
        ]);
        
        // Create box with 0 price
        $recipient = \App\Models\Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
        ]);
        
        \App\Models\Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
            'price_charged' => 0, // Zero price!
        ]);

        // Try to access payment page - should redirect with error about 0 total amount
        $response = $this->actingAs($user)->get(route('bookings.pay', $booking));

        // Check redirect and error message
        $response->assertRedirect(route('sender.bookings'));
        $response->assertSessionHas('error', function ($value) {
            return str_contains($value, 'booking total amount is $0');
        });
    }
}