<?php

namespace App\Notifications;

use App\Models\Booking;
use App\Models\Sender;
use App\Models\User;
use App\Services\GuestBookingAccessService;
use App\Services\SettingsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BankTransferDetails extends Notification implements ShouldQueue
{
    use Queueable;

    public ?array $channels = null;

    public function __construct(
        protected Booking $booking,
    ) {}

    public function via(object $notifiable): array
    {
        if (isset($this->channels)) {
            return $this->channels;
        }

        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $recipientName = '';
        if ($notifiable instanceof Sender) {
            $recipientName = trim((string) ($notifiable->first_name ?? ''));
        } elseif ($notifiable instanceof User) {
            $recipientName = trim((string) ($notifiable->name ?? ''));
        }

        if ($recipientName === '') {
            $recipientName = __('messages.defaults.recipient_name');
        }

        $settings = app(SettingsService::class)->getInvoiceSettings();
        $this->booking->loadMissing(['boxes', 'invoice', 'sender']);

        $totalAmount = (float) ($this->booking->invoice?->amount ?? $this->booking->boxes->sum('price_charged'));
        $currencySymbol = $settings['currencySymbol'] ?? '$';
        $formattedAmount = $currencySymbol.number_format($totalAmount, 2);
        $isGuest = $this->booking->is_guest || empty($this->booking->sender?->user_id);
        $actionUrl = $isGuest
            ? app(GuestBookingAccessService::class)->verificationUrl($this->booking, GuestBookingAccessService::PAYMENT)
            : url('/bookings?upload_proof='.$this->booking->reference_number.'&highlight='.$this->booking->reference_number);

        return (new MailMessage)
            ->subject(__('messages.notifications.bank_transfer_details.subject', [
                'reference' => $this->booking->reference_number,
            ]))
            ->greeting(__('messages.notifications.bank_transfer_details.greeting', [
                'name' => $recipientName,
            ]))
            ->line(__('messages.notifications.bank_transfer_details.line_intro', [
                'reference' => $this->booking->reference_number,
            ]))
            ->line(__('messages.notifications.bank_transfer_details.line_amount', [
                'amount' => $formattedAmount,
            ]))
            ->line('--------------------------------------------------')
            ->line(__('messages.notifications.bank_transfer_details.line_account_name', [
                'company' => $settings['companyName'] ?? 'Love Balikbayan Box Cargo',
            ]))
            ->line(__('messages.notifications.bank_transfer_details.line_bank', [
                'bank' => $settings['bankName'] ?? 'Commonwealth Bank',
            ]))
            ->line(__('messages.notifications.bank_transfer_details.line_bsb', [
                'bsb' => $settings['bankBsb'] ?? '064-449',
            ]))
            ->line(__('messages.notifications.bank_transfer_details.line_account', [
                'account' => $settings['bankAccount'] ?? '1097 5991',
            ]))
            ->line(__('messages.notifications.bank_transfer_details.line_reference', [
                'reference' => $this->booking->reference_number,
            ]))
            ->line('--------------------------------------------------')
            ->line(__('messages.notifications.bank_transfer_details.line_instruction', [
                'reference' => $this->booking->reference_number,
            ]))
            ->line(__('messages.notifications.bank_transfer_details.line_proof'))
            ->action(
                __('messages.notifications.bank_transfer_details.action'),
                $actionUrl
            )
            ->line(__('messages.notifications.bank_transfer_details.closing', ['appName' => config('app.name')]));
    }

    public function toArray(object $notifiable): array
    {
        $this->booking->loadMissing(['boxes', 'invoice', 'sender']);
        $totalAmount = (float) ($this->booking->invoice?->amount ?? $this->booking->boxes->sum('price_charged'));
        $isGuest = $this->booking->is_guest || empty($this->booking->sender?->user_id);
        $actionUrl = $isGuest
            ? app(GuestBookingAccessService::class)->verificationUrl($this->booking, GuestBookingAccessService::PAYMENT)
            : '/bookings?upload_proof='.$this->booking->reference_number.'&highlight='.$this->booking->reference_number;

        return [
            'type' => 'bank_transfer_instructions',
            'booking_id' => $this->booking->id,
            'reference' => $this->booking->reference_number,
            'title' => __('Bank Transfer Details'),
            'message' => __('Bank transfer details sent for booking :reference (Amount: $:amount).', [
                'reference' => $this->booking->reference_number,
                'amount' => number_format($totalAmount, 2),
            ]),
            'url' => $actionUrl,
        ];
    }
}
