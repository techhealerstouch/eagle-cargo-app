<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\SettingsService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DeclarationSettingController extends Controller
{
    /**
     * The fixed list of declaration settings that should always be available.
     */
    protected const DECLARATION_SETTINGS = [
        'declaration_header_text' => 'Header Text',
        'declaration_subtitle' => 'Subtitle',
        'declaration_badge_1' => 'Badge 1',
        'declaration_badge_2' => 'Badge 2 (Tracking ID)',
        'declaration_form_info' => 'Form Info',
        'declaration_instructions' => 'Instructions',
        'declaration_footer_text' => 'Footer Text',
        'declaration_require_signature' => 'Require Signature',
        'declaration_prohibited_title' => 'Prohibited Notice Title',
        'declaration_prohibited_notice' => 'Prohibited Notice',
        'declaration_brand_name' => 'Brand Name',
        'declaration_origin_location' => 'Origin Location',
    ];

    /**
     * Display the declaration settings.
     */
    public function index()
    {
        $existingSettings = Setting::where('group', 'declaration')->get()->keyBy('key');

        $settings = collect(self::DECLARATION_SETTINGS)->map(function ($displayName, $key) use ($existingSettings) {
            $value = $existingSettings->get($key)?->value ?? '';

            return [
                'key' => $key,
                'display_name' => $displayName,
                'value' => $value,
                'group' => 'declaration',
            ];
        })->values();

        return Inertia::render('settings/declaration', [
            'settingsList' => $settings,
            'logo' => Setting::where('key', 'invoice_logo')->first()?->value,
        ]);
    }

    /**
     * Update the declaration settings.
     */
    public function update(Request $request, SettingsService $settingsService)
    {
        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*.key' => 'required|string',
            'settings.*.value' => 'nullable',
        ]);

        foreach ($validated['settings'] as $item) {
            if (! array_key_exists($item['key'], self::DECLARATION_SETTINGS)) {
                continue;
            }

            $value = $item['value'];
            $type = 'string';

            if ($item['key'] === 'declaration_require_signature') {
                $type = 'bool';
                $value = $value ? '1' : '0';
            }

            Setting::updateOrCreate(
                ['key' => $item['key']],
                [
                    'value' => $value,
                    'group' => 'declaration',
                    'display_name' => self::DECLARATION_SETTINGS[$item['key']] ?? str_replace('_', ' ', ucfirst($item['key'])),
                    'type' => $type,
                ]
            );

            $settingsService->forget($item['key'], 'declaration');
        }

        return redirect()->back()->with('success', 'Declaration settings updated successfully.');
    }
}
