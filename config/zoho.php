<?php

return [
    'client_id' => env('ZOHO_CLIENT_ID'),
    'client_secret' => env('ZOHO_CLIENT_SECRET'),
    'refresh_token' => env('ZOHO_REFRESH_TOKEN'),
    'org_id' => env('ZOHO_ORG_ID'),
    'base_url' => env('ZOHO_BASE_URL', 'https://www.zohoapis.com/books/v3'),
];
