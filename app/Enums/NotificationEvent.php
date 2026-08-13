<?php

namespace App\Enums;

enum NotificationEvent: string
{
    // Box lifecycle
    case BoxCollected = 'box_collected';
    case BoxShipped = 'box_shipped';
    case BoxInTransit = 'box_in_transit';
    case BoxArrived = 'box_arrived';
    case BoxOutForDelivery = 'box_out_for_delivery';
    case BoxDelivered = 'box_delivered';

    // Batch lifecycle
    case BatchReadyToClose = 'batch_ready_to_close';
    case BatchSailed = 'batch_departed';
    case BatchArrived = 'batch_arrived';
    case BatchDelivered = 'batch_delivered';

    // Payments
    case PaymentReceived = 'payment_received';
    case PaymentReminder = 'payment_reminder';

    // Scheduling
    case PickupScheduled = 'pickup_scheduled';
    case PickupReminder = 'pickup_reminder';
    case DeliveryAttemptFailed = 'delivery_attempt_failed';
    case RunsheetAssigned = 'runsheet_assigned';

    public function label(): string
    {
        return __('notifications.events.'.$this->value);
    }

    public function category(): string
    {
        return match ($this) {
            self::BoxCollected,
            self::BoxShipped,
            self::BoxInTransit,
            self::BoxArrived,
            self::BoxOutForDelivery,
            self::BoxDelivered => 'box',

            self::BatchReadyToClose,
            self::BatchSailed,
            self::BatchArrived,
            self::BatchDelivered => 'batch',

            self::PaymentReceived,
            self::PaymentReminder => 'payment',

            self::PickupScheduled,
            self::PickupReminder,
            self::DeliveryAttemptFailed,
            self::RunsheetAssigned => 'scheduling',
        };
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public static function forCategory(string $category): array
    {
        return array_filter(
            self::cases(),
            fn (self $event) => $event->category() === $category
        );
    }
}
