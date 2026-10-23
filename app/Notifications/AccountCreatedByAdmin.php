<?php

namespace App\Notifications;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\SerializesModels;

class AccountCreatedByAdmin extends Notification implements ShouldQueue
{
    use Queueable, SerializesModels;

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
        $roleValue = $this->user->role instanceof Role
            ? $this->user->role->value
            : (string) $this->user->role;

        $loginUrl = url('/login');

        if ($roleValue === Role::Picker->value || $roleValue === 'picker') {
            return (new MailMessage)
                ->subject(__('messages.notifications.account_created.picker.subject', ['appName' => $appName]))
                ->greeting(__('messages.notifications.account_created.greeting', ['name' => $this->user->name]))
                ->line(__('messages.notifications.account_created.picker.line_created', ['appName' => $appName]))
                ->line(__('messages.notifications.account_created.picker.line_credentials'))
                ->line('**Email:** '.$this->user->email)
                ->line('**Default Password:** '.$this->plainPassword)
                ->line(__('messages.notifications.account_created.picker.instructions_heading'))
                ->line('1. '.__('messages.notifications.account_created.picker.step_1'))
                ->line('2. '.__('messages.notifications.account_created.picker.step_2'))
                ->line('3. '.__('messages.notifications.account_created.picker.step_3'))
                ->line('4. '.__('messages.notifications.account_created.picker.step_4'))
                ->action(__('messages.notifications.account_created.picker.action'), $loginUrl)
                ->line(__('messages.notifications.account_created.picker.closing', ['appName' => $appName]));
        }

        if ($roleValue === Role::Courier->value || $roleValue === 'courier') {
            return (new MailMessage)
                ->subject(__('messages.notifications.account_created.courier.subject', ['appName' => $appName]))
                ->greeting(__('messages.notifications.account_created.greeting', ['name' => $this->user->name]))
                ->line(__('messages.notifications.account_created.courier.line_created', ['appName' => $appName]))
                ->line(__('messages.notifications.account_created.courier.line_credentials'))
                ->line('**Email:** '.$this->user->email)
                ->line('**Default Password:** '.$this->plainPassword)
                ->line(__('messages.notifications.account_created.courier.instructions_heading'))
                ->line('1. '.__('messages.notifications.account_created.courier.step_1'))
                ->line('2. '.__('messages.notifications.account_created.courier.step_2'))
                ->line('3. '.__('messages.notifications.account_created.courier.step_3'))
                ->line('4. '.__('messages.notifications.account_created.courier.step_4'))
                ->action(__('messages.notifications.account_created.courier.action'), $loginUrl)
                ->line(__('messages.notifications.account_created.courier.closing', ['appName' => $appName]));
        }

        if ($roleValue === Role::Warehouse->value || $roleValue === 'warehouse') {
            return (new MailMessage)
                ->subject(__('messages.notifications.account_created.warehouse.subject', ['appName' => $appName]))
                ->greeting(__('messages.notifications.account_created.greeting', ['name' => $this->user->name]))
                ->line(__('messages.notifications.account_created.warehouse.line_created', ['appName' => $appName]))
                ->line(__('messages.notifications.account_created.warehouse.line_credentials'))
                ->line('**Email:** '.$this->user->email)
                ->line('**Default Password:** '.$this->plainPassword)
                ->line(__('messages.notifications.account_created.warehouse.instructions_heading'))
                ->line('1. '.__('messages.notifications.account_created.warehouse.step_1'))
                ->line('2. '.__('messages.notifications.account_created.warehouse.step_2'))
                ->line('3. '.__('messages.notifications.account_created.warehouse.step_3'))
                ->action(__('messages.notifications.account_created.warehouse.action'), $loginUrl)
                ->line(__('messages.notifications.account_created.warehouse.closing', ['appName' => $appName]));
        }

        return (new MailMessage)
            ->subject(__('messages.notifications.account_created.subject', ['appName' => $appName]))
            ->greeting(__('messages.notifications.account_created.greeting', ['name' => $this->user->name]))
            ->line(__('messages.notifications.account_created.line_created', ['role' => ucfirst($roleValue)]))
            ->line(__('messages.notifications.account_created.line_credentials', ['email' => $this->user->email]))
            ->line('**'.$this->plainPassword.'**')
            ->line(__('messages.notifications.account_created.line_action'))
            ->action(__('messages.notifications.account_created.action'), $loginUrl)
            ->line(__('messages.notifications.account_created.closing', ['appName' => $appName]));
    }
}
