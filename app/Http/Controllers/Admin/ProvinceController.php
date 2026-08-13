<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Province;
use App\Models\Area;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProvinceController extends Controller
{
    public function index(Request $request)
    {
        $query = Province::with('area')->orderBy('name');

        if ($request->filled('search')) {
            $search = strtolower($request->search);
            $query->whereRaw('LOWER(name) like ?', ["%{$search}%"]);
        }

        if ($request->filled('area_id')) {
            if ($request->area_id === 'unassigned') {
                $query->whereNull('area_id');
            } else {
                $query->where('area_id', $request->area_id);
            }
        }

        $provinces = $query->paginate(50)->withQueryString();
        $areas = Area::orderBy('name')->get(['id', 'name']);

        return Inertia::render('admin/Provinces/Index', [
            'provinces' => $provinces,
            'areas' => $areas,
            'filters' => $request->only('search', 'area_id'),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:provinces,name'],
            'area_id' => ['nullable', 'exists:areas,id'],
        ]);

        $province = Province::create([
            'name' => trim($validated['name']),
            'area_id' => $validated['area_id'] ?? null,
            'is_active' => true,
        ]);

        app(\App\Services\ReferenceDataService::class)->forgetBookingReferenceData();

        return back()->with('success', "Province '{$province->name}' created successfully.");
    }

    public function update(Request $request, Province $province)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:provinces,name,' . $province->id],
            'area_id' => ['nullable', 'exists:areas,id'],
            'is_active' => ['boolean'],
        ]);

        $province->update([
            'name' => trim($validated['name']),
            'area_id' => $validated['area_id'] ?? null,
            'is_active' => $validated['is_active'] ?? $province->is_active,
        ]);

        app(\App\Services\ReferenceDataService::class)->forgetBookingReferenceData();

        return back()->with('success', "Province '{$province->name}' updated successfully.");
    }

    public function destroy(Province $province)
    {
        $name = $province->name;
        $province->delete();

        app(\App\Services\ReferenceDataService::class)->forgetBookingReferenceData();

        return back()->with('success', "Province '{$name}' deleted successfully.");
    }
}
