<?php

return [
    'validation' => [
        'admin_booking' => [
            'sender_id' => [
                'required' => 'Please select a sender for this booking.',
                'exists' => 'The selected sender does not exist.',
            ],
            'service_type' => [
                'required' => 'Please select a service type.',
            ],
            'status' => [
                'required' => 'Booking status is required.',
                'in' => 'Invalid booking status selected.',
            ],
            'recipient_name' => [
                'required' => 'Recipient name is required.',
            ],
            'recipient_address' => [
                'required' => 'Recipient address is required.',
            ],
            'payment_status' => [
                'required' => 'Payment status is required.',
                'in' => 'Invalid payment status selected.',
            ],
            'declaration_form_status' => [
                'required' => 'Declaration form status is required.',
                'in' => 'Invalid declaration form status selected.',
            ],
        ],
        'payment' => [
            'invoice_id' => [
                'required' => 'Please select an invoice.',
                'exists' => 'The selected invoice does not exist.',
            ],
            'amount' => [
                'required' => 'Payment amount is required.',
                'min' => 'Payment amount must be at least $0.01.',
            ],
        ],
    ],
    'notifications' => [
        'booking_status' => [
            'subject' => 'Booking Status Update: :reference',
            'greeting' => 'Hello :name!',
            'line_status' => 'Your booking status is now: :status',
            'line_reference' => 'Reference: :reference',
            'action' => 'Track your booking',
            'closing' => 'Thank you for choosing :appName.',
            'sms' => ':appName: Your booking :reference is now :status. Track at: :url',
        ],
        'booking_payment' => [
            'subject' => 'Payment Confirmed: :reference',
            'greeting' => 'Hello :name!',
            'line_paid' => 'Your booking :reference has been marked as paid.',
            'line_invoice' => 'Invoice No.: :invoice',
            'line_copy_required' => 'Please keep a copy of this invoice for your records.',
            'action' => 'View your bookings',
            'closing' => 'Thank you for choosing :appName.',
        ],
        'box_status' => [
            'subject' => 'Package Update: :tracking',
            'greeting' => 'Hello :name!',
            'line_status' => 'Your package (:box_type) status is now: :status',
            'line_tracking' => 'Tracking: :tracking',
            'action' => 'Track Package',
            'closing' => 'Thank you!',
            'sms' => ':appName: Box :tracking is now :status. Track: :url',
        ],
        'pickup_reminder' => [
            'sms' => ':appName reminder: Your pickup (:reference) is scheduled for :date. Please make sure your boxes and declaration forms are ready.',
        ],
        'runsheet_assigned' => [
            'subject' => 'New Runsheet Assigned: :date',
            'greeting' => 'Hello :name!',
            'line_commission' => 'You have a new runsheet assignment on :date. Pick it up to earn commission!',
            'line_delivery' => 'You have a new delivery runsheet assignment on :date.',
            'action' => 'View Runsheet',
            'closing' => 'Be safe on the road!',
            'sms_commission' => ':appName: You have a new runsheet assignment on :date. Pick it up to earn commission! Details: :url',
            'sms_delivery' => ':appName: You have a new delivery runsheet assignment on :date. Details: :url',
        ],
        'batch' => [
            'subject' => [
                'ready_to_close' => 'Batch :batch Ready to Close',
                'closed' => 'Batch :batch Closed',
                'departed' => 'Batch :batch Departed',
                'arrived' => 'Batch :batch Arrived',
                'default' => 'Batch :batch Status Update',
            ],
            'message' => [
                'ready_to_close' => 'Batch :batch has reached capacity with :box_count boxes and is ready to close.',
                'closed' => 'Batch :batch has been closed and is preparing for departure.',
                'departed' => 'Batch :batch has departed from :port.',
                'arrived' => 'Batch :batch has arrived at :port.',
                'default' => 'Batch :batch status is now :status.',
            ],
            'details' => 'Batch Number: :batch_number | Voyage: :voyage | Route: :route',
            'action' => 'View Batch Details',
            'closing' => ':appName - Bringing your love home.',
        ],
        'account_created' => [
            'subject' => 'Welcome to :appName - Your Account Has Been Created',
            'greeting' => 'Hello :name!',
            'line_created' => 'An account has been created for you by the administrator with the role of :role.',
            'line_credentials' => 'To log in, please use your email: :email and the following login password:',
            'line_action' => 'Since your profile is partially created, please log in and update your address, contact details, and password under your profile settings.',
            'action' => 'Log In to Your Account',
            'closing' => 'Thank you for choosing :appName.',

            'picker' => [
                'subject' => 'Welcome to :appName - Your Picker Portal Account Has Been Created',
                'line_created' => 'You have been registered as an authorized Picker (Field Collection Agent) for :appName.',
                'line_credentials' => 'Please use the following credentials to access the Picker Portal:',
                'instructions_heading' => 'Instructions on how to access the Picker Portal:',
                'step_1' => 'Click the "Log In to Picker Portal" button below to open the portal login page.',
                'step_2' => 'Enter your registered email address and default login password shown above.',
                'step_3' => 'Upon login, you will be automatically directed to your Picker Portal dashboard to view assigned pickup runsheets, scan and receive boxes, and record collections.',
                'step_4' => 'For security, please update your password in Profile Settings after your initial login.',
                'action' => 'Log In to Picker Portal',
                'closing' => ':appName - Dedicated Field Operations.',
            ],
            'courier' => [
                'subject' => 'Welcome to :appName - Your Courier Portal Account Has Been Created',
                'line_created' => 'You have been registered as an authorized Courier for :appName.',
                'line_credentials' => 'Please use the following credentials to access the Courier Portal:',
                'instructions_heading' => 'Instructions on how to access the Courier Portal:',
                'step_1' => 'Click the "Log In to Courier Portal" button below to open the login page.',
                'step_2' => 'Enter your registered email address and default login password shown above.',
                'step_3' => 'Upon login, you will be automatically directed to your Courier Portal to manage delivery runsheets, scan parcels, and record proofs of delivery.',
                'step_4' => 'For security, please update your password in Profile Settings after your initial login.',
                'action' => 'Log In to Courier Portal',
                'closing' => ':appName - Dedicated Logistics & Delivery Operations.',
            ],
            'warehouse' => [
                'subject' => 'Welcome to :appName - Your Warehouse Portal Account Has Been Created',
                'line_created' => 'You have been registered as Warehouse Staff for :appName.',
                'line_credentials' => 'Please use the following credentials to access the Warehouse Portal:',
                'instructions_heading' => 'Instructions on how to access the Warehouse Portal:',
                'step_1' => 'Click the button below to sign in with your email and default password.',
                'step_2' => 'Upon login, you will have access to the Warehouse Portal to manage container packing, scan received items, and update batch statuses.',
                'step_3' => 'For security, please update your password in Profile Settings after your initial sign in.',
                'action' => 'Log In to Warehouse Portal',
                'closing' => ':appName - Warehouse & Freight Operations.',
            ],
        ],
    ],
    'defaults' => [
        'recipient_name' => 'Customer',
        'box_type' => 'Standard Box',
        'upcoming_date' => 'upcoming',
    ],
];
