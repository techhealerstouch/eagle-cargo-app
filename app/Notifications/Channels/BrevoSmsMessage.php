<?php

namespace App\Notifications\Channels;

class BrevoSmsMessage
{
    /**
     * The message content.
     */
    public string $content = '';

    /**
     * The sender name/number.
     */
    public ?string $sender = null;

    /**
     * Set the message content.
     */
    public function content(string $content): static
    {
        $this->content = $content;

        return $this;
    }

    /**
     * Set the sender name or phone number.
     */
    public function sender(string $sender): static
    {
        $this->sender = $sender;

        return $this;
    }
}
