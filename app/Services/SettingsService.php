<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Service for managing application settings and configuration.
 *
 * This service provides cached access to application settings stored in the database.
 * Settings are cached indefinitely and manually invalidated when updated
 * via the `forget()` or `forgetGroup()` methods.
 *
 * Cache Strategy:
 * - All caches use `rememberForever` since settings change only
 *   when an admin updates them in the settings panel
 * - Manual cache invalidation via `forget()` or `forgetGroup()`
 *   should be called after any setting update
 *
 * @see Setting
 */
class SettingsService
{
    private const SETTING_CACHE_PREFIX = 'setting.';

    private const GROUP_CACHE_PREFIX = 'setting.group.';

    /**
     * Get a setting value by key.
     *
     * @param  mixed  $default
     * @return mixed
     */
    public function get(string $key, $default = null)
    {
        $setting = Cache::rememberForever(self::SETTING_CACHE_PREFIX.$key, function () use ($key) {
            return Setting::where('key', $key)->first();
        });

        // Ensure we return default if setting exists but value is null or empty
        $value = $setting ? $setting->value : null;

        return ($value === null || $value === '') ? $default : $value;
    }

    /**
     * Get all settings in a group.
     *
     * @return Collection
     */
    public function getGroup(string $group)
    {
        return Cache::rememberForever(self::GROUP_CACHE_PREFIX.$group, function () use ($group) {
            return Setting::where('group', $group)->get()->pluck('value', 'key');
        });
    }

    /**
     * Get normalized invoice settings with safe defaults.
     */
    public function getInvoiceSettings(): array
    {
        $settings = $this->getGroup('invoice');

        return [
            'logo' => $settings->get('invoice_logo') ?: null,
            'companyName' => $settings->get('invoice_company_name', 'Love Balikbayan Box Cargo'),
            'address' => $settings->get('invoice_address', "6 Ivan St\nArundel Queensland 4214\nAustralia"),
            'phone' => $settings->get('invoice_phone', '+61 406 828 471'),
            'abn' => $settings->get('invoice_abn', '57237419483'),
            'bankName' => $settings->get('invoice_bank_name', 'Commonwealth Bank'),
            'bankBsb' => $settings->get('invoice_bank_bsb', '064-449'),
            'bankAccount' => $settings->get('invoice_bank_account', '1097 5991'),
            'taxRate' => (float) $settings->get('invoice_tax_rate', '0.10'),
            'taxLabel' => $settings->get('invoice_tax_label', 'GST'),
            'terms' => $settings->get('invoice_terms', 'Thank you for your business. Orient Freight\'s Terms and Conditions can be found at https://love.balikbayan.box.com.au/terms-and-conditions/'),
            'footer' => $settings->get('invoice_footer', 'Love Balikbayan Box Cargo'),
            'currencySymbol' => $this->get('app_currency_symbol', '$'),
        ];
    }

    /**
     * Get normalized general settings with safe defaults.
     */
    public function getGeneralSettings(): array
    {
        $settings = $this->getGroup('general');

        return [
            'appName' => $settings->get('app_name', 'Love Balikbayan Box'),
            'appSubtitle' => $settings->get('app_subtitle', 'SEA CARGO'),
            'appLogo' => $this->assetUrl($settings->get('app_logo') ?: '/images/love-logo.png'),
            'supportEmail' => $settings->get('app_support_email', 'support@love-balikbayan.com.au'),
            'contactPhone' => $settings->get('app_contact_phone', '+61 406 828 471'),
            'currency' => $settings->get('app_default_currency', 'AUD'),
            'currencySymbol' => $this->get('app_currency_symbol', '$'),
            'timezone' => $settings->get('app_timezone', 'Australia/Sydney'),
            'dateFormat' => $settings->get('app_date_format', 'd/m/Y'),
        ];
    }

    /**
     * Get normalized logistics settings with safe defaults.
     * If a pickup zone ID is provided, zone-specific overrides take precedence.
     */
    public function getLogisticsSettings(?int $pickupZoneId = null): array
    {
        $settings = $this->getGroup('logistics');

        $result = [
            'leadTimeDays' => (int) $settings->get('logistics_lead_time_days', 2),
            'pickupWindows' => $settings->get('logistics_pickup_windows', []),
            'blackoutDates' => $settings->get('logistics_blackout_dates', []),
        ];

        if ($pickupZoneId) {
            $zone = \App\Models\PickupZone::find($pickupZoneId);
            if ($zone) {
                if (! empty($zone->pickup_windows)) {
                    $result['pickupWindows'] = $zone->pickup_windows;
                }
                if (! empty($zone->blackout_dates)) {
                    $result['blackoutDates'] = $zone->blackout_dates;
                }
                if ($zone->lead_time_days !== null) {
                    $result['leadTimeDays'] = $zone->lead_time_days;
                }
            }
        }

        return $result;
    }

    /**
     * Get normalized declaration settings with safe defaults.
     */
    public function getDeclarationSettings(): array
    {
        $settings = $this->getGroup('declaration');
        $invoiceSettings = $this->getGroup('invoice');
        $generalSettings = $this->getGroup('general');

        return [
            'logo' => $invoiceSettings->get('invoice_logo') ?: null,
            'appName' => $generalSettings->get('app_name', 'Love Balikbayan Box'),
            'appSubtitle' => $generalSettings->get('app_subtitle', 'SEA CARGO'),
            'headerText' => $settings->get('declaration_header_text', "Shipper's Export Declaration"),
            'subtitle' => $settings->get('declaration_subtitle', "Shipper's Packing List - Balikbayan Box"),
            'badge1' => $settings->get('declaration_badge_1', 'Official Document'),
            'badge2' => $settings->get('declaration_badge_2', 'LVB-LOG-VERIFIED'),
            'formInfo' => $settings->get('declaration_form_info', 'Form 291-B Revised 2026'),
            'prohibitedTitle' => $settings->get('declaration_prohibited_title', 'Prohibited Items Notice:'),
            'prohibitedNotice' => $settings->get('declaration_prohibited_notice', 'Firearms, ammunition, illegal drugs, explosives, flammable materials, live animals, counterfeit goods, and other hazardous materials are strictly prohibited. This document is a legally binding declaration under the Customs Modernization and Tariff Act (CMTA) of the Philippines.'),
            'brandName' => $settings->get('declaration_brand_name', 'Love Balikbayan Logistics System'),
            'originLocation' => $settings->get('declaration_origin_location', 'Victoria, Australia'),
            'instructions' => $settings->get('declaration_instructions', 'Please declare all items in your Balikbayan box.'),
            'footerText' => $settings->get('declaration_footer_text', 'I declare that the information provided is true and accurate.'),
            'requireSignature' => (bool) $settings->get('declaration_require_signature', true),
        ];
    }

    /**
     * Set a setting value by key.
     *
     * @param  mixed  $value
     * @return Setting
     */
    public function set(string $key, $value)
    {
        $setting = Setting::where('key', $key)->first();
        $group = $setting?->group;

        if ($setting) {
            $setting->update(['value' => $this->formatValue($value, $setting->type)]);
        }

        $this->forget($key, $group);

        return $setting;
    }

    /**
     * Clear cached setting values after admin updates or seed refreshes.
     */
    public function forget(string $key, ?string $group = null): void
    {
        Cache::forget(self::SETTING_CACHE_PREFIX.$key);

        if ($group !== null && $group !== '') {
            Cache::forget(self::GROUP_CACHE_PREFIX.$group);
        }
    }

    /**
     * Clear a cached settings group when the changed keys are not known.
     */
    public function forgetGroup(string $group): void
    {
        Cache::forget(self::GROUP_CACHE_PREFIX.$group);
    }

    /**
     * Format the value for storage based on type.
     */
    private function formatValue($value, string $type)
    {
        return match ($type) {
            'json' => is_array($value) ? json_encode($value) : $value,
            'bool' => $value ? '1' : '0',
            default => (string) $value,
        };
    }

    /**
     * Normalize stored public asset paths for browser use.
     */
    private function assetUrl(?string $path): ?string
    {
        if ($path === null || trim($path) === '') {
            return null;
        }

        $path = trim($path);

        if (preg_match('/^(https?:|data:|blob:)/i', $path)) {
            return $path;
        }

        $path = str_replace('\\', '/', $path);
        $path = preg_replace('#^/?public/#', '', $path);

        if (! str_starts_with($path, '/')) {
            $path = str_starts_with($path, 'storage/') ? '/'.$path : '/'.$path;
        }

        return asset(implode('/', array_map('rawurlencode', explode('/', ltrim($path, '/')))));
    }
}
