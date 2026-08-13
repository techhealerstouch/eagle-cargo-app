<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class NotificationController extends Controller
{
    /**
     * Show the notification settings page.
     */
    public function edit(): Response
    {
        return Inertia::render('settings/notifications');
    }
}
