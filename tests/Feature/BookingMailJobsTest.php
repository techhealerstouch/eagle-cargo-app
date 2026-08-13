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
use App\Models\Sender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
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
}
