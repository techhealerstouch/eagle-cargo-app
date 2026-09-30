<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SenderCredentialsNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public User $user,
        public string $plainPassword,
        public ?string $resetUrl = null
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $appName = config('app.name', 'Love Balikbayan Box');
        $loginUrl = url('/login');

        $mail = (new MailMessage)
            ->subject("Welcome to {$appName} - Your Account Login Credentials")
            ->greeting("Hello {$this->user->name},")
            ->line("An account has been prepared for you at {$appName} so you can manage your bookings, view transaction history, and track your balikbayan shipments in real time.")
            ->line("**Your Login Credentials:**")
            ->line("**Email / Username:** {$this->user->email}")
            ->line("**Temporary Password:** {$this->plainPassword}");

        if ($this->resetUrl) {
            $mail->line("You can log in directly using the temporary password above, or click below to set a new password:")
                ->action('Set Up Your Password & Login', $this->resetUrl);
        } else {
            $mail->action('Login to Your Account', $loginUrl);
        }

        return $mail
            ->line('For your security, we recommend updating your password after logging in.')
            ->line("Thank you for shipping with {$appName}!");
    }
}
