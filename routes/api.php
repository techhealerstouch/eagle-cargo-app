<?php

use App\Http\Controllers\Api\BatchController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\BoxController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\NotificationPreferenceController;
use App\Http\Controllers\Api\TrackingController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware(['auth:sanctum', 'throttle:api']);

// Public tracking API
Route::middleware(['throttle:public-tracking'])->group(function () {
    Route::get('/track/{tracking_number}', [TrackingController::class, 'track']);
    Route::get('/shipping-updates', [TrackingController::class, 'shippingUpdates']);
});

// Authenticated API for mobile app integration
Route::middleware(['auth:sanctum', 'throttle:api'])->group(function () {
    // Bookings
    Route::get('/bookings', [BookingController::class, 'index']);
    Route::get('/bookings/{identifier}', [BookingController::class, 'show']);
    Route::put('/bookings/{identifier}', [BookingController::class, 'update']);

    // Boxes
    Route::post('/boxes/sync', [BoxController::class, 'bulkSync']);
    Route::get('/boxes', [BoxController::class, 'index']);
    Route::get('/boxes/{trackingNumber}', [BoxController::class, 'show']);
    Route::put('/boxes/{trackingNumber}', [BoxController::class, 'update']);

    // Batches
    Route::get('/batches', [BatchController::class, 'index']);
    Route::get('/batches/{identifier}', [BatchController::class, 'show']);
    Route::get('/batches/{identifier}/boxes', [BatchController::class, 'boxes']);
});

// Authenticated notification API
Route::middleware(['auth:sanctum', 'throttle:api'])->prefix('notifications')->group(function () {
    Route::get('/', [NotificationController::class, 'index']);
    Route::get('/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/read-all', [NotificationController::class, 'markAllAsRead']);

    // Preferences
    Route::get('/preferences', [NotificationPreferenceController::class, 'index']);
    Route::put('/preferences', [NotificationPreferenceController::class, 'update']);
    Route::put('/preferences/bulk', [NotificationPreferenceController::class, 'bulkUpdate']);
});
