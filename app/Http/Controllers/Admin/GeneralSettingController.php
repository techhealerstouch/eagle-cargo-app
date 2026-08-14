<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Enums\InvoiceStatus;
use App\Models\Booking;
use App\Models\Invoice;
use App\Models\Setting;
use App\Services\SettingsService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class GeneralSettingController extends Controller
{
    /**
     * The fixed list of general settings that should always be available.
     */
    protected const GENERAL_SETTINGS = [
        'app_name' => 'Business Name',
        'app_subtitle' => 'Tagline',
        'app_logo' => 'Business Logo',
        'app_support_email' => 'Support Email',
        'app_contact_phone' => 'Phone Number',
        'app_default_currency' => 'Currency',
        'app_currency_symbol' => 'Currency Symbol',
        'app_timezone' => 'Time Zone',
        'app_date_format' => 'Date Format',
    ];

    protected const INVOICE_SETTINGS = [
        'invoice_company_name' => 'Company Name',
        'invoice_address' => 'Company Address',
        'invoice_phone' => 'Contact Number',
        'invoice_abn' => 'ABN/Registration Number',
        'invoice_bank_name' => 'Bank Name',
        'invoice_bank_bsb' => 'Bank BSB',
        'invoice_bank_account' => 'Bank Account Number',
        'invoice_terms' => 'Payment Terms',
        'invoice_tax_rate' => 'Tax Rate (Decimal i.e. 0.10 for 10%)',
        'invoice_tax_label' => 'Tax Label (e.g. GST, VAT, Tax)',
        'invoice_footer' => 'Invoice Footer Label',
        'invoice_logo' => 'Invoice Logo',
    ];

    /**
     * Display the general settings.
     */
    public function index()
    {
        $existingSettings = Setting::where('group', 'general')->get()->keyBy('key');

        $settings = collect(self::GENERAL_SETTINGS)->map(function ($displayName, $key) use ($existingSettings) {
            return [
                'key' => $key,
                'display_name' => $displayName,
                'value' => $existingSettings->get($key)?->value ?? '',
                'group' => 'general',
            ];
        })->values();

        return Inertia::render('settings/general', [
            'settingsList' => $settings,
        ]);
    }

    /**
     * Display the invoice settings.
     */
    public function invoiceIndex()
    {
        $existingSettings = Setting::where('group', 'invoice')->get()->keyBy('key');

        $settings = collect(self::INVOICE_SETTINGS)->map(function ($displayName, $key) use ($existingSettings) {
            return [
                'key' => $key,
                'display_name' => $displayName,
                'value' => $existingSettings->get($key)?->value ?? '',
                'group' => 'invoice',
            ];
        })->values();

        return Inertia::render('settings/invoice', [
            'settingsList' => $settings,
        ]);
    }

    /**
     * Update the settings.
     */
    public function update(Request $request, SettingsService $settingsService)
    {
        $validated = $request->validate([
            'settings' => 'nullable|array',
            'settings.*.key' => 'required_with:settings|string',
            'settings.*.value' => 'nullable',
            'invoice_logo' => 'nullable|file|mimes:jpeg,png,jpg,gif,svg,webp|max:5120',
            'app_logo' => 'nullable|file|mimes:jpeg,png,jpg,gif,svg,webp|max:5120',
        ]);

        if (! empty($validated['settings'])) {
            foreach ($validated['settings'] as $item) {
                $isGeneral = array_key_exists($item['key'], self::GENERAL_SETTINGS);
                $isInvoice = array_key_exists($item['key'], self::INVOICE_SETTINGS);

                if (! $isGeneral && ! $isInvoice) {
                    continue;
                }

                $group = $isInvoice ? 'invoice' : 'general';
                $displayName = $isInvoice ? self::INVOICE_SETTINGS[$item['key']] : self::GENERAL_SETTINGS[$item['key']];

                Setting::updateOrCreate(
                    ['key' => $item['key']],
                    [
                        'value' => $item['value'],
                        'group' => $group,
                        'display_name' => $displayName,
                        'type' => 'string',
                    ]
                );
            }
        }

        if ($request->hasFile('invoice_logo')) {
            $saved = $this->storeUploadedLogo($request->file('invoice_logo'), 'invoice_logo');

            if ($saved) {
                Setting::updateOrCreate(
                    ['key' => 'invoice_logo'],
                    [
                        'value' => '/uploads/logos/'.$saved,
                        'group' => 'invoice',
                        'display_name' => 'Invoice Logo',
                        'type' => 'string',
                    ]
                );
            } else {
                $settingsService->forgetGroup('invoice');
                $settingsService->forgetGroup('general');

                return back()->withErrors(['invoice_logo' => 'Failed to upload the invoice logo. Please try again.']);
            }
        }

        if ($request->hasFile('app_logo')) {
            $saved = $this->storeUploadedLogo($request->file('app_logo'), 'app_logo');

            if ($saved) {
                Setting::updateOrCreate(
                    ['key' => 'app_logo'],
                    [
                        'value' => '/uploads/logos/'.$saved,
                        'group' => 'general',
                        'display_name' => 'Business Logo',
                        'type' => 'string',
                    ]
                );
            } else {
                $settingsService->forgetGroup('invoice');
                $settingsService->forgetGroup('general');

                return back()->withErrors(['app_logo' => 'Failed to upload the brand logo. Please try again.']);
            }
        }

        $settingsService->forgetGroup('invoice');
        $settingsService->forgetGroup('general');

        return back()->with('success', 'Settings updated successfully.');
    }

    /**
     * Preview the invoice PDF.
     */
    public function previewInvoice(SettingsService $settingsService)
    {
        $invoice = Invoice::with(['booking.sender', 'booking.boxes.boxType', 'booking.boxes.recipient'])->latest()->first();

        if (! $invoice) {
            $booking = Booking::with(['sender', 'boxes.boxType', 'boxes.recipient'])->first();

            if (! $booking) {
                return back()->with('error', 'No bookings exist to generate a preview.');
            }

            $invoice = new Invoice([
                'invoice_number' => 'INV-PREVIEW-001',
                'amount' => $booking->boxes->sum('price_charged') ?: 100,
                'status' => InvoiceStatus::Unpaid,
            ]);
            $invoice->created_at = now();
            $invoice->setRelation('booking', $booking);
        }

        $invoiceSettings = $settingsService->getInvoiceSettings();
        $senderSnapshot = $invoice->resolveSenderSnapshot();
        $bookingSnapshot = $invoice->resolveBookingSnapshot();
        $lineItemsSnapshot = $invoice->resolveLineItemsSnapshot();
        $adminTeamSnapshot = $invoice->resolveAdminTeamSnapshot();

        $pdf = Pdf::loadView('admin.invoices.pdf', compact('invoice', 'invoiceSettings', 'senderSnapshot', 'bookingSnapshot', 'lineItemsSnapshot', 'adminTeamSnapshot'))
            ->setPaper('a4', 'portrait');

        return $pdf->stream('invoice-preview.pdf');
    }

    /**
     * Store an uploaded logo file with multi-strategy fallback for shared hosting.
     *
     * Tries three strategies in order:
     * 1. Laravel Storage facade (storeAs to 'public' disk)
     * 2. Direct file write to storage/app/public/logos/
     * 3. Direct move to public/uploads/logos/
     *
     * Returns the saved filename on success, or null on failure.
     */
    private function storeUploadedLogo(\Illuminate\Http\UploadedFile $file, string $prefix): ?string
    {
        $filename = $prefix.'_'.time().'.'.$file->getClientOriginalExtension();

        // Strategy 1: Laravel Storage facade
        try {
            $result = $file->storeAs('logos', $filename, 'public');

            if ($result !== false) {
                Log::info('Logo uploaded via Storage facade', ['file' => $filename, 'path' => $result]);

                return $filename;
            }

            Log::warning('Logo upload via Storage facade returned false', ['file' => $filename]);
        } catch (\Throwable $e) {
            Log::warning('Logo upload via Storage facade failed', [
                'file' => $filename,
                'error' => $e->getMessage(),
            ]);
        }

        // Strategy 2: Direct write to storage/app/public/logos/
        try {
            $targetDir = storage_path('app/public/logos');

            if (! is_dir($targetDir)) {
                @mkdir($targetDir, 0755, true);
            }

            if (is_dir($targetDir) && is_writable($targetDir)) {
                $contents = file_get_contents($file->getRealPath());

                if ($contents !== false && file_put_contents($targetDir.'/'.$filename, $contents) !== false) {
                    Log::info('Logo uploaded via direct storage write', ['file' => $filename]);

                    return $filename;
                }
            }

            Log::warning('Logo upload via direct storage write failed', [
                'file' => $filename,
                'dir_exists' => is_dir($targetDir),
                'dir_writable' => is_dir($targetDir) && is_writable($targetDir),
            ]);
        } catch (\Throwable $e) {
            Log::warning('Logo upload via direct storage write threw exception', [
                'file' => $filename,
                'error' => $e->getMessage(),
            ]);
        }

        // Strategy 3: Direct move to public/uploads/logos/
        try {
            $publicDir = public_path('uploads/logos');

            if (! is_dir($publicDir)) {
                @mkdir($publicDir, 0755, true);
            }

            if (is_dir($publicDir) && is_writable($publicDir)) {
                $file->move($publicDir, $filename);
                Log::info('Logo uploaded via public directory move', ['file' => $filename]);

                return $filename;
            }

            Log::warning('Logo upload via public directory move failed', [
                'file' => $filename,
                'dir_exists' => is_dir($publicDir),
                'dir_writable' => is_dir($publicDir) && is_writable($publicDir),
            ]);
        } catch (\Throwable $e) {
            Log::error('All logo upload strategies failed', [
                'file' => $filename,
                'error' => $e->getMessage(),
                'storage_path' => storage_path('app/public/logos'),
                'public_path' => public_path('uploads/logos'),
            ]);
        }

        return null;
    }
}
