<?php

namespace Tests\Feature;

use App\Jobs\NotifyAdminOfNewBooking;
use App\Jobs\SendBookingConfirmationMail;
use App\Mail\BookingConfirmation;
use App\Mail\BookingReceivedAdmin;
use App\Mail\EnquiryReceived;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Enquiry;
use App\Models\Invoice;
use App\Models\Sender;
use App\Notifications\BookingPaymentReceived;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\TestCase;

class BookingMailJobsTest extends TestCase
{
    use RefreshDatabase;

    public function test_notify_admin_job_sends_mail_to_configured_admin_address(): void
    {
        Mail::fake();
        config(['mail.admin_address' => 'ops@example.com']);

        $booking = Booking::factory()->create();

        (new NotifyAdminOfNewBooking($booking))->handle();

        Mail::assertSent(BookingReceivedAdmin::class, function (BookingReceivedAdmin $mail) {
            $expectedSubject = __('emails.subjects.booking_received_admin', [
                'reference' => $mail->booking->reference_number ?? '',
            ]);

            return $mail->hasTo('ops@example.com')
                && $mail->envelope()->subject === $expectedSubject;
        });
    }

    public function test_notify_admin_job_logs_warning_when_admin_address_is_missing(): void
    {
        Mail::fake();
        config([
            'mail.admin_address' => null,
            'mail.from.address' => null,
        ]);

        $booking = Booking::factory()->create();

        Log::shouldReceive('warning')
            ->once()
            ->withArgs(function (string $message, array $context) use ($booking): bool {
                return str_contains($message, 'admin email is not configured')
                    && ($context['booking_id'] ?? null) === $booking->id;
            });

        (new NotifyAdminOfNewBooking($booking))->handle();

        Mail::assertNothingSent();
    }

    public function test_send_booking_confirmation_job_sends_mail_to_sender(): void
    {
        Mail::fake();

        $booking = Booking::factory()->create([
            'sender_id' => Sender::factory()->create([
                'email' => 'sender@example.com',
            ])->id,
        ]);

        (new SendBookingConfirmationMail($booking))->handle();

        Mail::assertSent(BookingConfirmation::class, function (BookingConfirmation $mail) {
            return $mail->hasTo('sender@example.com')
                && $mail->envelope()->subject === __('emails.subjects.booking_confirmation', ['appName' => config('app.name')]);
        });
    }

    public function test_booking_mail_templates_render_transactional_details(): void
    {
        $booking = Booking::factory()
            ->pending()
            ->create([
                'reference_number' => 'BBB-2026-0001',
                'sender_id' => Sender::factory()->create([
                    'first_name' => 'Maria',
                    'last_name' => 'Santos',
                    'email' => 'maria@example.com',
                ])->id,
            ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'tracking_number' => 'TRK-12345',
        ]);

        $customerHtml = (new BookingConfirmation($booking))->render();
        $adminHtml = (new BookingReceivedAdmin($booking))->render();

        $this->assertStringContainsString('Booking received', $customerHtml);
        $this->assertStringContainsString('BBB-2026-0001', $customerHtml);
        $this->assertStringContainsString('TRK-12345', $customerHtml);
        $this->assertStringContainsString('New booking received', $adminHtml);
        $this->assertStringContainsString('maria@example.com', $adminHtml);
    }

    public function test_enquiry_mail_template_renders_contact_details(): void
    {
        $enquiry = Enquiry::factory()->create([
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@example.com',
            'message' => 'I need help shipping a box.',
        ]);

        $html = (new EnquiryReceived($enquiry))->render();

        $this->assertStringContainsString('New website enquiry', $html);
        $this->assertStringContainsString('Juan Dela Cruz', $html);
        $this->assertStringContainsString('I need help shipping a box.', $html);
    }

    public function test_booking_confirmation_mail_renders_for_guest_booking(): void
    {
        $sender = Sender::factory()->create([
            'first_name' => 'Guest',
            'last_name' => 'User',
            'email' => 'guest@example.com',
            'user_id' => null,
        ]);

        $booking = Booking::factory()
            ->pending()
            ->create([
                'reference_number' => 'BBB-GUEST-001',
                'sender_id' => $sender->id,
                'is_guest' => true,
                'guest_token' => (string) Str::uuid(),
                'payment_method' => 'bank_transfer',
            ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'tracking_number' => 'TRK-GUEST-001',
        ]);

        $html = (new BookingConfirmation($booking))->render();

        $this->assertStringContainsString('Booking received, Guest', $html);
        $this->assertStringContainsString('BBB-GUEST-001', $html);
        $this->assertStringContainsString('TRK-GUEST-001', $html);
        $this->assertStringContainsString('guest/booking/'.$booking->id.'/confirmed', $html);
    }

    public function test_booking_confirmation_mail_renders_for_empty_box_order(): void
    {
        $sender = Sender::factory()->create([
            'first_name' => 'EmptyBox',
            'last_name' => 'Buyer',
            'email' => 'emptybox@example.com',
            'user_id' => null,
        ]);

        $booking = Booking::factory()
            ->pending()
            ->create([
                'reference_number' => 'BBB-EMPTY-001',
                'sender_id' => $sender->id,
                'is_guest' => true,
                'guest_token' => (string) Str::uuid(),
                'empty_box_count' => 3,
                'empty_box_fee' => 10.00,
                'empty_box_items' => [
                    ['box_type_id' => 1, 'name' => 'Jumbo Balikbayan Box', 'quantity' => 3],
                ],
                'payment_method' => 'bank_transfer',
            ]);

        $html = (new BookingConfirmation($booking))->render();

        $this->assertStringContainsString('Empty Boxes Ordered', $html);
        $this->assertStringContainsString('Jumbo Balikbayan Box', $html);
        $this->assertStringNotContainsString('Required: Customs Declaration Form', $html);
    }

    public function test_booking_payment_received_notification_routes_guest_to_confirmation_url(): void
    {
        $sender = Sender::factory()->create([
            'first_name' => 'Guest',
            'last_name' => 'Payer',
            'email' => 'payer@example.com',
            'user_id' => null,
        ]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'is_guest' => true,
            'guest_token' => (string) Str::uuid(),
        ]);

        $invoice = Invoice::create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV-TEST-001',
            'amount' => 120.00,
            'status' => 'paid',
        ]);

        $notification = new BookingPaymentReceived($booking, $invoice);
        $mail = $notification->toMail($sender);

        $this->assertStringContainsString('guest/booking/'.$booking->id.'/confirmed', $mail->actionUrl);
        $this->assertStringNotContainsString('/bookings', $mail->actionUrl);
    }

    public function test_dispatch_for_booking_queues_job_when_after_response_is_disabled(): void
    {
        Queue::fake();
        config(['mail.booking_confirmation_after_response' => false]);

        $booking = Booking::factory()->create();

        SendBookingConfirmationMail::dispatchForBooking($booking);

        Queue::assertPushed(SendBookingConfirmationMail::class, fn (SendBookingConfirmationMail $job): bool => $job->booking->id === $booking->id);
    }

    public function test_dispatch_for_booking_sends_after_response_when_enabled(): void
    {
        Mail::fake();
        config(['mail.booking_confirmation_after_response' => true]);

        $sender = Sender::factory()->create(['email' => 'after-response@example.com']);
        $booking = Booking::factory()->create(['sender_id' => $sender->id]);

        SendBookingConfirmationMail::dispatchForBooking($booking);
        app()->terminate();

        Mail::assertSent(BookingConfirmation::class, fn (BookingConfirmation $mail): bool => $mail->hasTo('after-response@example.com'));
    }
}
