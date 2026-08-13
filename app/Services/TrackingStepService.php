<?php

namespace App\Services;

use App\Models\Setting;
use Illuminate\Support\Facades\Cache;

class TrackingStepService
{
    private const SETTING_KEY = 'tracking_steps';

    private const CACHE_KEY = 'setting.tracking_steps';

    private const CACHE_TTL = 3600; // 1 hour

    /**
     * Get the tracking steps from the database, falling back to defaults.
     */
    public function getSteps(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_TTL, function () {
            $setting = Setting::where('key', self::SETTING_KEY)->first();

            if ($setting && is_array($setting->value) && count($setting->value) > 0) {
                return $setting->value;
            }

            return self::getDefaults();
        });
    }

    /**
     * Get the order of a specific tracking step key.
     */
    public function getStepOrder(string $key): ?int
    {
        $step = collect($this->getSteps())->firstWhere('key', $key);

        return $step ? (int) $step['order'] : null;
    }

    /**
     * Save updated tracking steps to the database.
     */
    public function updateSteps(array $steps): void
    {
        $validated = collect($steps)->map(function ($step, $index) {
            return [
                'key' => $step['key'] ?? 'step_'.($index + 1),
                'label' => $step['label'] ?? 'Step '.($index + 1),
                'phase' => $step['phase'] ?? 'Origin',
                'order' => $index + 1,
                'icon' => $step['icon'] ?? 'circle',
                'allowed_roles' => $step['allowed_roles'] ?? [],
                'system_status' => $step['system_status'] ?? 'pending',
                'description' => $step['description'] ?? '',
            ];
        })->values()->toArray();

        Setting::updateOrCreate(
            ['key' => self::SETTING_KEY],
            [
                'value' => json_encode($validated),
                'type' => 'json',
                'group' => 'tracking',
                'display_name' => 'Tracking Journey Steps',
            ]
        );

        Cache::forget(self::CACHE_KEY);
    }

    /**
     * The default 11-step tracking journey.
     */
    public static function getDefaults(): array
    {
        return [
            [
                'key' => 'picked_up',
                'label' => 'Picked Up from Sender',
                'phase' => 'Origin',
                'order' => 1,
                'icon' => 'package-check',
                'allowed_roles' => ['picker', 'admin', 'super_admin'],
                'system_status' => 'collected',
                'description' => 'Box collected from sender and queued for warehouse sorting.',
            ],
            [
                'key' => 'received_by_branch',
                'label' => 'Received at Warehouse',
                'phase' => 'Origin',
                'order' => 2,
                'icon' => 'warehouse',
                'allowed_roles' => ['warehouse', 'admin', 'super_admin'],
                'system_status' => 'received_by_branch',
                'description' => 'Box arrived at hub warehouse for inspection, weighing, and manifest packing.',
            ],
            [
                'key' => 'loading_container',
                'label' => 'Loaded to Container',
                'phase' => 'Origin',
                'order' => 3,
                'icon' => 'container',
                'allowed_roles' => ['warehouse', 'admin', 'super_admin'],
                'system_status' => 'loaded_to_container',
                'description' => 'Box safely loaded into sea freight container and prepped for port departure.',
            ],
            [
                'key' => 'in_transit_sea',
                'label' => 'Shipping to Philippines',
                'phase' => 'International Transit',
                'order' => 4,
                'icon' => 'ship',
                'allowed_roles' => ['admin', 'super_admin'],
                'system_status' => 'in_transit',
                'description' => 'Vessel en route across ocean transit bound for Philippine destination port.',
            ],
            [
                'key' => 'arrived_manila_port',
                'label' => 'Arrived in the Philippines',
                'phase' => 'International Transit',
                'order' => 5,
                'icon' => 'map-pin',
                'allowed_roles' => ['admin', 'super_admin'],
                'system_status' => 'arrived',
                'description' => 'Vessel safely docked at Philippine port for cargo unloading and sorting.',
            ],
            [
                'key' => 'under_customs_clearance',
                'label' => 'Under BOC Clearance',
                'phase' => 'International Transit',
                'order' => 6,
                'icon' => 'shield-check',
                'allowed_roles' => ['admin', 'super_admin'],
                'system_status' => 'arrived',
                'description' => 'Import documentation submitted to Bureau of Customs (BOC) for standard clearance.',
            ],
            [
                'key' => 'released_by_boc',
                'label' => 'Released by BOC',
                'phase' => 'International Transit',
                'order' => 7,
                'icon' => 'shield-check',
                'allowed_roles' => ['admin', 'super_admin'],
                'system_status' => 'arrived',
                'description' => 'Customs inspection cleared; box released to local delivery hub.',
            ],
            [
                'key' => 'received_manila_warehouse',
                'label' => 'Received at Manila Warehouse',
                'phase' => 'Destination',
                'order' => 8,
                'icon' => 'warehouse',
                'allowed_roles' => ['warehouse', 'admin', 'super_admin'],
                'system_status' => 'arrived',
                'description' => 'Box received at Manila regional warehouse for local hub distribution.',
            ],
            [
                'key' => 'sorting',
                'label' => 'At Sorting Facility',
                'phase' => 'Destination',
                'order' => 9,
                'icon' => 'arrow-down-up',
                'allowed_roles' => ['warehouse', 'admin', 'super_admin'],
                'system_status' => 'in_transit',
                'description' => 'Box processed at local sorting hub for final route assignment.',
            ],
            [
                'key' => 'dispatched_to_local_hub',
                'label' => 'Dispatched to Local Hub',
                'phase' => 'Destination',
                'order' => 10,
                'icon' => 'truck',
                'allowed_roles' => ['warehouse', 'admin', 'super_admin'],
                'system_status' => 'in_transit',
                'description' => 'In transit to provincial destination hub for last-mile delivery.',
            ],
            [
                'key' => 'out_for_delivery',
                'label' => 'Out for Delivery',
                'phase' => 'Destination',
                'order' => 11,
                'icon' => 'bike',
                'allowed_roles' => ['courier', 'admin', 'super_admin'],
                'system_status' => 'out_for_delivery',
                'description' => 'Box assigned to local courier team for doorstep delivery to recipient.',
            ],
            [
                'key' => 'delivered',
                'label' => 'Delivered',
                'phase' => 'Destination',
                'order' => 12,
                'icon' => 'home',
                'allowed_roles' => ['courier', 'admin', 'super_admin'],
                'system_status' => 'delivered',
                'description' => 'Box successfully delivered to recipient. Thank you for choosing Love Balikbayan!',
            ],
        ];
    }
}
