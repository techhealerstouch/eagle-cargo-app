<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\PickupZone;
use App\Models\Suburb;

class SuburbSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $metroZone = PickupZone::where('code', 'metro_melbourne')->first();
        $bgkZone = PickupZone::where('code', 'ballarat_geelong_kyneton')->first();
        $sgbZone = PickupZone::where('code', 'shepparton_gippsland_bendigo')->first();
        $wvZone = PickupZone::where('code', 'western_victoria')->first();

        $suburbs = [
            // Metro Melbourne
            ['zone' => $metroZone, 'names' => [
                // INNER / INNER WEST
                'Albert Park', 'Carlton', 'Collingwood', 'Docklands', 'Fitzroy', 'Melbourne CBD', 'Port Melbourne', 'Richmond', 'Southbank', 'Ascot Vale', 'Braybrook', 'Brooklyn', 'Flemington', 'Footscray', 'Kensington', 'Maribyrnong', 'Newport', 'West Footscray',
                // EAST/INNER EAST MELBOURNE
                'Balwyn', 'Bayswater', 'Blackburn', 'Box Hill', 'Burwood', 'Camberwell', 'Chirnside Park', 'Croydon', 'Donvale', 'Glen Waverley', 'Kew', 'Knoxfield', 'Mitcham', 'Nunawading', 'Ringwood', 'Vermont', 'Wantirna',
                // WESTERN MELBOURNE
                'Albion', 'Avondale Heights', 'Caroline Springs', 'Hillside', 'Keilor', 'Kings Park', 'St Albans', 'Sunshine', 'Sunshine West', 'Taylors Hill',
                // NORTHERN / Outer/Inner North
                'Beveridge', 'Broadmeadows', 'Bundoora', 'Coburg', 'Donnybrook', 'Doreen', 'Epping', 'Glenroy', 'Lalor', 'Mernda', 'Mickleham', 'Mill Park', 'Preston', 'Reservoir', 'South Morang', 'Thomastown', 'Whittlesea', 'Kalkallo', 'Northcote', 'Wollert',
                // North-East / Eastern
                'Diamond Creek', 'Doncaster', 'Eltham', 'Greensborough', 'Templestowe', 'Heidelberg',
                // West/North West (Wyndham)
                'Altona', 'Altona Meadows', 'Hoppers Crossing', 'Laverton', 'Manor Lakes', 'Melton', 'Point Cook', 'Tarneit', 'Truganina', 'Werribee', 'Werribee South', 'Williamstown', 'Craigieburn', 'Essendon', 'Gladstone Park', 'Greenvale', 'Jacana', 'Tullamarine', 'Sunbury'
            ]],
            // Ballarat / Geelong / Kyneton
            ['zone' => $bgkZone, 'names' => [
                // GEELONG/SURF COAST
                'Belmont', 'Corio', 'Geelong', 'Lara', 'Waurn Ponds', 'Highton', 'Grovedale', 'Norlane', 'North Geelong', 'Thomson', 'Charlemont', 'Mount Duneed', 'Torquay',
                // BALLARAT
                'Alfredton', 'Bacchus Marsh', 'Ballan', 'Ballarat', 'Buninyong', 'Cardigan', 'Creswick', 'Daylesford', 'Delacombe', 'Lucas', 'Mitchell Park', 'Mount Clear', 'Sebastopol', 'Wendouree',
                // KYNETON
                'Carlsruhe', 'Castlemaine', 'Chewton', 'Gisborne', 'Glenlyon', 'Harcourt', 'Kyneton', 'Macedon', 'Malsbury', 'Metcalfe', 'Newham', 'Redesdale', 'Taradale', 'Trentham', 'Tylden', 'Woodend', 'Elphinstone'
            ]],
            // Shepparton / Gippsland / Bendigo
            ['zone' => $sgbZone, 'names' => [
                // BENDIGO
                'Bendigo', 'Eaglehawk', 'Epsom', 'Flora Hill', 'Golden square', 'Kangaroo Flat', 'Kennington', 'Quarry Hill', 'Strathdale',
                // GIPPSLAND WEST
                'Drouin', 'Moe', 'Traralgon', 'Warragul',
                // SHEPPARTON
                'Kilmore', 'Seymour', 'Shepparton', 'Barooga', 'Cobram', 'Finley', 'Katamatite', 'Numurkah', 'Tocumwal'
            ]],
            // Western Victoria
            ['zone' => $wvZone, 'names' => [
                'Ararat', 'Camperdown', 'Cobden', 'Colac', 'Dimboola', 'Dunkeld', 'Edenhope', 'Goroke', 'Halls Gap', 'Hamilton', 'Heywood', 'Horsham', 'Kaniva', 'Minyip', 'Murtoa', 'Natimuk', 'Nhill', 'Penshurst', 'Portland', 'Port Fairy', 'Stawell', 'Timboon', 'Twelve Apostles (Princetown)', 'Warrnambool', 'Warracknabeal'
            ]]
        ];

        foreach ($suburbs as $group) {
            $zoneId = $group['zone'] ? $group['zone']->id : null;
            
            // Deduplicate names within the group just in case
            $uniqueNames = array_unique($group['names']);
            
            foreach ($uniqueNames as $name) {
                // Use updateOrCreate so if it was added manually it gets reassigned to proper zone
                Suburb::updateOrCreate(
                    ['name' => $name],
                    ['pickup_zone_id' => $zoneId, 'is_active' => true]
                );
            }
        }
    }
}
