<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Operational SLA Thresholds
    |--------------------------------------------------------------------------
    |
    | These values drive warehouse aging buckets and operations exception
    | warnings. Keep them conservative so alerts surface before customer
    | tracking expectations are missed.
    |
    */
    'sla_hours' => [
        'delayed_receipt' => (int) env('LOGISTICS_SLA_DELAYED_RECEIPT_HOURS', 24),
        'missed_pickup' => (int) env('LOGISTICS_SLA_MISSED_PICKUP_HOURS', 24),
        'overdue_loading' => (int) env('LOGISTICS_SLA_OVERDUE_LOADING_HOURS', 24),
        'arrived_sorting' => (int) env('LOGISTICS_SLA_ARRIVED_SORTING_HOURS', 48),
        'delivery_overdue' => (int) env('LOGISTICS_SLA_DELIVERY_OVERDUE_HOURS', 12),
        'missed_eta' => (int) env('LOGISTICS_SLA_MISSED_ETA_HOURS', 24),
        'stale_scan' => (int) env('LOGISTICS_SLA_STALE_SCAN_HOURS', 72),
    ],
];
