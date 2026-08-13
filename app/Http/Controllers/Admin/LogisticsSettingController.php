<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PickupZone;
use App\Models\Setting;
use App\Services\SettingsService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class LogisticsSettingController extends Controller
{
    /**
     * The fixed list of logistics settings that should always be available.
     */
    protected const LOGISTICS_SETTINGS = [
        'logistics_lead_time_days' => 'Minimum Lead Time (Days)',
        'logistics_pickup_windows' => 'Pickup Windows',
        'logistics_blackout_dates' => 'Blackout Dates',
    ];

    /**
     * Display the logistics settings.
     */
    public function index()
    {
        $existingSettings = Setting::where('group', 'logistics')->get()->keyBy('key');

        $settings = collect(self::LOGISTICS_SETTINGS)->map(function ($displayName, $key) use ($existingSettings) {
            $value = $existingSettings->get($key)?->value ?? '';

            return [
                'key' => $key,
                'display_name' => $displayName,
                'value' => $value,
                'group' => 'logistics',
            ];
        })->values();

        $pickupZones = PickupZone::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'pickup_windows', 'blackout_dates', 'lead_time_days']);

        return Inertia::render('settings/logistics', [
            'settingsList' => $settings,
            'pickupZones' => $pickupZones,
        ]);
    }

    /**
     * Update the logistics settings.
     */
    public function update(Request $request, SettingsService $settingsService)
    {
        $validated = $request->validate([
            'settings' => 'required|array',
            'settings.*.key' => 'required|string',
            'settings.*.value' => 'nullable',
            'zone_schedules' => 'nullable|array',
            'zone_schedules.*.id' => 'required|exists:pickup_zones,id',
            'zone_schedules.*.pickup_windows' => 'nullable|array',
            'zone_schedules.*.blackout_dates' => 'nullable|array',
            'zone_schedules.*.lead_time_days' => 'nullable|integer|min:0',
        ]);

        // Save global settings
        foreach ($validated['settings'] as $item) {
            if (! array_key_exists($item['key'], self::LOGISTICS_SETTINGS)) {
                continue;
            }

            $value = $item['value'];
            $type = 'string';

            if (is_array($value)) {
                $type = 'json';
                $value = json_encode($value);
            }

            Setting::updateOrCreate(
                ['key' => $item['key']],
                [
                    'value' => $value,
                    'group' => 'logistics',
                    'display_name' => self::LOGISTICS_SETTINGS[$item['key']],
                    'type' => $type,
                ]
            );

            $settingsService->forget($item['key'], 'logistics');
        }

        // Save per-zone schedules
        if (! empty($validated['zone_schedules'])) {
            foreach ($validated['zone_schedules'] as $zoneData) {
                PickupZone::where('id', $zoneData['id'])->update([
                    'pickup_windows' => $zoneData['pickup_windows'],
                    'blackout_dates' => $zoneData['blackout_dates'],
                    'lead_time_days' => $zoneData['lead_time_days'],
                ]);
            }
        }

        return redirect()->back()->with('success', 'Logistics settings updated successfully.');
    }
}
