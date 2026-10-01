<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SecurityAnomalyAlert extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $anomalyType,
        public string $title,
        public string $description,
        public array $metadata = []
    ) {}

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->error()
            ->subject("[SECURITY ALERT] {$this->title}")
            ->greeting('Security Anomaly Detected')
            ->line($this->description)
            ->line('**Anomaly Type:** '.strtoupper($this->anomalyType))
            ->line('**Timestamp:** '.now()->toDateTimeString());

        if (! empty($this->metadata)) {
            $mail->line('--- Details ---');
            foreach ($this->metadata as $key => $val) {
                $formattedVal = is_array($val) ? json_encode($val) : (string) $val;
                $mail->line('**'.ucwords(str_replace('_', ' ', $key)).":** {$formattedVal}");
            }
        }

        $mail->action('View Audit Trail Dashboard', url('/admin/activity-logs'))
            ->line('Please review this incident in the administrative activity log immediately.');

        // If webhook URL is set, also post to Webhook (Slack/Discord/Custom)
        $this->sendWebhookNotification();

        return $mail;
    }

    /**
     * Send alert to webhook if configured.
     */
    protected function sendWebhookNotification(): void
    {
        $webhookUrl = config('audit.alert_webhook_url', env('AUDIT_ALERT_WEBHOOK_URL'));

        if (! $webhookUrl) {
            return;
        }

        try {
            Http::timeout(5)->post($webhookUrl, [
                'content' => "🚨 **[SECURITY ALERT] {$this->title}**\n{$this->description}\nTimestamp: ".now()->toDateTimeString(),
                'text' => "🚨 [SECURITY ALERT] {$this->title}\n{$this->description}",
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to dispatch audit security alert webhook: '.$e->getMessage());
        }
    }
}
