<?php

namespace App\Enums;

enum BoxStatus: string
{
    case Pending = 'pending';
    case Collected = 'collected';
    case ReceivedByWarehouse = 'received_by_branch';
    case LoadedToContainer = 'loaded_to_container';
    case InTransit = 'in_transit';
    case Arrived = 'arrived';
    case ForCheckingUnloading = 'for_checking_unloading';
    case UnloadedManila = 'unloaded_manila';
    case ForDeliveryScheduling = 'for_delivery_scheduling';
    case EnRouteRoRo = 'en_route_roro';
    case OutForDelivery = 'out_for_delivery';
    case Delivered = 'delivered';
    case Cancelled = 'cancelled';
    case Damaged = 'damaged';
    case Held = 'held';
    case HeldBulging = 'held_bulging';

    public function canTransitionTo(self $target): bool
    {
        return match ($this) {
            self::Pending             => in_array($target, [self::Collected, self::ReceivedByWarehouse, self::Cancelled]),
            self::Collected           => in_array($target, [self::ReceivedByWarehouse, self::LoadedToContainer, self::InTransit, self::Damaged, self::Cancelled]),
            self::ReceivedByWarehouse => in_array($target, [self::LoadedToContainer, self::InTransit, self::Arrived, self::Delivered, self::Damaged, self::Held, self::HeldBulging, self::Cancelled]),
            self::LoadedToContainer   => in_array($target, [self::ReceivedByWarehouse, self::InTransit, self::Arrived, self::Delivered, self::Damaged, self::Held, self::HeldBulging, self::Cancelled]),
            self::InTransit           => in_array($target, [self::Arrived, self::ForCheckingUnloading, self::EnRouteRoRo, self::OutForDelivery, self::Delivered, self::ReceivedByWarehouse, self::Cancelled]),
            self::Arrived             => in_array($target, [self::InTransit, self::ForCheckingUnloading, self::UnloadedManila, self::EnRouteRoRo, self::OutForDelivery, self::Delivered, self::Cancelled]),
            self::ForCheckingUnloading => in_array($target, [self::UnloadedManila, self::Arrived, self::Held, self::HeldBulging, self::Damaged, self::Cancelled]),
            self::UnloadedManila      => in_array($target, [self::ForDeliveryScheduling, self::EnRouteRoRo, self::OutForDelivery, self::Held, self::HeldBulging, self::Damaged, self::Cancelled]),
            self::ForDeliveryScheduling => in_array($target, [self::OutForDelivery, self::EnRouteRoRo, self::Held, self::HeldBulging, self::Cancelled]),
            self::EnRouteRoRo         => in_array($target, [self::Arrived, self::ForCheckingUnloading, self::UnloadedManila, self::OutForDelivery, self::Delivered, self::Cancelled]),
            self::OutForDelivery      => in_array($target, [self::Delivered, self::Cancelled, self::Held, self::HeldBulging, self::Damaged]),
            self::Damaged             => in_array($target, [self::ReceivedByWarehouse, self::LoadedToContainer, self::InTransit, self::Arrived, self::OutForDelivery, self::Delivered, self::Cancelled]), // Can be repaired/cleared
            self::Held                => in_array($target, [self::ReceivedByWarehouse, self::LoadedToContainer, self::InTransit, self::Arrived, self::OutForDelivery, self::Delivered, self::Cancelled]), // Can be released
            self::HeldBulging         => in_array($target, [self::ReceivedByWarehouse, self::LoadedToContainer, self::InTransit, self::Arrived, self::OutForDelivery, self::Delivered, self::Cancelled]), // Can be released when paid
            self::Delivered           => false, // Final state
            self::Cancelled           => in_array($target, [self::Pending, self::Collected]), // Re-opening
        };
    }

    public function label(): string
    {
        return __('statuses.box.'.$this->value);
    }
}
