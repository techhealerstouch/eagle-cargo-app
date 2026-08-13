<?php

use App\Http\Controllers\Admin\AreaController;
use App\Http\Controllers\Admin\PickupZoneController;
use App\Http\Controllers\Admin\SuburbController;
use App\Http\Controllers\Admin\AreaMilestoneController;
use App\Http\Controllers\Admin\BatchController;
use App\Http\Controllers\Admin\BoxController;
use App\Http\Controllers\Admin\BoxPriceController;
use App\Http\Controllers\Admin\BoxTypeController;
use App\Http\Controllers\Admin\CommissionController;
use App\Http\Controllers\Admin\DataIntegrityController;
use App\Http\Controllers\Admin\EnquiryController;
use App\Http\Controllers\Admin\FinancialReportController;
use App\Http\Controllers\Admin\InvoiceController;
use App\Http\Controllers\Admin\PaymentController;
use App\Http\Controllers\Admin\ProvinceController;
use App\Http\Controllers\Admin\RecipientController;
use App\Http\Controllers\Admin\RunsheetController;
use App\Http\Controllers\Admin\SenderController;
use App\Http\Controllers\Admin\ShippingUpdateController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\CourierController;
use App\Http\Controllers\MockPaymentController;
use App\Http\Controllers\Picker\EarningsController;
use App\Http\Controllers\Picker\StripeOnboardingController;
use App\Http\Controllers\PickerController;
use App\Http\Controllers\RecipientDashboardController;
use App\Http\Controllers\SenderDashboardController;
use App\Http\Controllers\SenderRecipientController;
use App\Http\Controllers\StripePaymentController;
use App\Http\Controllers\TrackingController;
use App\Http\Controllers\WarehouseController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;

Route::get('/', function () {
    return redirect()->route('login');
});

Route::get('/uploads/{path}', function (string $path) {
    $relativePath = ltrim($path, '/');

    if (str_contains($relativePath, '..')) {
        abort(404);
    }

    $disk = Storage::disk('public');

    if (! $disk->exists($relativePath)) {
        \Illuminate\Support\Facades\Log::warning('Storage file not found', [
            'path' => $relativePath,
            'full_path' => $disk->path($relativePath),
            'symlink_exists' => is_link(public_path('storage')),
        ]);
        abort(404);
    }

    $fullPath = $disk->path($relativePath);

    // Ensure the file is actually readable by the web server
    if (! is_readable($fullPath)) {
        \Illuminate\Support\Facades\Log::error('Storage file exists but is not readable (403)', [
            'path' => $relativePath,
            'full_path' => $fullPath,
            'permissions' => substr(sprintf('%o', fileperms($fullPath)), -4),
            'owner' => function_exists('posix_getpwuid') ? posix_getpwuid(fileowner($fullPath))['name'] ?? fileowner($fullPath) : fileowner($fullPath),
        ]);
        abort(403, 'File is not readable. Check server file permissions.');
    }

    // Only serve safe file types
    $allowedMimes = [
        'jpeg' => 'image/jpeg',
        'jpg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
        'svg' => 'image/svg+xml',
        'pdf' => 'application/pdf',
    ];

    $extension = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));

    // Safely try to detect the MIME type via fileinfo
    try {
        $mimeType = \Illuminate\Support\Facades\File::mimeType($fullPath);
    } catch (\Exception $e) {
        $mimeType = null;
    }

    // Fallback to extension mapping if fileinfo returned a generic type or failed
    if (! $mimeType || $mimeType === 'application/octet-stream') {
        $mimeType = $allowedMimes[$extension] ?? null;
    }

    if (! $mimeType || ! in_array($mimeType, $allowedMimes, true)) {
        abort(403);
    }

    return response()->file($fullPath, [
        'Cache-Control' => 'public, max-age=31536000, immutable',
        'Content-Type' => $mimeType,
    ]);
})->where('path', '.*')->name('public.storage');




if (app()->environment('local')) {
    Route::get('/run-tests', function () {
        Artisan::call('test', ['--filter' => 'Booking']);

        return '<pre>'.Artisan::output().'</pre>';
    })->name('maintenance.run-tests');
}

// Stripe webhook — must be outside auth middleware (Stripe servers POST with no session).
// CSRF is already excluded via bootstrap/app.php ('stripe/*').
// Authentication is handled by Stripe's webhook signature verification.
Route::post('/stripe/webhook', [StripePaymentController::class, 'webhook'])->name('stripe.webhook');

Route::get('/track', [TrackingController::class, 'index'])->middleware('throttle:public-tracking')->name('track');

Route::get('/tracking', function () {
    return redirect()->route('track');
});

Route::get('/tracking/{reference}', function (Request $request, $reference) {
    return redirect()->route('track', array_merge(['tracking_number' => $reference], $request->query()));
});

Route::get('/track/{tracking_number}', function (Request $request, $tracking_number) {
    return redirect()->route('track', array_merge(['tracking_number' => $tracking_number], $request->query()));
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('/home', 'welcome')->name('home');
    Route::get('/notifications', function () {
        return inertia('notifications/index');
    })->name('notifications.index');
    Route::inertia('/about', 'marketing/about')->name('about');
    Route::inertia('/services', 'marketing/services')->name('services');
    Route::inertia('/faq', 'marketing/faq')->name('faq');
    Route::get('/contact', function () {
        return inertia('marketing/contact');
    })->name('contact');
    Route::post('/contact', [App\Http\Controllers\EnquiryController::class, 'store'])->middleware('throttle:forms')->name('enquiries.store');

    Route::get('/book', [BookingController::class, 'create'])->name('book');
    Route::get('/declaration-form/blank', [BookingController::class, 'downloadBlankDeclaration'])->name('declaration.blank');
    Route::post('/bookings', [BookingController::class, 'store'])->middleware('throttle:booking-writes')->name('bookings.store');
    Route::post('/bookings/initialize', [BookingController::class, 'initialize'])->middleware('throttle:booking-writes')->name('bookings.initialize');
    Route::post('/bookings/draft', [BookingController::class, 'saveDraft'])->middleware('throttle:booking-writes')->name('bookings.draft');
    Route::post('/bookings/{booking}/submit-draft', [BookingController::class, 'submitDraft'])->middleware('throttle:booking-writes')->name('bookings.submit-draft');
    Route::get('/bookings/{booking}/pay', [BookingController::class, 'pay'])->name('bookings.pay');
    Route::get('/bookings/{booking}/invoice-pdf', [BookingController::class, 'downloadInvoice'])->name('bookings.invoice_pdf');
    Route::post('/bookings/{booking}/mock-pay', [MockPaymentController::class, 'simulate'])->middleware('throttle:payments')->name('bookings.mock-pay');
    Route::post('/bookings/{booking}/stripe-intent', [StripePaymentController::class, 'createIntent'])->middleware('throttle:payments')->name('bookings.stripe-intent');
    Route::post('/bookings/{booking}/stripe-verify', [StripePaymentController::class, 'verifyPayment'])->middleware('throttle:payments')->name('bookings.stripe-verify');
    Route::post('/bookings/{booking}/upload-proof', [BookingController::class, 'uploadProofOfPayment'])->middleware('throttle:uploads')->name('bookings.upload-proof');

    Route::get('/bookings/{booking}/edit', [BookingController::class, 'edit'])->name('bookings.edit');
    Route::put('/bookings/{booking}', [BookingController::class, 'update'])->middleware('throttle:booking-writes')->name('bookings.update');
    Route::delete('/bookings/{booking}', [BookingController::class, 'destroy'])->middleware('throttle:booking-writes')->name('bookings.destroy');
    Route::inertia('/our-story', 'marketing/community-story')->name('our-story');
    Route::post('/track/upload-declaration', [TrackingController::class, 'uploadDeclaration'])->middleware('throttle:uploads')->name('track.upload-declaration');
    Route::get('/track/declaration/{booking}', [TrackingController::class, 'showDeclarationForm'])->name('track.declaration.form');
    Route::get('/track/declaration/{booking}/view', [TrackingController::class, 'viewDeclaration'])->name('track.declaration.view');
    Route::post('/track/declaration', [TrackingController::class, 'saveDeclarationData'])->middleware('throttle:forms')->name('track.declaration.save');
    Route::inertia('/shipping-updates', 'marketing/shipping-updates')->name('shipping-updates');

    Route::get('/dashboard', [SenderDashboardController::class, 'index'])->name('dashboard');
    Route::get('/bookings', [SenderDashboardController::class, 'bookings'])->name('sender.bookings');
    Route::middleware(['role:sender'])->prefix('recipients')->name('sender.recipients.')->group(function () {
        Route::get('/', [SenderRecipientController::class, 'index'])->name('index');
        Route::get('/{recipient}/edit', [SenderRecipientController::class, 'edit'])->name('edit');
        Route::put('/{recipient}', [SenderRecipientController::class, 'update'])->middleware('throttle:booking-writes')->name('update');
        Route::delete('/{recipient}', [SenderRecipientController::class, 'destroy'])->middleware('throttle:booking-writes')->name('destroy');
    });

    // Recipient Routes
    Route::middleware(['role:recipient'])->prefix('recipient')->group(function () {
        Route::get('/dashboard', [RecipientDashboardController::class, 'index'])->name('recipient.dashboard');
    });

    // Admin & Warehouse Shared Pages
    Route::prefix('admin')->name('admin.')->middleware(['role:admin,super_admin,warehouse'])->group(function () {
        Route::post('boxes/bulk-assign-to-batch', [BoxController::class, 'bulkAssignToBatch'])->middleware('throttle:admin-mutations')->name('boxes.bulk-assign-to-batch');
        Route::post('boxes/bulk-update-status', [BoxController::class, 'bulkUpdateStatus'])->middleware('throttle:admin-mutations')->name('boxes.bulk-update-status');
        Route::post('boxes/{box}/update-status', [BoxController::class, 'updateStatus'])->middleware('throttle:admin-mutations')->name('boxes.update-status');
        Route::delete('boxes/bulk-destroy', [BoxController::class, 'bulkDestroy'])->middleware('throttle:admin-mutations')->name('boxes.bulk-destroy');
        Route::post('boxes/{id}/restore', [BoxController::class, 'restore'])->middleware('throttle:admin-mutations')->name('boxes.restore');
        Route::resource('boxes', BoxController::class);
        Route::get('runsheets/pickups', [RunsheetController::class, 'pickups'])->name('runsheets.pickups');
        Route::get('runsheets/deliveries', [RunsheetController::class, 'deliveries'])->name('runsheets.deliveries');
        Route::resource('runsheets', RunsheetController::class);
        Route::post('runsheets/{runsheet}/attach-bookings', [RunsheetController::class, 'attachBookings'])->middleware('throttle:admin-mutations')->name('runsheets.attachBookings');
        Route::post('runsheets/{runsheet}/reorder', [RunsheetController::class, 'reorder'])->middleware('throttle:admin-mutations')->name('runsheets.reorder');

        Route::post('batches/bulk-update-status', [BatchController::class, 'bulkUpdateStatus'])->middleware('throttle:admin-mutations')->name('batches.bulk-update-status');
        Route::delete('batches/bulk-destroy', [BatchController::class, 'bulkDestroy'])->middleware('throttle:admin-mutations')->name('batches.bulk-destroy');
        Route::resource('batches', BatchController::class);
        Route::post('batches/{batch}/confirm-manifest', [BatchController::class, 'confirmManifest'])->middleware('throttle:admin-mutations')->name('batches.confirmManifest');
        Route::post('batches/{batch}/confirm-arrival', [BatchController::class, 'confirmArrival'])->middleware('throttle:admin-mutations')->name('batches.confirmArrival');
        Route::post('batches/{batch}/load-boxes', [BatchController::class, 'loadBoxes'])->middleware('throttle:admin-mutations')->name('batches.loadBoxes');
        Route::post('batches/{batch}/tracking-phase', [BatchController::class, 'bulkUpdateTrackingPhase'])
            ->middleware('throttle:admin-mutations')
            ->name('batches.bulkUpdateTrackingPhase');
        Route::get('batches/{batch}/available-boxes', [BatchController::class, 'availableBoxes'])->name('batches.availableBoxes');
    });

    // Admin Pages
    Route::prefix('admin')->name('admin.')->middleware(['role:admin,super_admin'])->group(function () {
        Route::post('bookings/bulk-update-status', [App\Http\Controllers\Admin\BookingController::class, 'bulkUpdateStatus'])->middleware('throttle:admin-mutations')->name('bookings.bulk-update-status');
        Route::post('bookings/bulk-update-payment-status', [App\Http\Controllers\Admin\BookingController::class, 'bulkUpdatePaymentStatus'])->middleware('throttle:admin-mutations')->name('bookings.bulk-update-payment-status');
        Route::post('bookings/bulk-update-notes', [App\Http\Controllers\Admin\BookingController::class, 'bulkUpdateNotes'])->middleware('throttle:admin-mutations')->name('bookings.bulk-update-notes');
        Route::post('bookings/bulk-assign-to-runsheet', [App\Http\Controllers\Admin\BookingController::class, 'bulkAssignToRunsheet'])->middleware('throttle:admin-mutations')->name('bookings.bulk-assign-to-runsheet');
        Route::post('bookings/bulk-accept', [App\Http\Controllers\Admin\BookingController::class, 'bulkAccept'])->middleware('throttle:admin-mutations')->name('bookings.bulk-accept');
        Route::post('bookings/bulk-cancel', [App\Http\Controllers\Admin\BookingController::class, 'bulkCancel'])->middleware('throttle:admin-mutations')->name('bookings.bulk-cancel');
        Route::delete('bookings/bulk-destroy', [App\Http\Controllers\Admin\BookingController::class, 'bulkDestroySelected'])->middleware('throttle:admin-mutations')->name('bookings.bulk-destroy-selected');
        Route::post('bookings/{id}/restore', [App\Http\Controllers\Admin\BookingController::class, 'restore'])->middleware('throttle:admin-mutations')->name('bookings.restore');
        Route::resource('bookings', App\Http\Controllers\Admin\BookingController::class)->except(['update']);
        Route::put('bookings/{booking}', [App\Http\Controllers\Admin\BookingController::class, 'update'])->middleware('throttle:admin-mutations')->name('bookings.update');
        Route::post('bookings/{booking}/accept', [App\Http\Controllers\Admin\BookingController::class, 'accept'])->middleware('throttle:admin-mutations')->name('bookings.accept');
        Route::post('bookings/{booking}/assign-picker', [App\Http\Controllers\Admin\BookingController::class, 'assignPicker'])->middleware('throttle:admin-mutations')->name('bookings.assignPicker');
        Route::post('bookings/{booking}/assign-courier', [App\Http\Controllers\Admin\BookingController::class, 'assignCourier'])->middleware('throttle:admin-mutations')->name('bookings.assignCourier');
        Route::get('bookings/{booking}/declaration', [App\Http\Controllers\Admin\BookingController::class, 'viewDeclaration'])->name('bookings.declaration.view');
        Route::get('bookings/{booking}/declaration-file', [App\Http\Controllers\Admin\BookingController::class, 'viewDeclarationFile'])->name('bookings.declaration.file');
        Route::get('bookings/{booking}/declaration-pdf', [App\Http\Controllers\Admin\BookingController::class, 'printDeclarationPdf'])->name('bookings.declaration.pdf');

        Route::get('senders/bulk-export', [SenderController::class, 'bulkExport'])->name('senders.bulk-export');
        Route::delete('senders/bulk-destroy', [SenderController::class, 'bulkDestroy'])->middleware('throttle:admin-mutations')->name('senders.bulk-destroy');
        Route::resource('senders', SenderController::class);
        Route::get('invoices/{invoice}', [InvoiceController::class, 'show'])->name('invoices.show')->withoutMiddleware(['role:admin,super_admin'])->middleware('role:admin,super_admin,picker');
        Route::get('invoices/{invoice}/pdf', [InvoiceController::class, 'pdf'])->name('invoices.pdf')->withoutMiddleware(['role:admin,super_admin'])->middleware('role:admin,super_admin,picker');
        Route::post('invoices/bulk-mark-paid', [InvoiceController::class, 'bulkMarkPaid'])->middleware('throttle:admin-mutations')->name('invoices.bulk-mark-paid');
        Route::delete('invoices/bulk-destroy', [InvoiceController::class, 'bulkDestroy'])->middleware('throttle:admin-mutations')->name('invoices.bulk-destroy');
        Route::post('invoices/{id}/restore', [InvoiceController::class, 'restore'])->middleware('throttle:admin-mutations')->name('invoices.restore');
        Route::resource('invoices', InvoiceController::class)->except(['create', 'store', 'show']);
        Route::resource('payments', PaymentController::class)->only(['index', 'create', 'store', 'destroy']);
        Route::post('payments/{payment}/confirm', [PaymentController::class, 'confirm'])->middleware('throttle:admin-mutations')->name('payments.confirm');
        Route::post('payments/{payment}/reject', [PaymentController::class, 'reject'])->middleware('throttle:admin-mutations')->name('payments.reject');
        Route::resource('enquiries', EnquiryController::class)->only(['index', 'show', 'update', 'destroy']);
        Route::resource('shipping-updates', ShippingUpdateController::class);
        Route::post('users/{id}/restore', [UserController::class, 'restore'])->middleware('throttle:admin-mutations')->name('users.restore');
        Route::resource('users', UserController::class)->withTrashed();
        Route::post('serial-numbers/bulk-void', [App\Http\Controllers\Admin\SerialNumberController::class, 'bulkVoid'])->name('serial-numbers.bulk-void');
        Route::post('serial-numbers/{serialNumber}/void', [App\Http\Controllers\Admin\SerialNumberController::class, 'void'])->name('serial-numbers.void');
        Route::get('serial-numbers/export', [App\Http\Controllers\Admin\SerialNumberController::class, 'export'])->name('serial-numbers.export');
        Route::resource('serial-numbers', App\Http\Controllers\Admin\SerialNumberController::class)->only(['index', 'store', 'show']);
        Route::resource('recipients', RecipientController::class)->only(['index', 'show', 'edit', 'update', 'destroy']);

        // Commissions
        Route::get('commissions', [CommissionController::class, 'index'])->name('commissions.index');
        Route::get('commissions/payouts', [CommissionController::class, 'payouts'])->name('commissions.payouts');
        Route::post('commissions/users/{picker}/payout', [CommissionController::class, 'processPayout'])->name('commissions.process-payout');
        Route::put('commissions/settings', [CommissionController::class, 'updateGlobalSettings'])->name('commissions.update-global-settings');

        // System Health
        Route::middleware(['role:super_admin'])->group(function () {
            Route::get('data-integrity', [DataIntegrityController::class, 'index'])->name('data-integrity.index');
            Route::post('data-integrity/scan', [DataIntegrityController::class, 'scan'])->name('data-integrity.scan');
            Route::post('data-integrity/{warning}/resolve', [DataIntegrityController::class, 'resolve'])->name('data-integrity.resolve');
        });

        // Reports
        Route::get('reports/financial', [FinancialReportController::class, 'index'])->name('reports.financial');
        Route::get('reports/financial/pdf', [FinancialReportController::class, 'downloadPdf'])->name('reports.financial.pdf');
        Route::get('reports/financial/csv', [FinancialReportController::class, 'downloadCsv'])->name('reports.financial.csv');

        // Tracking Analytics
        Route::get('tracking-analytics', [\App\Http\Controllers\Admin\TrackingAnalyticsController::class, 'index'])->name('tracking-analytics.index');

        // Configurations
        Route::resource('areas', AreaController::class);
        Route::resource('pickup-zones', PickupZoneController::class);
        Route::resource('suburbs', SuburbController::class);
        Route::resource('areas.milestones', AreaMilestoneController::class)->shallow();
        Route::resource('box-types', BoxTypeController::class);
        Route::get('booking-rates', [BoxPriceController::class, 'index'])->name('booking-rates.index');
        Route::post('box-prices/copy', [BoxPriceController::class, 'copy'])->name('box-prices.copy');
        Route::post('box-prices/undo-copy', [BoxPriceController::class, 'undoCopy'])->name('box-prices.undo-copy');
        Route::resource('box-prices', BoxPriceController::class)->only(['store', 'update']);
        Route::resource('provinces', ProvinceController::class);
    });


    // Courier Routes
    Route::middleware(['role:courier'])->prefix('courier')->group(function () {
        Route::get('/dashboard', [CourierController::class, 'dashboard'])->name('courier.dashboard');
        Route::get('/runsheets', [CourierController::class, 'runsheetIndex'])->name('courier.runsheets');
        Route::get('/runsheet/{runsheet}', [CourierController::class, 'runsheetShow'])->name('courier.runsheet');
        Route::post('/runsheet/{runsheet}/start', [CourierController::class, 'startRunsheet'])->middleware('throttle:ops-scan')->name('courier.runsheet.start');
        Route::post('/runsheet/{runsheet}/complete', [CourierController::class, 'completeRunsheet'])->middleware('throttle:ops-scan')->name('courier.runsheet.complete');
        Route::get('/scan', [CourierController::class, 'scanPage'])->name('courier.scan.page');
        Route::post('/scan', [CourierController::class, 'scanBox'])->middleware('throttle:ops-scan')->name('courier.scan');
        Route::get('/box/{box:tracking_number}', [CourierController::class, 'showBox'])->name('courier.box.show');
        Route::put('/box/{box}', [CourierController::class, 'updateBoxStatus'])->middleware('throttle:ops-scan')->name('courier.box.update');
    });

    // Picker Routes
    Route::middleware(['role:picker'])->prefix('picker')->group(function () {
        Route::get('/dashboard', [PickerController::class, 'dashboard'])->name('picker.dashboard');
        Route::get('/earnings', [EarningsController::class, 'index'])->name('picker.earnings');
        Route::post('/earnings/cashout', [EarningsController::class, 'cashout'])->name('picker.earnings.cashout');
        Route::get('/payout-settings', [StripeOnboardingController::class, 'index'])->name('picker.stripe.onboarding');
        Route::post('/payout-preferences', [StripeOnboardingController::class, 'updatePreferences'])->name('picker.stripe.onboarding.preferences');
        Route::post('/stripe-onboarding', [StripeOnboardingController::class, 'start'])->name('picker.stripe.onboarding.start');
        Route::post('/stripe-onboarding/manage', [StripeOnboardingController::class, 'manage'])->name('picker.stripe.onboarding.manage');
        Route::get('/stripe-onboarding/success', [StripeOnboardingController::class, 'success'])->name('picker.stripe.onboarding.success');
        Route::get('/runsheets', [PickerController::class, 'runsheetIndex'])->name('picker.runsheets');
        Route::get('/runsheet/{runsheet}', [PickerController::class, 'runsheetShow'])->name('picker.runsheet');
        Route::post('/runsheet/{runsheet}/start', [PickerController::class, 'startRunsheet'])->middleware('throttle:ops-scan')->name('picker.runsheet.start');
        Route::post('/runsheet/{runsheet}/complete', [PickerController::class, 'completeRunsheet'])->middleware('throttle:ops-scan')->name('picker.runsheet.complete');
        Route::get('/runsheet/{runsheet}/payment/{booking}', [PickerController::class, 'paymentConsole'])->name('picker.runsheet.payment');
        Route::post('/runsheet/{runsheet}/record-payment', [PickerController::class, 'recordPayment'])->middleware('throttle:payments')->name('picker.runsheet.record-payment');
        Route::post('/runsheet/{runsheet}/collect-boxes', [PickerController::class, 'collectBoxes'])->middleware('throttle:ops-scan')->name('picker.runsheet.collect-boxes');
        Route::get('/scan', [PickerController::class, 'scanPage'])->name('picker.scan.page');
        Route::post('/scan', [PickerController::class, 'scanBox'])->middleware('throttle:ops-scan')->name('picker.scan');
        Route::get('/box/{box:tracking_number}', [PickerController::class, 'showBox'])->name('picker.box.show');
        Route::put('/box/{box}', [PickerController::class, 'updateBoxStatus'])->middleware('throttle:ops-scan')->name('picker.box.update');
        Route::post('/box/{box}/upload-declaration', [PickerController::class, 'uploadDeclaration'])->middleware('throttle:uploads')->name('picker.box.upload-declaration');
    });

    // Warehouse Routes
    Route::middleware(['role:warehouse,admin,super_admin'])->prefix('warehouse')->group(function () {
        Route::get('/dashboard', [WarehouseController::class, 'dashboard'])->name('warehouse.dashboard');
        Route::post('/receive', [WarehouseController::class, 'receiveBox'])->middleware('throttle:ops-scan')->name('warehouse.receive');
        Route::post('/load', [WarehouseController::class, 'loadBox'])->middleware('throttle:ops-scan')->name('warehouse.load');
        Route::post('/unload', [WarehouseController::class, 'unloadBox'])->middleware('throttle:ops-scan')->name('warehouse.unload');
        Route::post('/mark-damaged', [WarehouseController::class, 'markDamaged'])->middleware('throttle:ops-scan')->name('warehouse.mark-damaged');
        Route::post('/mark-held', [WarehouseController::class, 'markHeld'])->middleware('throttle:ops-scan')->name('warehouse.mark-held');
        Route::post('/update-physicals', [WarehouseController::class, 'updatePhysicals'])->middleware('throttle:ops-scan')->name('warehouse.update-physicals');
        
        // API Endpoints for Dashboard
        Route::get('/api/batches/{batch}', [WarehouseController::class, 'apiBatchDetails'])->name('warehouse.api.batches.show');
    });
});

require __DIR__.'/settings.php';

if (app()->environment('local') && file_exists(__DIR__.'/local.php')) {
    require __DIR__.'/local.php';
}
