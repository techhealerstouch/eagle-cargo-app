<?php

namespace App\Services;

use App\Models\Area;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\PickupZone;
use App\Models\Province;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Service for managing reference data used across the application.
 *
 * This service provides cached access to frequently-read reference data
 * such as active areas, box types, pickup zones, and the pricing matrix.
 *
 * Pricing Model:
 * - Price = base rate (pickup_zone × area × box_type) + door-to-door fee + empty box fee
 * - Every price entry requires a pickup_zone_id, area_id, and box_type_id
 *
 * Cache Strategy:
 * - All caches use `rememberForever` since reference data changes only
 *   when an admin updates it in the settings panel
 * - Manual cache invalidation via `forgetBookingReferenceData()`
 *   should be called after any reference data update
 *
 * Auto-Seeding Strategy:
 * - If the database has no areas, box types, or prices, this service
 *   will auto-seed sensible defaults so the booking form is immediately
 *   functional without requiring database seeders to be run first.
 *
 * @see Area
 * @see BoxType
 * @see BoxPrice
 * @see PickupZone
 */
class ReferenceDataService
{
    private const ACTIVE_AREAS_KEY = 'reference.areas.active';

    private const ACTIVE_BOX_TYPES_KEY = 'reference.box_types.active';

    private const BOX_PRICES_KEY = 'reference.box_prices.all';

    private const ACTIVE_PROVINCES_KEY = 'reference.provinces.active';

    private const ACTIVE_PICKUP_ZONES_KEY = 'reference.pickup_zones.active.v2';

    /**
     * Default destination areas that will be auto-created if none exist.
     */
    private const DEFAULT_AREAS = [
        'Metro Manila',
        'Outer NCR',
        'Luzon',
        'Visayas',
        'Mindanao',
        'Inter-Island',
    ];

    /**
     * Default box types that will be auto-created if none exist.
     */
    private const DEFAULT_BOX_TYPES = [
        ['name' => 'Jumbo', 'dimensions' => '24x24x24'],
        ['name' => 'Large', 'dimensions' => '20x20x20'],
        ['name' => 'Medium', 'dimensions' => '18x18x18'],
    ];

    /**
     * Default price matrix: pickup_zone_code => [area_name => price].
     * All box types get the same price (flat rate per zone × area).
     * Rates from the Love Balikbayan rate card.
     */
    private const DEFAULT_PRICES = [
        'metro_melbourne' => [
            'Metro Manila' => 95.00,
            'Outer NCR' => 105.00,
            'Luzon' => 105.00,
            'Visayas' => 130.00,
            'Mindanao' => 140.00,
            'Inter-Island' => 150.00,
        ],
        'ballarat_geelong_kyneton' => [
            'Metro Manila' => 110.00,
            'Outer NCR' => 120.00,
            'Luzon' => 120.00,
            'Visayas' => 140.00,
            'Mindanao' => 150.00,
            'Inter-Island' => 160.00,
        ],
        'shepparton_gippsland_bendigo' => [
            'Metro Manila' => 140.00,
            'Outer NCR' => 150.00,
            'Luzon' => 150.00,
            'Visayas' => 175.00,
            'Mindanao' => 185.00,
            'Inter-Island' => 200.00,
        ],
        'western_victoria' => [
            'Metro Manila' => 150.00,
            'Outer NCR' => 150.00,
            'Luzon' => 160.00,
            'Visayas' => 180.00,
            'Mindanao' => 190.00,
            'Inter-Island' => 220.00,
        ],
    ];

    /**
     * Active destination areas are shared by booking forms and pricing screens.
     * Auto-seeds defaults if the database has no active areas.
     */
    public function activeAreas(): Collection
    {
        $areas = Cache::rememberForever(self::ACTIVE_AREAS_KEY, function () {
            return Area::where('is_active', true)
                ->orderBy('name')
                ->get();
        });

        if ($areas->isEmpty() && !Area::exists()) {
            $this->seedDefaultAreas();
            Cache::forget(self::ACTIVE_AREAS_KEY);

            return Cache::rememberForever(self::ACTIVE_AREAS_KEY, function () {
                return Area::where('is_active', true)
                    ->orderBy('name')
                    ->get();
            });
        }

        return $areas;
    }

    /**
     * Active provinces for booking dropdowns.
     */
    public function activeProvinces(): Collection
    {
        return Cache::rememberForever(self::ACTIVE_PROVINCES_KEY, function () {
            return Province::where('is_active', true)
                ->whereNotNull('area_id')
                ->orderBy('name')
                ->get();
        });
    }

    public function hasActiveProvinces(): bool
    {
        return Province::where('is_active', true)->whereNotNull('area_id')->exists();
    }

    public function resolveDestinationAreaId(?string $provinceName, ?string $cityName, int|string|null $fallbackAreaId = null): ?int
    {
        $province = $this->provinceByName($provinceName);
        if ($province?->area_id !== null) {
            return (int) $province->area_id;
        }

        if (! $this->hasActiveProvinces() && $fallbackAreaId !== null && $fallbackAreaId !== '') {
            return (int) $fallbackAreaId;
        }

        return null;
    }

    public function provinceByName(?string $provinceName): ?Province
    {
        $provinceName = trim((string) $provinceName);
        if ($provinceName === '') {
            return null;
        }

        return Province::where('is_active', true)
            ->whereNotNull('area_id')
            ->whereRaw('LOWER(name) = ?', [strtolower($provinceName)])
            ->first();
    }

    /**
     * Active box types rarely change, so keep them warm until admin edits happen.
     * Auto-seeds defaults if the database has no box types.
     */
    public function activeBoxTypes(): Collection
    {
        $boxTypes = Cache::rememberForever(self::ACTIVE_BOX_TYPES_KEY, function () {
            $this->ensureCustomBoxCbmRate();
            return BoxType::where('is_active', true)
                ->orderBy('name')
                ->get();
        });

        if ($boxTypes->isEmpty() && !BoxType::exists()) {
            $this->seedDefaultBoxTypes();
            Cache::forget(self::ACTIVE_BOX_TYPES_KEY);

            return Cache::rememberForever(self::ACTIVE_BOX_TYPES_KEY, function () {
                return BoxType::where('is_active', true)
                    ->orderBy('name')
                    ->get();
            });
        }

        return $boxTypes;
    }

    /**
     * Price matrix is small and read frequently while creating bookings.
     * Auto-seeds baseline pricing if no prices exist but areas and box types do.
     */
    public function boxPrices(): Collection
    {
        $prices = Cache::rememberForever(self::BOX_PRICES_KEY, function () {
            return BoxPrice::with(['area', 'boxType', 'pickupZone'])
                ->latest()
                ->get();
        });

        if ($prices->isEmpty() && !BoxPrice::exists()) {
            $this->seedDefaultPrices();
            Cache::forget(self::BOX_PRICES_KEY);

            return Cache::rememberForever(self::BOX_PRICES_KEY, function () {
                return BoxPrice::with(['area', 'boxType', 'pickupZone'])
                    ->latest()
                    ->get();
            });
        }

        return $prices;
    }

    public function activePickupZones(): Collection
    {
        return Cache::rememberForever(self::ACTIVE_PICKUP_ZONES_KEY, function () {
            return PickupZone::with('suburbs')->where('is_active', true)->get();
        });
    }

    /**
     * Look up the price for a specific pickup_zone × area × box_type combination.
     *
     * @param  int|string       $areaId       Destination area in the Philippines
     * @param  int|string       $boxTypeId    Box type (Jumbo, Large, Medium, etc.)
     * @param  int|string|null  $pickupZoneId Pickup zone in Australia (required for accurate pricing)
     * @return BoxPrice|null
     */
    public function priceFor(int|string $areaId, int|string $boxTypeId, int|string|null $pickupZoneId = null): ?BoxPrice
    {
        $prices = $this->boxPrices();

        // Primary lookup: exact match on all three dimensions
        if ($pickupZoneId !== null && $pickupZoneId !== '') {
            $matched = $prices->first(fn (BoxPrice $price): bool =>
                (int) $price->area_id === (int) $areaId
                && (int) $price->box_type_id === (int) $boxTypeId
                && (int) $price->pickup_zone_id === (int) $pickupZoneId
            );

            if ($matched) {
                return $matched;
            }
        }

        // Fallback: match on area × box_type only (for backwards compatibility)
        return $prices->first(fn (BoxPrice $price): bool =>
            (int) $price->area_id === (int) $areaId
            && (int) $price->box_type_id === (int) $boxTypeId
        );
    }

    public function ensureCustomBoxCbmRate(): void
    {
        $existing = BoxType::whereRaw('LOWER(name) = ?', ['custom box (cbm)'])->first();
        if ($existing) {
            if ($existing->name !== 'Custom Box (CBM)') {
                $existing->update(['name' => 'Custom Box (CBM)']);
            }
        } else {
            BoxType::create(['name' => 'Custom Box (CBM)', 'dimensions' => null, 'is_active' => true]);
        }
    }

    /**
     * Return the CBM rate (AUD per m³) configured for a destination area and pickup zone.
     * Looks for the price assigned to the "Custom Box (CBM)" BoxType for that area+zone matrix.
     * Falls back to the legacy global CBM rate on the Area model if no matrix price is found.
     */
    public function cbmRateFor(int|string $areaId, int|string|null $pickupZoneId = null): ?float
    {
        $boxTypes = $this->activeBoxTypes();
        $customCbmType = $boxTypes->first(fn ($bt): bool => strtolower($bt->name) === 'custom box (cbm)' || str_contains(strtolower($bt->name), 'cbm'));

        if ($customCbmType && $pickupZoneId !== null) {
            $priceRecord = $this->priceFor($areaId, $customCbmType->id, $pickupZoneId);
            if ($priceRecord && (float) $priceRecord->price > 0) {
                return (float) $priceRecord->price;
            }
        }

        return null;
    }

    /**
     * Return the Door-to-Door Delivery Add-On Fee configured for a destination area.
     * Returns 0.00 when no fee is set.
     */
    public function doorToDoorFeeFor(int|string $areaId): float
    {
        $area = $this->activeAreas()->first(fn (Area $a): bool => (int) $a->id === (int) $areaId);

        return $area && $area->door_to_door_fee !== null ? (float) $area->door_to_door_fee : 0.00;
    }

    public function forgetBookingReferenceData(): void
    {
        Cache::forget(self::ACTIVE_AREAS_KEY);
        Cache::forget(self::ACTIVE_BOX_TYPES_KEY);
        Cache::forget(self::BOX_PRICES_KEY);
        Cache::forget(self::ACTIVE_PROVINCES_KEY);
        Cache::forget(self::ACTIVE_PICKUP_ZONES_KEY);
    }

    /**
     * Create the default destination areas when the database is empty.
     */
    private function seedDefaultAreas(): void
    {
        foreach (self::DEFAULT_AREAS as $name) {
            Area::firstOrCreate(['name' => $name], ['is_active' => true]);
        }
    }

    /**
     * Create the 3 standard box types when the database is empty.
     */
    private function seedDefaultBoxTypes(): void
    {
        foreach (self::DEFAULT_BOX_TYPES as $bt) {
            BoxType::firstOrCreate(
                ['name' => $bt['name']],
                ['dimensions' => $bt['dimensions'], 'is_active' => true]
            );
        }
    }

    /**
     * Create the baseline price matrix for all pickup_zone × area × box_type combinations.
     * Uses the rate card data. All box types get the same flat rate per zone × area.
     */
    private function seedDefaultPrices(): void
    {
        $areas = Area::where('is_active', true)->get()->keyBy('name');
        $boxTypes = BoxType::where('is_active', true)->get();
        $zones = PickupZone::where('is_active', true)->get()->keyBy('code');

        if ($areas->isEmpty() || $boxTypes->isEmpty() || $zones->isEmpty()) {
            return;
        }

        foreach (self::DEFAULT_PRICES as $zoneCode => $areaPrices) {
            $zone = $zones->get($zoneCode);
            if (!$zone) {
                continue;
            }

            foreach ($areaPrices as $areaName => $price) {
                $area = $areas->get($areaName);
                if (!$area) {
                    continue;
                }

                // All box types get the same flat rate
                foreach ($boxTypes as $boxType) {
                    BoxPrice::firstOrCreate(
                        [
                            'pickup_zone_id' => $zone->id,
                            'area_id' => $area->id,
                            'box_type_id' => $boxType->id,
                        ],
                        ['price' => $price]
                    );
                }
            }
        }

        // Any active zone × area combo not covered by defaults gets Luzon rate
        $defaultRate = 105.00;
        foreach ($zones as $zone) {
            foreach ($areas as $area) {
                foreach ($boxTypes as $boxType) {
                    BoxPrice::firstOrCreate(
                        [
                            'pickup_zone_id' => $zone->id,
                            'area_id' => $area->id,
                            'box_type_id' => $boxType->id,
                        ],
                        ['price' => $defaultRate]
                    );
                }
            }
        }
    }
}
