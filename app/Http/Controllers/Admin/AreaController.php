<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Area;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AreaController extends Controller
{
    protected const DEFAULT_PROVINCES = [
        'Metro Manila', 'Abra', 'Albay', 'Apayao', 'Aurora', 'Bataan', 'Batanes', 'Batangas', 'Benguet', 'Bulacan',
        'Cagayan', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Cavite', 'Ifugao', 'Ilocos Norte', 'Ilocos Sur',
        'Isabela', 'Kalinga', 'La Union', 'Laguna', 'Marinduque', 'Masbate', 'Mountain Province', 'Nueva Ecija',
        'Nueva Vizcaya', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Pampanga', 'Pangasinan', 'Quezon',
        'Quirino', 'Rizal', 'Romblon', 'Sorsogon', 'Tarlac', 'Zambales', 'Aklan', 'Antique', 'Biliran', 'Bohol',
        'Capiz', 'Cebu', 'Eastern Samar', 'Guimaras', 'Iloilo', 'Leyte', 'Negros Occidental', 'Negros Oriental',
        'Northern Samar', 'Samar', 'Siquijor', 'Southern Leyte', 'Agusan del Norte', 'Agusan del Sur', 'Basilan',
        'Bukidnon', 'Camiguin', 'Cotabato', 'Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao City',
        'Davao Occidental', 'Davao Oriental', 'Dinagat Islands', 'Lanao del Norte', 'Lanao del Sur',
        'Maguindanao del Norte', 'Maguindanao del Sur', 'Misamis Occidental', 'Misamis Oriental', 'Sarangani',
        'South Cotabato', 'Sultan Kudarat', 'Sulu', 'Surigao del Norte', 'Surigao del Sur', 'Tawi-Tawi',
        'Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'
    ];

    public function index(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'string', 'in:all,active,inactive'],
        ]);

        $query = Area::query()->withCount('milestones')->with('prices', 'provinces');

        if (! empty($validated['search'])) {
            $search = trim($validated['search']);

            $query->where(function ($areaQuery) use ($search) {
                $areaQuery
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if (! empty($validated['is_active']) && $validated['is_active'] !== 'all') {
            $query->where('is_active', $validated['is_active'] === 'active');
        }

        $provinces = \App\Models\Province::orderBy('name')->get();
        if ($provinces->isEmpty()) {
            foreach (self::DEFAULT_PROVINCES as $provinceName) {
                \App\Models\Province::firstOrCreate(
                    ['name' => $provinceName],
                    ['is_active' => true, 'area_id' => null]
                );
            }
            $provinces = \App\Models\Province::orderBy('name')->get();
        }

        return Inertia::render('admin/Areas/Index', [
            'areas' => $query->orderBy('name')->get(),
            'provinces' => $provinces,
            'filters' => $request->only(['search', 'is_active']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:areas,name',
            'description' => 'nullable|string',
            'door_to_door_fee' => 'nullable|numeric|min:0',
            'is_active' => 'boolean',
            'province_ids' => 'nullable|array',
            'province_ids.*' => [
                'exists:provinces,id',
                function ($attribute, $value, $fail) {
                    $province = \App\Models\Province::find($value);
                    if ($province && $province->area_id !== null) {
                        $fail('The province ' . $province->name . ' is already assigned to another area.');
                    }
                }
            ],
        ]);

        $area = Area::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'door_to_door_fee' => $validated['door_to_door_fee'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        if (isset($validated['province_ids'])) {
            \App\Models\Province::whereIn('id', $validated['province_ids'])->update(['area_id' => $area->id]);
        }
        app(\App\Services\ReferenceDataService::class)->forgetBookingReferenceData();

        return redirect()->route('admin.areas.index')->with('success', 'Area created successfully.');
    }

    public function update(Request $request, Area $area)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:areas,name,'.$area->id,
            'description' => 'nullable|string',
            'door_to_door_fee' => 'nullable|numeric|min:0',
            'is_active' => 'boolean',
            'province_ids' => 'nullable|array',
            'province_ids.*' => [
                'exists:provinces,id',
                function ($attribute, $value, $fail) use ($area) {
                    $province = \App\Models\Province::find($value);
                    if ($province && $province->area_id !== null && $province->area_id !== $area->id) {
                        $fail('The province ' . $province->name . ' is already assigned to another area.');
                    }
                }
            ],
        ]);

        $area->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'door_to_door_fee' => $validated['door_to_door_fee'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
        ]);
        
        // Remove area_id from provinces that were previously assigned to this area but are no longer
        if (isset($validated['province_ids'])) {
            \App\Models\Province::where('area_id', $area->id)
                ->whereNotIn('id', $validated['province_ids'])
                ->update(['area_id' => null]);
                
            \App\Models\Province::whereIn('id', $validated['province_ids'])->update(['area_id' => $area->id]);
        } else {
            \App\Models\Province::where('area_id', $area->id)->update(['area_id' => null]);
        }

        app(\App\Services\ReferenceDataService::class)->forgetBookingReferenceData();

        return redirect()->route('admin.areas.index')->with('success', 'Area updated successfully.');
    }



    public function destroy(Area $area)
    {
        if (request()->user()?->role !== \App\Enums\Role::SuperAdmin) {
            abort(403, 'Unauthorized');
        }

        // Domain Policy: Block deletion if linked to active pricing or bookings
        if ($area->prices()->exists()) {
            return redirect()->route('admin.areas.index')->with('error', 'Cannot delete Area because it is linked to existing BoxPrice lookup tables. We recommend deactivation instead.');
        }

        if ($area->recipients()->exists()) {
            return redirect()->route('admin.areas.index')->with('error', 'Cannot delete Area because it is linked to active bookings. We recommend deactivation instead.');
        }

        // Clean up relations
        $area->milestones()->delete();
        \App\Models\Province::where('area_id', $area->id)->update(['area_id' => null]);

        $area->delete();

        app(\App\Services\ReferenceDataService::class)->forgetBookingReferenceData();

        return redirect()->route('admin.areas.index')->with('success', 'Area deleted successfully.');
    }
}
