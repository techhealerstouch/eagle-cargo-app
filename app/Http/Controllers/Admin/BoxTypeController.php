<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BoxType;
use Illuminate\Http\Request;
use Inertia\Inertia;

class BoxTypeController extends Controller
{
    protected const DEFAULT_BOX_TYPES = [
        ['name' => 'Jumbo', 'dimensions' => '24x24x24'],
        ['name' => 'Large', 'dimensions' => '20x20x20'],
        ['name' => 'Medium', 'dimensions' => '18x18x18'],
        ['name' => 'Custom Box (CBM)', 'dimensions' => null],
    ];

    public function index(Request $request)
    {
        app(\App\Services\ReferenceDataService::class)->ensureCustomBoxCbmRate();

        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'string', 'in:all,active,inactive'],
        ]);

        $query = BoxType::query();

        if (! empty($validated['search'])) {
            $search = trim($validated['search']);

            $query->where(function ($boxTypeQuery) use ($search) {
                $boxTypeQuery
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhere('dimensions', 'like', "%{$search}%");
            });
        }

        if (! empty($validated['is_active']) && $validated['is_active'] !== 'all') {
            $query->where('is_active', $validated['is_active'] === 'active');
        }

        $boxTypes = $query->orderBy('name')->get();

        if ($boxTypes->isEmpty() && empty($validated['search']) && empty($validated['is_active'])) {
            foreach (self::DEFAULT_BOX_TYPES as $bt) {
                BoxType::firstOrCreate(['name' => $bt['name']], ['dimensions' => $bt['dimensions'], 'is_active' => true]);
            }
            $boxTypes = BoxType::orderBy('name')->get();
        }

        return Inertia::render('admin/BoxTypes/Index', [
            'boxTypes' => $boxTypes,
            'filters' => $request->only(['search', 'is_active']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'dimensions' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        BoxType::create($validated);

        app(\App\Services\ReferenceDataService::class)->forgetBookingReferenceData();

        return redirect()->route('admin.box-types.index')->with('success', 'Box Type created successfully.');
    }

    public function update(Request $request, BoxType $boxType)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'dimensions' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        $boxType->update($validated);

        app(\App\Services\ReferenceDataService::class)->forgetBookingReferenceData();

        return redirect()->route('admin.box-types.index')->with('success', 'Box Type updated successfully.');
    }

    public function destroy(BoxType $boxType)
    {
        $boxType->delete();

        app(\App\Services\ReferenceDataService::class)->forgetBookingReferenceData();

        return redirect()->route('admin.box-types.index')->with('success', 'Box Type soft-deleted successfully.');
    }
}
