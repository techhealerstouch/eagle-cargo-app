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
                return array_map(function ($step, $index) {
                    $key = $step['key'] ?? 'step_' . ($index + 1);
                    $systemStatus = $step['system_status'] ?? 'pending';

                    return [
                        'key' => $key,
                        'label' => $step['label'] ?? 'Step ' . ($index + 1),
                        'phase' => $step['phase'] ?? 'Origin',
                        'order' => isset($step['order']) ? (int) $step['order'] : ($index + 1),
                        'icon' => $step['icon'] ?? 'circle',
                        'allowed_roles' => $step['allowed_roles'] ?? [],
                        'system_status' => $systemStatus,
                        'step_type' => in_array($step['step_type'] ?? null, ['checkpoint', 'ongoing'], true)
                            ? $step['step_type']
                            : self::deriveStepType($key, $systemStatus),
                        'description' => $step['description'] ?? '',
                    ];
                }, $setting->value, array_keys($setting->value));
            }

            return self::getDefaults();
        });
    }

    /**
     * Get a specific tracking step by key.
     */
    public function getStep(string $key): ?array
    {
        return collect($this->getSteps())->firstWhere('key', $key);
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
     * Get the order of a specific tracking step key.
     */
    public function getStepOrder(string $key): ?int
    {
        $step = $this->getStep($key);

        return $step ? (int) $step['order'] : null;
    }

    /**
     * Derive semantic step type for legacy configurations or missing types.
     */
    public static function deriveStepType(string $key, ?string $systemStatus = null): string
    {
        $keyLower = strtolower($key);
        $statusLower = strtolower($systemStatus ?? '');

        $ongoingKeys = [
            'in_transit_sea',
            'under_customs_clearance',
            'sorting',
            'dispatched_to_local_hub',
            'out_for_delivery',
            'en_route_roro',
        ];

        if (in_array($keyLower, $ongoingKeys, true)) {
            return 'ongoing';
        }

        if ($statusLower === 'out_for_delivery') {
            return 'ongoing';
        }

        if (
            str_contains($keyLower, 'transit') ||
            str_contains($keyLower, 'clearance') ||
            str_contains($keyLower, 'sorting') ||
            str_contains($keyLower, 'dispatch') ||
            str_contains($keyLower, 'shipping') ||
            str_contains($keyLower, 'en_route')
        ) {
            return 'ongoing';
        }

        return 'checkpoint';
    }

    /**
     * Validate the structural and semantic constraints of tracking steps.
     */
    public function validateSteps(array $steps): void
    {
        if (count($steps) < 2) {
            throw new \InvalidArgumentException('At least 2 tracking journey steps are required.');
        }

        $keys = [];
        $orders = [];
        $hasInitialCheckpoint = false;
        $hasFinalDelivered = false;
        $count = count($steps);

        foreach ($steps as $index => $step) {
            $expectedOrder = $index + 1;
            $order = isset($step['order']) ? (int) $step['order'] : $expectedOrder;
            $orders[] = $order;

            $key = $step['key'] ?? '';
            if (empty($key)) {
                throw new \InvalidArgumentException("Tracking step at position {$expectedOrder} must have a unique key.");
            }

            if (in_array($key, $keys, true)) {
                throw new \InvalidArgumentException("Duplicate tracking step key [{$key}] found.");
            }
            $keys[] = $key;

            $systemStatus = $step['system_status'] ?? '';
            $stepType = in_array($step['step_type'] ?? null, ['checkpoint', 'ongoing'], true)
                ? $step['step_type']
                : self::deriveStepType($key, $systemStatus);

            if ($index === 0) {
                if ($stepType === 'checkpoint' || in_array($systemStatus, ['collected', 'pending', 'received_by_branch'], true)) {
                    $hasInitialCheckpoint = true;
                }
            }

            if ($index === $count - 1) {
                if ($systemStatus === 'delivered' || $key === 'delivered') {
                    $hasFinalDelivered = true;
                }
            }
        }

        sort($orders);
        $expectedContiguous = range(1, $count);
        if ($orders !== $expectedContiguous) {
            throw new \InvalidArgumentException('Tracking step orders must be contiguous starting from 1.');
        }

        if (! $hasInitialCheckpoint) {
            throw new \InvalidArgumentException('The first tracking step must be an initial pickup/checkpoint step.');
        }

        if (! $hasFinalDelivered) {
            throw new \InvalidArgumentException('The final tracking step must represent delivery (Delivered).');
        }
    }

    /**
     * Save updated tracking steps to the database.
     */
    public function updateSteps(array $steps): void
    {
        $validated = collect($steps)->map(function ($step, $index) {
            $key = $step['key'] ?? 'step_' . ($index + 1);
            $systemStatus = $step['system_status'] ?? 'pending';
            $stepType = in_array($step['step_type'] ?? null, ['checkpoint', 'ongoing'], true)
                ? $step['step_type']
                : self::deriveStepType($key, $systemStatus);

            return [
                'key' => $key,
                'label' => $step['label'] ?? 'Step ' . ($index + 1),
                'phase' => $step['phase'] ?? 'Origin',
                'order' => $index + 1,
                'icon' => $step['icon'] ?? 'circle',
                'allowed_roles' => $step['allowed_roles'] ?? [],
                'system_status' => $systemStatus,
                'step_type' => $stepType,
                'description' => $step['description'] ?? '',
            ];
        })->values()->toArray();

        $this->validateSteps($validated);

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
     * The default 12-step tracking journey.
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
                'step_type' => 'checkpoint',
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
                'step_type' => 'checkpoint',
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
                'step_type' => 'checkpoint',
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
                'step_type' => 'ongoing',
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
                'step_type' => 'checkpoint',
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
                'step_type' => 'ongoing',
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
                'step_type' => 'checkpoint',
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
                'step_type' => 'checkpoint',
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
                'step_type' => 'ongoing',
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
                'step_type' => 'ongoing',
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
                'step_type' => 'ongoing',
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
                'step_type' => 'checkpoint',
                'description' => 'Box successfully delivered to recipient. Thank you for choosing Love Balikbayan!',
            ],
        ];
    }
}
