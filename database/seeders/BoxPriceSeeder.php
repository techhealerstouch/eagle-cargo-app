<?php

namespace Database\Seeders;

use App\Models\Area;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\PickupZone;
use Illuminate\Database\Seeder;

class BoxPriceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Ensure all Box Types exist
        $jumbo = BoxType::firstOrCreate(['name' => 'Jumbo'], ['dimensions' => '24x24x24', 'is_active' => true]);
        $large = BoxType::firstOrCreate(['name' => 'Large'], ['dimensions' => '20x20x20', 'is_active' => true]);
        $medium = BoxType::firstOrCreate(['name' => 'Medium'], ['dimensions' => '18x18x18', 'is_active' => true]);
        
        $custom = BoxType::whereRaw('LOWER(name) = ?', ['custom box (cbm)'])->first();
        if ($custom) {
            if ($custom->name !== 'Custom Box (CBM)') {
                $custom->update(['name' => 'Custom Box (CBM)']);
            }
        } else {
            $custom = BoxType::create(['name' => 'Custom Box (CBM)', 'dimensions' => null, 'is_active' => true]);
        }

        // 2. Fetch pickup zones
        $metroZone = PickupZone::where('code', 'metro_areas')->orWhere('code', 'metro_melbourne')->first();
        $ballaratZone = PickupZone::where('code', 'ballarat_geelong_kyneton')->first();
        $sheppartonZone = PickupZone::where('code', 'shepparton_gippsland_bendigo')->first();
        $westernVicZone = PickupZone::where('code', 'western_victoria_regional')->orWhere('code', 'western_victoria')->first();

        // 3. Exact matching rates based on the screenshot provided for Ballarat, and extrapolations for others
        
        // --- BALLARAT / GEELONG / KYNETON ---
        $this->seedZoneRates($ballaratZone, $jumbo, $large, $medium, $custom, [
            'Inter-Island' => ['custom' => 35, 'jumbo' => 160, 'large' => 150, 'medium' => 100],
            'Luzon'        => ['custom' => 40, 'jumbo' => 120, 'large' => 90,  'medium' => 70],
            'Luzon 1'      => ['custom' => 0,  'jumbo' => 120, 'large' => 0,   'medium' => 0],
            'Luzon 2'      => ['custom' => 0,  'jumbo' => 120, 'large' => 0,   'medium' => 0],
            'Metro Manila' => ['custom' => 0,  'jumbo' => 110, 'large' => 0,   'medium' => 0],
            'Mindanao'     => ['custom' => 45, 'jumbo' => 140, 'large' => 120, 'medium' => 100],
            'Outer NCR'    => ['custom' => 50, 'jumbo' => 200, 'large' => 150, 'medium' => 100], // Matches the screenshot ($200 Jumbo)
            'Visayas'      => ['custom' => 55, 'jumbo' => 130, 'large' => 110, 'medium' => 0],
        ]);
        
        // --- METRO MELBOURNE --- (Derived by subtracting 25 from Ballarat's Jumbo, based on Markdown)
        $this->seedZoneRates($metroZone, $jumbo, $large, $medium, $custom, [
            'Inter-Island' => ['custom' => 35, 'jumbo' => 135, 'large' => 125, 'medium' => 75],
            'Luzon'        => ['custom' => 40, 'jumbo' => 105, 'large' => 75,  'medium' => 55],
            'Luzon 1'      => ['custom' => 0,  'jumbo' => 105, 'large' => 0,   'medium' => 0],
            'Luzon 2'      => ['custom' => 0,  'jumbo' => 105, 'large' => 0,   'medium' => 0],
            'Metro Manila' => ['custom' => 0,  'jumbo' => 95,  'large' => 0,   'medium' => 0],
            'Mindanao'     => ['custom' => 45, 'jumbo' => 125, 'large' => 105, 'medium' => 85],
            'Outer NCR'    => ['custom' => 50, 'jumbo' => 105, 'large' => 75,  'medium' => 55], // Using $105 as per Markdown for Metro Melbourne Outer NCR
            'Visayas'      => ['custom' => 55, 'jumbo' => 115, 'large' => 95,  'medium' => 0],
        ]);

        // --- SHEPPARTON / GIPPSLAND / BENDIGO --- (+5 over Ballarat based on Markdown)
        $this->seedZoneRates($sheppartonZone, $jumbo, $large, $medium, $custom, [
            'Inter-Island' => ['custom' => 35, 'jumbo' => 165, 'large' => 155, 'medium' => 105],
            'Luzon'        => ['custom' => 40, 'jumbo' => 125, 'large' => 95,  'medium' => 75],
            'Luzon 1'      => ['custom' => 0,  'jumbo' => 125, 'large' => 0,   'medium' => 0],
            'Luzon 2'      => ['custom' => 0,  'jumbo' => 125, 'large' => 0,   'medium' => 0],
            'Metro Manila' => ['custom' => 0,  'jumbo' => 115, 'large' => 0,   'medium' => 0],
            'Mindanao'     => ['custom' => 45, 'jumbo' => 155, 'large' => 135, 'medium' => 115],
            'Outer NCR'    => ['custom' => 50, 'jumbo' => 125, 'large' => 95,  'medium' => 75], 
            'Visayas'      => ['custom' => 55, 'jumbo' => 145, 'large' => 125, 'medium' => 0],
        ]);

        // --- WESTERN VICTORIA --- (+10 over Ballarat based on Markdown)
        $this->seedZoneRates($westernVicZone, $jumbo, $large, $medium, $custom, [
            'Inter-Island' => ['custom' => 35, 'jumbo' => 170, 'large' => 160, 'medium' => 110],
            'Luzon'        => ['custom' => 40, 'jumbo' => 130, 'large' => 100, 'medium' => 80],
            'Luzon 1'      => ['custom' => 0,  'jumbo' => 130, 'large' => 0,   'medium' => 0],
            'Luzon 2'      => ['custom' => 0,  'jumbo' => 130, 'large' => 0,   'medium' => 0],
            'Metro Manila' => ['custom' => 0,  'jumbo' => 120, 'large' => 0,   'medium' => 0],
            'Mindanao'     => ['custom' => 45, 'jumbo' => 160, 'large' => 140, 'medium' => 120],
            'Outer NCR'    => ['custom' => 50, 'jumbo' => 130, 'large' => 100, 'medium' => 80], 
            'Visayas'      => ['custom' => 55, 'jumbo' => 150, 'large' => 130, 'medium' => 0],
        ]);
    }

    private function seedZoneRates($zone, $jumbo, $large, $medium, $custom, $rates)
    {
        if (!$zone) return;

        $areas = Area::all();

        foreach ($rates as $areaName => $prices) {
            // Find area case-insensitively
            $area = $areas->first(fn($a) => strtolower($a->name) === strtolower($areaName));
            if (!$area) continue;

            BoxPrice::updateOrCreate(
                ['pickup_zone_id' => $zone->id, 'area_id' => $area->id, 'box_type_id' => $custom->id],
                ['price' => $prices['custom']]
            );
            BoxPrice::updateOrCreate(
                ['pickup_zone_id' => $zone->id, 'area_id' => $area->id, 'box_type_id' => $jumbo->id],
                ['price' => $prices['jumbo']]
            );
            BoxPrice::updateOrCreate(
                ['pickup_zone_id' => $zone->id, 'area_id' => $area->id, 'box_type_id' => $large->id],
                ['price' => $prices['large']]
            );
            BoxPrice::updateOrCreate(
                ['pickup_zone_id' => $zone->id, 'area_id' => $area->id, 'box_type_id' => $medium->id],
                ['price' => $prices['medium']]
            );
        }
    }
}
