<?php

namespace App\Enums;

enum TrackingPhase: string
{
    // Phase 1: Origin (The Departure)
    case PICKED_UP = 'picked_up';
    case RECEIVED_BY_WAREHOUSE = 'received_by_branch';
    case ARRIVED_AT_WAREHOUSE = 'arrived_at_warehouse';
    case PROCESSING = 'processing';
    case LOADING_CONTAINER = 'loading_container';
    case DEPARTED_FROM_ORIGIN = 'departed_from_origin';

    // Phase 2: International Transit (The Long Wait)
    case IN_TRANSIT_SEA = 'in_transit_sea';
    case ARRIVED_MANILA_PORT = 'arrived_manila_port';
    case CUSTOMS_CLEARANCE = 'under_customs_clearance';
    case RELEASED_BY_BOC = 'released_by_boc';

    // Phase 3: Destination (The Last Mile)
    case RECEIVED_MANILA_WAREHOUSE = 'received_manila_warehouse';
    case SORTING = 'sorting';
    case DISPATCHED_TO_LOCAL_HUB = 'dispatched_to_local_hub';
    case OUT_FOR_DELIVERY = 'out_for_delivery';
    case DELIVERED = 'delivered';

    /**
     * Get the human-readable label for the status.
     */
    public function label(): string
    {
        $key = 'statuses.tracking_phase.'.$this->value;
        $trans = __($key);
        if ($trans !== $key) {
            return $trans;
        }

        return match ($this) {
            self::PICKED_UP => 'Picked Up',
            self::RECEIVED_BY_WAREHOUSE => 'Received by Warehouse',
            self::ARRIVED_AT_WAREHOUSE => 'Arrived at Warehouse',
            self::PROCESSING => 'Processing',
            self::LOADING_CONTAINER => 'Loading in Container',
            self::DEPARTED_FROM_ORIGIN => 'Departed from Origin Port',
            self::IN_TRANSIT_SEA => 'In Transit (Sea)',
            self::ARRIVED_MANILA_PORT => 'Arrived at Manila Port',
            self::CUSTOMS_CLEARANCE => 'Under Customs Clearance',
            self::RELEASED_BY_BOC => 'Released by BOC',
            self::RECEIVED_MANILA_WAREHOUSE => 'Received at Manila Warehouse',
            self::SORTING => 'Sorting',
            self::DISPATCHED_TO_LOCAL_HUB => 'Dispatched to Local Hub',
            self::OUT_FOR_DELIVERY => 'Out for Delivery',
            self::DELIVERED => 'Delivered',
        };
    }

    /**
     * Get the major phase name.
     */
    public function phase(): string
    {
        return match ($this) {
            self::PICKED_UP, self::RECEIVED_BY_WAREHOUSE, self::ARRIVED_AT_WAREHOUSE,
            self::PROCESSING, self::LOADING_CONTAINER, self::DEPARTED_FROM_ORIGIN => 'Origin',

            self::IN_TRANSIT_SEA, self::ARRIVED_MANILA_PORT,
            self::CUSTOMS_CLEARANCE, self::RELEASED_BY_BOC => 'International Transit',

            self::RECEIVED_MANILA_WAREHOUSE, self::SORTING,
            self::DISPATCHED_TO_LOCAL_HUB, self::OUT_FOR_DELIVERY, self::DELIVERED => 'Destination',
        };
    }
}
