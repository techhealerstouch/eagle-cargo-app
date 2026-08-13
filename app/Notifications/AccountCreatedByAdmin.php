<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class AccountCreatedByAdmin extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        protected User $user,
        protected string $plainPassword
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
        $appName = config('app.name');

        return (new MailMessage)
            ->subject(__('messages.notifications.account_created.subject', ['appName' => $appName]))
            ->greeting(__('messages.notifications.account_created.greeting', ['name' => $this->user->name]))
            ->line(__('messages.notifications.account_created.line_created', ['role' => ucfirst($this->user->role->value ?? $this->user->role)]))
            ->line(__('messages.notifications.account_created.line_credentials', ['email' => $this->user->email]))
            ->line('**' . $this->plainPassword . '**')
            ->line(__('messages.notifications.account_created.line_action'))
            ->action(__('messages.notifications.account_created.action'), url('/login'))
            ->line(__('messages.notifications.account_created.closing', ['appName' => $appName]));
    }
}
