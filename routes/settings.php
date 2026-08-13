<?php

use App\Http\Controllers\Admin\DeclarationSettingController;
use App\Http\Controllers\Admin\GeneralSettingController;
use App\Http\Controllers\Admin\LogisticsSettingController;
use App\Http\Controllers\Admin\TrackingSettingController;
use App\Http\Controllers\Settings\NotificationController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\Settings\SecurityController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    Route::redirect('settings', '/settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');

    Route::middleware(['auth', 'verified'])->group(function () {
        Route::middleware(['can:access-admin'])->group(function () {
            Route::get('settings/general', [GeneralSettingController::class, 'index'])->name('settings.general.index');
            Route::post('settings/general', [GeneralSettingController::class, 'update'])->middleware('throttle:admin-mutations')->name('settings.general.update');

            Route::get('settings/invoice', [GeneralSettingController::class, 'invoiceIndex'])->name('settings.invoice.index');
            Route::post('settings/invoice', [GeneralSettingController::class, 'update'])->middleware('throttle:admin-mutations')->name('settings.invoice.update');
            Route::get('settings/invoice/preview', [GeneralSettingController::class, 'previewInvoice'])->name('settings.invoice.preview');

            Route::get('settings/tracking', [TrackingSettingController::class, 'index'])->name('settings.tracking.index');
            Route::put('settings/tracking', [TrackingSettingController::class, 'update'])->middleware('throttle:admin-mutations')->name('settings.tracking.update');

            Route::get('settings/logistics', [LogisticsSettingController::class, 'index'])->name('settings.logistics.index');
            Route::post('settings/logistics', [LogisticsSettingController::class, 'update'])->middleware('throttle:admin-mutations')->name('settings.logistics.update');

            Route::get('settings/declaration', [DeclarationSettingController::class, 'index'])->name('settings.declaration.index');
            Route::post('settings/declaration', [DeclarationSettingController::class, 'update'])->middleware('throttle:admin-mutations')->name('settings.declaration.update');
        });
    });
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/security', [SecurityController::class, 'edit'])->name('security.edit');

    Route::put('settings/password', [SecurityController::class, 'update'])
        ->middleware('throttle:6,1')
        ->name('user-password.update');

    Route::inertia('settings/appearance', 'settings/appearance')->name('appearance.edit');

    Route::get('settings/notifications', [NotificationController::class, 'edit'])->name('notifications.edit');
});
