<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\PickupZone;
use App\Models\Suburb;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PickupZoneController extends Controller
{
    public function index(Request $request)
    {
        $pickupZones = PickupZone::with(['suburbs' => function($q) {
            $q->where('is_active', true)->orderBy('name');
        }])->orderBy('name')->get();

        $allSuburbs = Suburb::where('is_active', true)->orderBy('name')->get(['id', 'name', 'pickup_zone_id']);

        return Inertia::render('admin/PickupZones/Index', [
            'pickupZones' => $pickupZones,
            'allSuburbs' => $allSuburbs,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        PickupZone::create($validated);

        return back()->with('success', 'Pickup Zone created successfully.');
    }

    public function update(Request $request, PickupZone $pickupZone)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'pickup_windows' => 'nullable|array',
            'blackout_dates' => 'nullable|array',
            'lead_time_days' => 'nullable|integer',
            'suburb_ids' => 'nullable|array',
            'suburb_ids.*' => 'exists:suburbs,id',
        ]);

        $pickupZone->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
            'pickup_windows' => $validated['pickup_windows'] ?? null,
            'blackout_dates' => $validated['blackout_dates'] ?? null,
            'lead_time_days' => $validated['lead_time_days'] ?? null,
        ]);

        if (array_key_exists('suburb_ids', $validated)) {
            // Unassign suburbs that were previously in this zone but aren't in the new list
            Suburb::where('pickup_zone_id', $pickupZone->id)
                  ->whereNotIn('id', $validated['suburb_ids'] ?? [])
                  ->update(['pickup_zone_id' => null]);
            
            // Assign the new suburbs
            if (!empty($validated['suburb_ids'])) {
                Suburb::whereIn('id', $validated['suburb_ids'])
                      ->update(['pickup_zone_id' => $pickupZone->id]);
            }
        }

        return back()->with('success', 'Pickup Zone updated successfully.');
    }

    public function destroy(PickupZone $pickupZone)
    {
        // Don't delete if it has bookings, etc., but for now:
        $pickupZone->delete();
        return back()->with('success', 'Pickup Zone deleted successfully.');
    }
}
