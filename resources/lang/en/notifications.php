<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Notification Event Labels
    |--------------------------------------------------------------------------
    */
    'events' => [
        // Box lifecycle
        'box_collected' => 'Box Collected',
        'box_shipped' => 'Box Shipped',
        'box_in_transit' => 'Box In Transit',
        'box_arrived' => 'Box Arrived',
        'box_out_for_delivery' => 'Out for Delivery',
        'box_delivered' => 'Box Delivered',

        // Batch lifecycle
        'batch_ready_to_close' => 'Batch Ready to Close',
        'batch_closed' => 'Batch Closed',
        'batch_departed' => 'Batch Departed',
        'batch_arrived' => 'Batch Arrived',
        'batch_delivered' => 'Batch Delivered',

        // Payments
        'payment_received' => 'Payment Received',
        'payment_reminder' => 'Payment Reminder',

        // Scheduling
        'pickup_scheduled' => 'Pickup Scheduled',
        'pickup_reminder' => 'Pickup Reminder',
        'delivery_attempt_failed' => 'Delivery Attempt Failed',
        'runsheet_assigned' => 'Runsheet Assigned',
    ],

    /*
    |--------------------------------------------------------------------------
    | Channel Labels
    |--------------------------------------------------------------------------
    */
    'channels' => [
        'email' => 'Email',
        'sms' => 'SMS',
        'push' => 'Push Notification',
        'in_app' => 'In-App',
    ],

    /*
    |--------------------------------------------------------------------------
    | Preference Categories
    |--------------------------------------------------------------------------
    */
    'categories' => [
        'box' => 'Box Tracking',
        'batch' => 'Batch Updates',
        'payment' => 'Payments',
        'scheduling' => 'Pickup & Delivery',
    ],

    /*
    |--------------------------------------------------------------------------
    | Common Notification Text
    |--------------------------------------------------------------------------
    */
    'greeting' => 'Hello :name!',
    'closing' => 'Thank you for choosing :appName!',
    'track_action' => 'Track Your Package',

    /*
    |--------------------------------------------------------------------------
    | Batch Notifications (for senders)
    |--------------------------------------------------------------------------
    */
    'batch' => [
        'subject' => [
            'departed' => 'Your Package is On Its Way - Batch :batch',
            'arrived' => 'Your Package Has Arrived - Batch :batch',
            'delivered' => 'Package Delivered - Batch :batch',
            'update' => 'Shipment Update - Batch :batch',
        ],
        'message' => [
            'departed' => 'Great news! Your shipment (Batch :batch) has departed from :port. Estimated arrival: :eta.',
            'arrived' => 'Your shipment (Batch :batch) has arrived at :port and will be out for delivery soon.',
            'delivered' => 'Your package from Batch :batch has been delivered! We hope your loved ones enjoy it.',
            'update' => 'Your shipment (Batch :batch) status has been updated to :status.',
        ],
    ],
];
