<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\Invoice;
use App\Models\PickupZone;
use App\Models\Sender;
use App\Models\User;
use App\Notifications\BankTransferDetails;
use App\Services\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class BankTransferPaymentTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected Sender $sender;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create([
            'role' => Role::Sender,
            'email' => 'sender@example.com',
            'email_verified_at' => now(),
        ]);

        $this->sender = $this->user->sender;
        $this->sender->update([
            'email' => 'sender@example.com',
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'mobile' => '+61412345678',
            'address' => '10 Acacia Ave',
            'suburb' => 'Brisbane',
            'state' => 'QLD',
            'postcode' => '4000',
        ]);

        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
    }

    public function test_initialize_endpoint_does_not_expose_bank_details(): void
    {
        Notification::fake();

        $pickupZone = PickupZone::factory()->create(['is_active' => true]);
        $this->sender->update(['pickup_zone_id' => $pickupZone->id]);

        $area = Area::factory()->create(['is_active' => true]);
        $boxType = BoxType::factory()->create(['is_active' => true]);

        $resolvedAreaId = app(\App\Services\ReferenceDataService::class)->resolveDestinationAreaId(
            'Metro Manila',
            'Manila',
            $area->id
        ) ?? $area->id;

        BoxPrice::updateOrCreate(
            [
                'pickup_zone_id' => $pickupZone->id,
                'area_id' => $resolvedAreaId,
                'box_type_id' => $boxType->id,
            ],
            ['price' => 120.00]
        );

        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
            'payment_method' => 'stripe',
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'box_type_id' => $boxType->id,
            'price_charged' => 120.00,
        ]);

        $this->actingAs($this->user);

        $payload = [
            'booking_id' => $booking->id,
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'email' => 'sender@example.com',
            'mobile' => '+61412345678',
            'address' => '10 Acacia Ave',
            'suburb' => 'Brisbane',
            'state' => 'QLD',
            'postcode' => '4000',
            'pickup_zone_id' => $pickupZone->id,
            'preferred_date' => now()->addDays(7)->format('Y-m-d'),
            'payment_method' => 'bank_transfer',
            'boxes' => [
                [
                    'box_type_id' => $boxType->id,
                    'area_id' => $resolvedAreaId,
                    'recipient_first_name' => 'Juan',
                    'recipient_last_name' => 'Dela Cruz',
                    'recipient_email' => 'juan@example.com',
                    'recipient_phone' => '+639171234567',
                    'recipient_address' => '456 Rizal St',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                    'items_description' => 'Chocolates and clothes',
                ],
            ],
        ];

        $response = $this->postJson('/bookings/initialize', $payload);

        $response->assertOk();
        $response->assertJsonMissing(['bankDetails']);
        $this->assertArrayNotHasKey('bankDetails', $response->json());
        Notification::assertSentTo($this->user, BankTransferDetails::class);
    }

    public function test_pay_console_inertia_props_do_not_expose_bank_details(): void
    {
        $boxType = BoxType::factory()->create();
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
            'payment_method' => 'stripe',
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'box_type_id' => $boxType->id,
            'price_charged' => 120.00,
        ]);

        $this->actingAs($this->user);

        $response = $this->get(route('bookings.pay', $booking));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('payment/PaymentConsole')
            ->has('booking')
            ->missing('bankDetails')
        );
    }

    public function test_sender_can_request_bank_transfer_details_via_endpoint(): void
    {
        Notification::fake();

        $boxType = BoxType::factory()->create();
        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
            'payment_method' => 'stripe',
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'box_type_id' => $boxType->id,
            'price_charged' => 150.00,
        ]);

        $this->actingAs($this->user);

        $response = $this->postJson(route('bookings.bank-transfer', $booking));

        $response->assertOk();
        $response->assertJson([
            'success' => true,
        ]);

        $this->assertEquals('bank_transfer', $booking->fresh()->payment_method);

        Notification::assertSentTo(
            $this->user,
            BankTransferDetails::class,
            function (BankTransferDetails $notification) use ($booking): bool {
                $mail = $notification->toMail($this->user);
                $settings = app(SettingsService::class)->getInvoiceSettings();

                $this->assertStringContainsString($booking->reference_number, $mail->subject);
                $this->assertContains('BSB: '.$settings['bankBsb'], $mail->introLines);
                $this->assertContains('Account Number: '.$settings['bankAccount'], $mail->introLines);
                $this->assertContains('Bank: '.$settings['bankName'], $mail->introLines);

                $array = $notification->toArray($this->user);
                $this->assertEquals('bank_transfer_instructions', $array['type']);
                $this->assertEquals($booking->id, $array['booking_id']);

                return true;
            }
        );
    }

    public function test_unauthorized_sender_cannot_request_bank_transfer_details_for_other_booking(): void
    {
        Notification::fake();

        $otherUser = User::factory()->create(['role' => Role::Sender]);
        $otherSender = $otherUser->sender;

        $booking = Booking::factory()->create([
            'sender_id' => $otherSender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
            'payment_method' => 'stripe',
        ]);

        $this->actingAs($this->user);

        $response = $this->postJson(route('bookings.bank-transfer', $booking));

        $response->assertStatus(403);
        Notification::assertNothingSent();
    }

    public function test_already_paid_booking_cannot_request_bank_transfer_details(): void
    {
        Notification::fake();

        $booking = Booking::factory()->create([
            'sender_id' => $this->sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
            'payment_method' => 'stripe',
        ]);

        $this->actingAs($this->user);

        $response = $this->postJson(route('bookings.bank-transfer', $booking));

        $response->assertStatus(422);
        Notification::assertNothingSent();
    }
}
