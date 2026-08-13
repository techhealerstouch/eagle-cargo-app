<?php

namespace App\Notifications\Channels;

use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BrevoSmsChannel
{
    /**
     * Send the given notification.
     */
    public function send(object $notifiable, Notification $notification): void
    {
        if (! method_exists($notification, 'toBrevo')) {
            return;
        }

        /** @var BrevoSmsMessage|null $message */
        $message = $notification->toBrevo($notifiable);

        if (! $message instanceof BrevoSmsMessage) {
            return;
        }

        $recipient = $notifiable->routeNotificationForBrevo($notification);

        if (empty($recipient)) {
            Log::warning('BrevoSmsChannel: No recipient phone number available.', [
                'notifiable_type' => get_class($notifiable),
                'notifiable_id' => $notifiable->getKey(),
            ]);

            return;
        }

        $apiKey = config('services.brevo.api_key');
        $sender = $message->sender ?: config('services.brevo.sender', 'LoveBalikbayan');

        if (empty($apiKey)) {
            Log::warning('BrevoSmsChannel: Brevo API key is not configured.');

            return;
        }

        $response = Http::withHeaders([
            'api-key' => $apiKey,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ])->post('https://api.brevo.com/v3/transactionalSMS/send', [
            'sender' => $sender,
            'recipient' => $recipient,
            'content' => $message->content,
            'type' => 'transactional',
        ]);

        if ($response->failed()) {
            Log::error('BrevoSmsChannel: Failed to send SMS.', [
                'recipient' => $recipient,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
        }
    }
}
