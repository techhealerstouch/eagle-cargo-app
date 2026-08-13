<?php

namespace Database\Seeders;

use App\Models\Area;
use App\Models\AreaMilestone;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\PickupZone;
use App\Models\Suburb;
use Illuminate\Database\Seeder;

class ConfigSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Create core Areas (6 destination zones)
        $ncr       = Area::firstOrCreate(['name' => 'Metro Manila'], ['is_active' => true]);
        $outerNcr  = Area::firstOrCreate(['name' => 'Outer NCR'],    ['is_active' => true]);
        $luzon     = Area::firstOrCreate(['name' => 'Luzon'],         ['is_active' => true]);
        $visayas   = Area::firstOrCreate(['name' => 'Visayas'],       ['is_active' => true]);
        $mindanao  = Area::firstOrCreate(['name' => 'Mindanao'],      ['is_active' => true]);
        $interIsland = Area::firstOrCreate(['name' => 'Inter-Island'], ['is_active' => true]);

        // Ensure legacy Davao City area is deactivated
        Area::where('name', 'Davao City')->update(['is_active' => false]);

        $defaultMilestones = [
            'Collected from Sender',
            'Arrived at Transit Facility',
            'Customs Cleared',
            'Out for Delivery',
            'Delivered',
        ];

        foreach ([$ncr, $outerNcr, $luzon, $visayas, $mindanao, $interIsland] as $area) {
            foreach ($defaultMilestones as $index => $milestone) {
                AreaMilestone::firstOrCreate([
                    'area_id' => $area->id,
                    'name' => $milestone,
                ], [
                    'sequence_order' => $index,
                    'is_final_delivery' => ($index === count($defaultMilestones) - 1),
                ]);
            }
        }

        // 2. Create Box Types
        $jumbo = BoxType::firstOrCreate(['name' => 'Jumbo', 'dimensions' => '24x24x24'], ['is_active' => true]);
        $large = BoxType::firstOrCreate(['name' => 'Large', 'dimensions' => '20x20x20'], ['is_active' => true]);
        $medium = BoxType::firstOrCreate(['name' => 'Medium', 'dimensions' => '18x18x18'], ['is_active' => true]);
        $custom = BoxType::firstOrCreate(['name' => 'Custom Box (CBM)', 'dimensions' => null], ['is_active' => true]);

        // 3. Create Pickup Zones and their Suburbs
        $metroSuburbs = [
            'Albert Park', 'Carlton', 'Collingwood', 'Docklands', 'Fitzroy', 'Melbourne CBD', 'Port Melbourne', 'Richmond', 'Southbank', 'Ascot Vale', 'Braybrook', 'Brooklyn', 'Flemington', 'Footscray', 'Kensington', 'Maribyrnong', 'Newport', 'West Footscray',
            'Balwyn', 'Bayswater', 'Blackburn', 'Box Hill', 'Boxhill', 'Burwood', 'Camberwell', 'Chirnside Park', 'Croydon', 'Donvale', 'Glen Waverley', 'Kew', 'Knoxfiled', 'Mitcham', 'Nunawading', 'Ringwood', 'Vermont', 'Wantirna',
            'Albion', 'Avondale Heights', 'Caroline Springs', 'Hillside', 'Keilor', 'Kings Park', 'St Albans', 'Sunshine', 'Sunshine West', 'Taylors Hill',
            'Beveridge', 'Broadmeadows', 'Bundoora', 'Coburg', 'Donnybrook', 'Doreen', 'Epping', 'Glenroy', 'Lalor', 'Mernda', 'Mickleham', 'Mill Park', 'Preston', 'Reservoir', 'South Morang', 'Thomastown', 'Whittlesea', 'Kalkallo', 'Northcote', 'Wollert',
            'Diamond Creek', 'Doncaster', 'Eltham', 'Greensborough', 'Templestowe', 'Heidelberg',
            'Altona', 'Altona Meadows', 'Hoppers Crossing', 'Laverton', 'Manor Lakes', 'Melton', 'Point Cook', 'Tarneit', 'Truganina', 'Werribee', 'Werribee South', 'Williamstown', 'Craigieburn', 'Essendon', 'Gladstone Park', 'Greenvale', 'Jacana', 'Tullamarine', 'Sunbury'
        ];
        
        $ballaratSuburbs = [
            'Belmont', 'Corio', 'Geelong', 'Lara', 'Waurn Ponds', 'Highton', 'Grovedale', 'Norlane', 'North Geelong', 'Thomson', 'Charlemont', 'Mount Duneed', 'Torquay',
            'Alfredton', 'Bacchus Marsh', 'Ballan', 'Ballarat', 'Buninyong', 'Cardigan', 'Creswick', 'Daylesford', 'Delacombe', 'Lucas', 'Mitchell Park', 'Mount Clear', 'Sebastopol', 'Wendouree',
            'Carlsruhe', 'Castlemaine', 'Chewton', 'Gisborne', 'Glenlyon', 'Harcourt', 'Kyneton', 'Macedon', 'Malsbury', 'Metcalfe', 'Newham', 'Redesdale', 'Taradale', 'Trentham', 'Tylden', 'Woodend', 'Elphinstone'
        ];
        
        $sheppartonSuburbs = [
            'Bendigo', 'Eaglehawk', 'Epsom', 'Flora Hill', 'Golden square', 'Kangaroo Flat', 'Kennington', 'Quarry Hill', 'Strathdale',
            'Drouin', 'Moe', 'Traralgon', 'Warragul',
            'Kilmore', 'Seymour', 'Shepparton', 'Barooga', 'Cobram', 'Finley', 'Katamatite', 'Numurkah', 'Tocumwal'
        ];
        
        $westernVictoriaSuburbs = [
            'Ararat', 'Camperdown', 'Cobden', 'Colac', 'Dimboola', 'Dunkeld', 'Edenhope', 'Goroke', 'Halls Gap', 'Hamilton', 'Heywood', 'Horsham',
            'Kaniva', 'Minyip', 'Murtoa', 'Natimuk', 'Nhill', 'Penshurst', 'Portland', 'Pot Fairy', 'Stawell', 'Timboon', 'Twelve Apostles (Princetown)', 'Warnambool', 'Warracknabeal'
        ];

        $metroZone = PickupZone::updateOrCreate(['code' => 'metro_areas'], ['name' => 'METRO AREAS', 'is_active' => true]);
        $ballaratZone = PickupZone::updateOrCreate(['code' => 'ballarat_geelong_kyneton'], ['name' => 'BALLARAT / GEELONG and KYNETON AREAS', 'is_active' => true]);
        $sheppartonZone = PickupZone::updateOrCreate(['code' => 'shepparton_gippsland_bendigo'], ['name' => 'SHEPPARTON, GIPPSLAND and BENDIGO AREAS', 'is_active' => true]);
        $westernVicZone = PickupZone::updateOrCreate(['code' => 'western_victoria_regional'], ['name' => 'WESTERN VICTORIA REGIONAL AREAS', 'is_active' => true]);

        // Seed Suburbs into the relational suburbs table
        $zonesSuburbsMap = [
            $metroZone->id => $metroSuburbs,
            $ballaratZone->id => $ballaratSuburbs,
            $sheppartonZone->id => $sheppartonSuburbs,
            $westernVicZone->id => $westernVictoriaSuburbs,
        ];

        foreach ($zonesSuburbsMap as $zoneId => $suburbList) {
            foreach (array_unique($suburbList) as $suburbName) {
                Suburb::updateOrCreate(
                    ['name' => trim($suburbName)],
                    ['pickup_zone_id' => $zoneId, 'is_active' => true]
                );
            }
        }

        // Cleanup any legacy seeded zones that are not these 4
        PickupZone::whereNotIn('id', [$metroZone->id, $ballaratZone->id, $sheppartonZone->id, $westernVicZone->id])->delete();
        
        // Ensure all prices are deleted to recreate them correctly with zone associations
        BoxPrice::truncate();

        // 4. Attach Pricing per Zone
        // Matrix format: [Destination Area ID => Base (Jumbo) Price]
        
        // METRO AREAS PRICES
        $this->seedZonePrices($metroZone->id, $jumbo, $large, $medium, [
            $ncr->id => 95.00,
            $outerNcr->id => 105.00,
            $luzon->id => 105.00,
            $visayas->id => 130.00,
            $mindanao->id => 140.00,
            $interIsland->id => 150.00,
        ]);

        // BALLARAT / GEELONG and KYNETON AREAS PRICES
        $this->seedZonePrices($ballaratZone->id, $jumbo, $large, $medium, [
            $ncr->id => 110.00,
            $outerNcr->id => 120.00,
            $luzon->id => 120.00,
            $visayas->id => 140.00,
            $mindanao->id => 150.00,
            $interIsland->id => 160.00,
        ]);

        // SHEPPARTON, GIPPSLAND and BENDIGO AREAS PRICES
        $this->seedZonePrices($sheppartonZone->id, $jumbo, $large, $medium, [
            $ncr->id => 140.00,
            $outerNcr->id => 150.00,
            $luzon->id => 150.00,
            $visayas->id => 175.00,
            $mindanao->id => 185.00,
            $interIsland->id => 200.00,
        ]);

        // WESTERN VICTORIA REGIONAL AREAS PRICES
        $this->seedZonePrices($westernVicZone->id, $jumbo, $large, $medium, [
            $ncr->id => 150.00,
            $outerNcr->id => 150.00, // Document says 150.00
            $luzon->id => 160.00,
            $visayas->id => 180.00,
            $mindanao->id => 190.00,
            $interIsland->id => 220.00,
        ]);
    }
    
    private function seedZonePrices($pickupZoneId, $jumbo, $large, $medium, $areaRates)
    {
        if (!$pickupZoneId) {
            return;
        }
        
        foreach ($areaRates as $areaId => $jumboPrice) {
            BoxPrice::create([
                'area_id' => $areaId, 
                'pickup_zone_id' => $pickupZoneId,
                'box_type_id' => $jumbo->id, 
                'price' => $jumboPrice
            ]);
            BoxPrice::create([
                'area_id' => $areaId, 
                'pickup_zone_id' => $pickupZoneId,
                'box_type_id' => $large->id, 
                'price' => $jumboPrice - 15.00
            ]);
            BoxPrice::create([
                'area_id' => $areaId, 
                'pickup_zone_id' => $pickupZoneId,
                'box_type_id' => $medium->id, 
                'price' => $jumboPrice - 30.00
            ]);
        }
    }
}
