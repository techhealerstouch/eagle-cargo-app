<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Suburb;
use App\Models\PickupZone;
use Illuminate\Http\Request;
use Inertia\Inertia;

class SuburbController extends Controller
{
    public function index(Request $request)
    {
        $query = Suburb::with('pickupZone')->orderBy('name');

        if ($request->filled('search')) {
            $search = strtolower($request->search);
            $query->where(function ($q) use ($search) {
                $q->whereRaw('LOWER(name) like ?', ["%{$search}%"])
                  ->orWhereRaw('LOWER(postcode) like ?', ["%{$search}%"]);
            });
        }

        if ($request->filled('pickup_zone_id')) {
            if ($request->pickup_zone_id === 'unassigned') {
                $query->whereNull('pickup_zone_id');
            } else {
                $query->where('pickup_zone_id', $request->pickup_zone_id);
            }
        }

        $suburbs = $query->paginate(50)->withQueryString();
        $pickupZones = PickupZone::orderBy('name')->get(['id', 'name']);

        return Inertia::render('admin/Suburbs/Index', [
            'suburbs' => $suburbs,
            'pickupZones' => $pickupZones,
            'filters' => $request->only('search', 'pickup_zone_id'),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'postcode' => 'nullable|string|max:10',
            'pickup_zone_id' => 'nullable|exists:pickup_zones,id',
            'is_active' => 'boolean',
        ]);

        Suburb::create($validated);

        return back()->with('success', 'Suburb created successfully.');
    }

    public function update(Request $request, Suburb $suburb)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'postcode' => 'nullable|string|max:10',
            'pickup_zone_id' => 'nullable|exists:pickup_zones,id',
            'is_active' => 'boolean',
        ]);

        $suburb->update($validated);

        return back()->with('success', 'Suburb updated successfully.');
    }

    public function destroy(Suburb $suburb)
    {
        // Domain Policy Check
        if (\App\Models\Sender::where('suburb', $suburb->name)->exists()) {
            return back()->with('error', 'Cannot delete Suburb because it is linked to active senders/bookings. We recommend deactivation instead.');
        }

        try {
            $suburb->delete();
            return back()->with('success', 'Suburb deleted successfully.');
        } catch (\Illuminate\Database\QueryException $e) {
            if ($e->getCode() == "23000") {
                return back()->with('error', 'Cannot delete Suburb because it is linked to existing records. We recommend deactivation instead.');
            }
            throw $e;
        }
    }
}
