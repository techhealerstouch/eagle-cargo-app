<?php

namespace Database\Seeders;

use App\Models\Area;
use App\Models\Province;
use Illuminate\Database\Seeder;

class ProvinceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $getArea = function ($name) {
            $area = Area::withTrashed()->where('name', $name)->first();
            if ($area) {
                if ($area->trashed()) {
                    $area->restore();
                }
                return $area;
            }
            return Area::create(['name' => $name, 'is_active' => true]);
        };

        $areas = [
            'METRO MANILA' => $getArea('Metro Manila'),
            'OUTER NCR' => $getArea('Outer NCR'),
            'LUZON 1' => $getArea('Luzon 1'),
            'LUZON 2' => $getArea('Luzon 2'),
            'VISAYAS' => $getArea('Visayas'),
            'MINDANAO' => $getArea('Mindanao'),
            'INTER-ISLAND' => $getArea('Inter-Island'),
        ];

        $provinces = [
            // METRO MANILA
            ['name' => 'METRO MANILA', 'area_id' => $areas['METRO MANILA']->id],

            // OUTER NCR
            ['name' => 'BULACAN', 'area_id' => $areas['OUTER NCR']->id],
            ['name' => 'RIZAL', 'area_id' => $areas['OUTER NCR']->id],
            ['name' => 'ANTIPOLO', 'area_id' => $areas['OUTER NCR']->id],
            ['name' => 'LAGUNA', 'area_id' => $areas['OUTER NCR']->id],
            ['name' => 'CAVITE', 'area_id' => $areas['OUTER NCR']->id],
            ['name' => 'QUEZON PROVINCE', 'area_id' => $areas['OUTER NCR']->id],

            // LUZON 1
            ['name' => 'BATAAN', 'area_id' => $areas['LUZON 1']->id],
            ['name' => 'BATANGAS', 'area_id' => $areas['LUZON 1']->id],
            ['name' => 'NUEVA ECIJA', 'area_id' => $areas['LUZON 1']->id],
            ['name' => 'PAMPANGA', 'area_id' => $areas['LUZON 1']->id],
            ['name' => 'PANGASINAN', 'area_id' => $areas['LUZON 1']->id],
            ['name' => 'TARLAC', 'area_id' => $areas['LUZON 1']->id],

            // LUZON 2
            ['name' => 'ABRA', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'APAYAO', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'AURORA PROVINCE', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'BAGUIO', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'BENGUET', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'BICOL SORSOGON', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'CAMARINES BICOL', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'CAGAYAN VALLEY', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'IFUGAO', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'ILOCOS NORTE', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'ILOCOS SUR', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'ISABELA', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'KALINGA APAYAO', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'LA UNION', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'MOUNTAIN PROVINCE', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'NUEVA VIZCAYA', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'QUIRINO', 'area_id' => $areas['LUZON 2']->id],
            ['name' => 'ZAMBALES', 'area_id' => $areas['LUZON 2']->id],

            // VISAYAS
            ['name' => 'AKLAN', 'area_id' => $areas['VISAYAS']->id],
            ['name' => 'ANTIQUE', 'area_id' => $areas['VISAYAS']->id],
            ['name' => 'BACOLOD', 'area_id' => $areas['VISAYAS']->id],
            ['name' => 'BILIRAN', 'area_id' => $areas['VISAYAS']->id],
            ['name' => 'BOHOL', 'area_id' => $areas['VISAYAS']->id],
            ['name' => 'CAPIZ', 'area_id' => $areas['VISAYAS']->id],
            ['name' => 'CEBU', 'area_id' => $areas['VISAYAS']->id],
            ['name' => 'DUMAGUETE', 'area_id' => $areas['VISAYAS']->id],
            ['name' => 'ILOILO', 'area_id' => $areas['VISAYAS']->id],
            ['name' => 'LEYTE', 'area_id' => $areas['VISAYAS']->id],
            ['name' => 'NEGROS OCCIDENTAL', 'area_id' => $areas['VISAYAS']->id],
            ['name' => 'NEGROS ORIENTAL', 'area_id' => $areas['VISAYAS']->id],
            ['name' => 'SAMAR', 'area_id' => $areas['VISAYAS']->id],

            // MINDANAO
            ['name' => 'AGUSAN DEL NORTE', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'AGUSAN DEL SUR', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'CAGAYAN DE ORO', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'DAVAO', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'GENERAL SANTOS', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'ILIGAN', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'KIDAPAWAN', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'MARAWI', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'MISAMIS OCCIDENTAL', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'MISAMIS ORIENTAL', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'NORTH COTABATO', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'OZAMIS', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'SOUTH COTABATO', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'SULTAN KUDARAT', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'SURIGAO DEL NORTE', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'SURIGAO DEL SUR', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'ZAMBOANGA DEL NORTE', 'area_id' => $areas['MINDANAO']->id],
            ['name' => 'ZAMBOANGA DEL SUR', 'area_id' => $areas['MINDANAO']->id],

            // INTER-ISLAND
            ['name' => 'ALABAT', 'area_id' => $areas['INTER-ISLAND']->id],
            ['name' => 'CAMIGUIN', 'area_id' => $areas['INTER-ISLAND']->id],
            ['name' => 'CATANDUANES BICOL', 'area_id' => $areas['INTER-ISLAND']->id],
            ['name' => 'MARINDUQUE', 'area_id' => $areas['INTER-ISLAND']->id],
            ['name' => 'MASBATE BICOL', 'area_id' => $areas['INTER-ISLAND']->id],
            ['name' => 'MINDORO OCCIDENTAL', 'area_id' => $areas['INTER-ISLAND']->id],
            ['name' => 'MINDORO ORIENTAL', 'area_id' => $areas['INTER-ISLAND']->id],
            ['name' => 'PALAWAN', 'area_id' => $areas['INTER-ISLAND']->id],
            ['name' => 'ROMBLON', 'area_id' => $areas['INTER-ISLAND']->id],
            ['name' => 'PUERTO PRINCESA', 'area_id' => $areas['INTER-ISLAND']->id],
            ['name' => 'TINGLOY', 'area_id' => $areas['INTER-ISLAND']->id],
            ['name' => 'SIQUIJOR ISLAND', 'area_id' => $areas['INTER-ISLAND']->id],
            ['name' => 'SIARGAO ISLAND', 'area_id' => $areas['INTER-ISLAND']->id],
            ['name' => 'GUIMARAS ISLAND', 'area_id' => $areas['INTER-ISLAND']->id],
            ['name' => 'CAMOTES ISLAND', 'area_id' => $areas['INTER-ISLAND']->id],
        ];

        foreach ($provinces as $provinceData) {
            Province::updateOrCreate(
                ['name' => $provinceData['name']],
                ['area_id' => $provinceData['area_id'], 'is_active' => true]
            );
        }
    }
}
