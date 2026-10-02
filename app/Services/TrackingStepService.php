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
                return $this->normalizeSteps($setting->value);
            }

            return $this->normalizeSteps(self::getDefaults());
        });
    }

    /**
     * Find a specific tracking step by key.
     */
    public function getStep(string $key): ?array
    {
        return collect($this->getSteps())->firstWhere('key', $key);
    }

    /**
     * Get the order of a specific tracking step key.
     */
    public function getStepOrder(string $key): ?int
    {
        $step = $this->getStep($key);

        return $step ? (int) $step['order'] : null;
    }

    /**
     * Check whether a given step key exists in configured steps.
     */
    public function isValidStepKey(string $key): bool
    {
        return $this->getStep($key) !== null;
    }

    /**
     * Get all configured step keys.
     */
    public function getAllStepKeys(): array
    {
        return collect($this->getSteps())->pluck('key')->all();
    }

    /**
     * Find the first configured tracking step whose system_status
     * matches the given BoxStatus value.
     */
    public function getStepBySystemStatus(string $systemStatus): ?array
    {
        return collect($this->getSteps())
            ->first(fn ($step) => ($step['system_status'] ?? '') === $systemStatus);
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
                'step_type' => $this->resolveStepType($step),
                'description' => $step['description'] ?? '',
                'is_public' => isset($step['is_public']) ? (bool) $step['is_public'] : true,
                'notify_sms' => isset($step['notify_sms']) ? (bool) $step['notify_sms'] : false,
                'notify_email' => isset($step['notify_email']) ? (bool) $step['notify_email'] : false,
                'customer_message' => ! empty($step['customer_message']) ? (string) $step['customer_message'] : null,
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

    private function normalizeSteps(array $steps): array
    {
        return collect($steps)->values()->map(function (array $step, int $index): array {
            $step['order'] = $index + 1;
            $step['step_type'] = $this->resolveStepType($step);

            return $step;
        })->all();
    }

    private function resolveStepType(array $step): string
    {
        if (in_array($step['step_type'] ?? null, ['checkpoint', 'ongoing'], true)) {
            return $step['step_type'];
        }

        $key = strtolower((string) ($step['key'] ?? ''));
        $systemStatus = strtolower((string) ($step['system_status'] ?? ''));

        return in_array($key, ['in_transit_sea', 'under_customs_clearance', 'out_for_delivery', 'en_route_roro'], true)
            || in_array($systemStatus, ['in_transit_sea', 'out_for_delivery', 'en_route_roro'], true)
            ? 'ongoing'
            : 'checkpoint';
    }

    /**
     * The default 11-step tracking journey.
     */
    public static function getDefaults(): array
    {
        return [
            [
                'key' => 'pending',
                'label' => 'Pending Confirmation',
                'phase' => 'Origin',
                'order' => 1,
                'icon' => 'clock',
                'allowed_roles' => ['admin', 'super_admin'],
                'system_status' => 'pending',
                'step_type' => 'checkpoint',
                'description' => 'Booking registered and awaiting admin acceptance and pickup scheduling.',
                'is_public' => true,
                'notify_sms' => false,
                'notify_email' => false,
                'customer_message' => 'Your booking has been received and is queued for operational review and pickup scheduling.',
            ],
            [
                'key' => 'picked_up',
                'label' => 'Picked Up from Sender',
                'phase' => 'Origin',
                'order' => 2,
                'icon' => 'package-check',
                'allowed_roles' => ['picker', 'admin', 'super_admin'],
                'system_status' => 'collected',
                'step_type' => 'checkpoint',
                'description' => 'Box collected from sender and queued for warehouse sorting.',
                'is_public' => true,
                'notify_sms' => true,
                'notify_email' => true,
                'customer_message' => 'Your Balikbayan box has been picked up from sender and is heading to our warehouse.',
            ],
            [
                'key' => 'received_by_branch',
                'label' => 'Received at Warehouse',
                'phase' => 'Origin',
                'order' => 3,
                'icon' => 'warehouse',
                'allowed_roles' => ['warehouse', 'admin', 'super_admin'],
                'system_status' => 'received_by_branch',
                'description' => 'Box arrived at hub warehouse for inspection, weighing, and manifest packing.',
                'is_public' => true,
                'notify_sms' => false,
                'notify_email' => false,
                'customer_message' => 'Your box has arrived safely at our sorting warehouse for weighing and processing.',
            ],
            [
                'key' => 'loading_container',
                'label' => 'Loaded to Container',
                'phase' => 'Origin',
                'order' => 4,
                'icon' => 'container',
                'allowed_roles' => ['warehouse', 'admin', 'super_admin'],
                'system_status' => 'loaded_to_container',
                'description' => 'Box safely loaded into sea freight container and prepped for port departure.',
                'is_public' => true,
                'notify_sms' => false,
                'notify_email' => false,
                'customer_message' => 'Your box is secured and loaded into the shipping container.',
            ],
            [
                'key' => 'in_transit_sea',
                'label' => 'Shipping to Philippines',
                'phase' => 'International Transit',
                'order' => 5,
                'icon' => 'ship',
                'allowed_roles' => ['admin', 'super_admin'],
                'system_status' => 'in_transit',
                'description' => 'Vessel en route across ocean transit bound for Philippine destination port.',
                'is_public' => true,
                'notify_sms' => true,
                'notify_email' => true,
                'customer_message' => 'Vessel has sailed! Your box is sailing across international waters to the Philippines.',
            ],
            [
                'key' => 'arrived_manila_port',
                'label' => 'Arrived in the Philippines',
                'phase' => 'International Transit',
                'order' => 6,
                'icon' => 'map-pin',
                'allowed_roles' => ['admin', 'super_admin'],
                'system_status' => 'arrived',
                'description' => 'Vessel safely docked at Philippine port for cargo unloading and sorting.',
                'is_public' => true,
                'notify_sms' => true,
                'notify_email' => true,
                'customer_message' => 'The vessel has docked at Philippine port. Unloading and customs clearance underway.',
            ],
            [
                'key' => 'under_customs_clearance',
                'label' => 'Under BOC Clearance',
                'phase' => 'International Transit',
                'order' => 7,
                'icon' => 'shield-check',
                'allowed_roles' => ['admin', 'super_admin'],
                'system_status' => 'arrived',
                'description' => 'Import documentation submitted to Bureau of Customs (BOC) for standard clearance.',
                'is_public' => true,
                'notify_sms' => false,
                'notify_email' => false,
                'customer_message' => 'Cargo documents are being processed by the Bureau of Customs (BOC).',
            ],
            [
                'key' => 'released_by_boc',
                'label' => 'Released by BOC',
                'phase' => 'International Transit',
                'order' => 8,
                'icon' => 'shield-check',
                'allowed_roles' => ['admin', 'super_admin'],
                'system_status' => 'arrived',
                'description' => 'Customs inspection cleared; box released to local delivery hub.',
                'is_public' => true,
                'notify_sms' => false,
                'notify_email' => false,
                'customer_message' => 'Customs clearance completed! Cargo has been released to our local logistics team.',
            ],
            [
                'key' => 'received_manila_warehouse',
                'label' => 'Received at Manila Warehouse',
                'phase' => 'Destination',
                'order' => 9,
                'icon' => 'warehouse',
                'allowed_roles' => ['warehouse', 'admin', 'super_admin'],
                'system_status' => 'arrived',
                'description' => 'Box received at Manila regional warehouse for local hub distribution.',
                'is_public' => true,
                'notify_sms' => false,
                'notify_email' => false,
                'customer_message' => 'Box received at Manila regional distribution center for route dispatch.',
            ],
            [
                'key' => 'sorting',
                'label' => 'At Sorting Facility',
                'phase' => 'Destination',
                'order' => 10,
                'icon' => 'arrow-down-up',
                'allowed_roles' => ['warehouse', 'admin', 'super_admin'],
                'system_status' => 'in_transit',
                'description' => 'Box processed at local sorting hub for final route assignment.',
                'is_public' => true,
                'notify_sms' => false,
                'notify_email' => false,
                'customer_message' => 'Box sorted and assigned to provincial delivery route.',
            ],
            [
                'key' => 'dispatched_to_local_hub',
                'label' => 'Dispatched to Local Hub',
                'phase' => 'Destination',
                'order' => 11,
                'icon' => 'truck',
                'allowed_roles' => ['warehouse', 'admin', 'super_admin'],
                'system_status' => 'in_transit',
                'description' => 'In transit to provincial destination hub for last-mile delivery.',
                'is_public' => true,
                'notify_sms' => false,
                'notify_email' => false,
                'customer_message' => 'In transit to your local distribution hub for last-mile scheduling.',
            ],
            [
                'key' => 'out_for_delivery',
                'label' => 'Out for Delivery',
                'phase' => 'Destination',
                'order' => 12,
                'icon' => 'bike',
                'allowed_roles' => ['courier', 'admin', 'super_admin'],
                'system_status' => 'out_for_delivery',
                'description' => 'Box assigned to local courier team for doorstep delivery to recipient.',
                'is_public' => true,
                'notify_sms' => true,
                'notify_email' => true,
                'customer_message' => 'Your box is out for delivery today! Our courier will contact the recipient.',
            ],
            [
                'key' => 'delivered',
                'label' => 'Delivered',
                'phase' => 'Destination',
                'order' => 13,
                'icon' => 'home',
                'allowed_roles' => ['courier', 'admin', 'super_admin'],
                'system_status' => 'delivered',
                'description' => 'Box successfully delivered to recipient. Thank you for choosing Eagle Express Cargo!',
                'is_public' => true,
                'notify_sms' => true,
                'notify_email' => true,
                'customer_message' => 'Package delivered successfully to recipient with signature and proof of delivery. Salamat sa tiwala!',
            ],
        ];
    }
}
