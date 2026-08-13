<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Area;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\PickupZone;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class BoxPriceController extends Controller
{
    public function index()
    {
        app(\App\Services\ReferenceDataService::class)->ensureCustomBoxCbmRate();

        $pickupZones = PickupZone::where('is_active', true)->orderBy('name')->get();
        $areas       = Area::where('is_active', true)->orderBy('name')->get();
        $boxTypes    = BoxType::where('is_active', true)->orderBy('name')->get();

        $prices = BoxPrice::all()->map(fn ($p) => [
            'id'             => $p->id,
            'pickup_zone_id' => $p->pickup_zone_id,
            'area_id'        => $p->area_id,
            'box_type_id'    => $p->box_type_id,
            'price'          => $p->price,
        ]);

        return Inertia::render('admin/BookingRates/Index', [
            'pickupZones' => $pickupZones,
            'areas'       => $areas,
            'boxTypes'    => $boxTypes,
            'prices'      => $prices,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'area_id'        => ['required', 'exists:areas,id'],
            'pickup_zone_id' => ['required', 'exists:pickup_zones,id'],
            'box_type_id'    => [
                'required',
                'exists:box_types,id',
                Rule::unique('box_prices')->where(fn ($query) => $query
                    ->where('area_id', $request->integer('area_id'))
                    ->where('pickup_zone_id', $request->integer('pickup_zone_id'))),
            ],
            'price' => ['required', 'numeric', 'min:0'],
        ]);

        $price = BoxPrice::create($validated);

        app(\App\Services\ReferenceDataService::class)->forgetBookingReferenceData();

        return response()->json(['price' => $price], 201);
    }

    public function update(Request $request, BoxPrice $boxPrice)
    {
        $validated = $request->validate([
            'price' => ['required', 'numeric', 'min:0'],
        ]);

        $boxPrice->update($validated);

        app(\App\Services\ReferenceDataService::class)->forgetBookingReferenceData();

        return response()->json(['price' => $boxPrice->fresh()]);
    }
    public function copy(Request $request)
    {
        $validated = $request->validate([
            'from_zone_id' => ['required', 'exists:pickup_zones,id'],
            'to_zone_id'   => ['required', 'exists:pickup_zones,id', 'different:from_zone_id'],
        ]);

        $toZoneId = $validated['to_zone_id'];
        
        // Snapshot current prices for the target zone to allow undo
        $oldPrices = BoxPrice::where('pickup_zone_id', $toZoneId)->get()->mapWithKeys(function ($p) {
            return [$p->id => ['id' => $p->id, 'price' => $p->price]];
        })->toArray();
        session()->put('undo_box_prices_' . $toZoneId, $oldPrices);

        $fromPrices = BoxPrice::where('pickup_zone_id', $validated['from_zone_id'])->get();

        foreach ($fromPrices as $price) {
            BoxPrice::updateOrCreate(
                [
                    'pickup_zone_id' => $toZoneId,
                    'area_id'        => $price->area_id,
                    'box_type_id'    => $price->box_type_id,
                ],
                [
                    'price' => $price->price,
                ]
            );
        }

        app(\App\Services\ReferenceDataService::class)->forgetBookingReferenceData();

        return redirect()->back()->with('success', 'Rates copied successfully.');
    }

    public function undoCopy(Request $request)
    {
        $validated = $request->validate([
            'zone_id' => ['required', 'exists:pickup_zones,id']
        ]);

        $zoneId = $validated['zone_id'];
        $oldPrices = session('undo_box_prices_' . $zoneId);

        if (!is_array($oldPrices)) {
            return redirect()->back()->with('error', 'Nothing to undo.');
        }

        $currentPrices = BoxPrice::where('pickup_zone_id', $zoneId)->get();
        foreach ($currentPrices as $current) {
            if (isset($oldPrices[$current->id])) {
                $current->update(['price' => $oldPrices[$current->id]['price']]);
            } else {
                $current->delete();
            }
        }
        
        session()->forget('undo_box_prices_' . $zoneId);
        app(\App\Services\ReferenceDataService::class)->forgetBookingReferenceData();

        return redirect()->back()->with('success', 'Copy action undone.');
    }
}
