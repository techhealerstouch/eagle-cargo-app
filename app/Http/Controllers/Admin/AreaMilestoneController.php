<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Area;
use App\Models\AreaMilestone;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class AreaMilestoneController extends Controller
{
    public function index(Area $area)
    {
        return Inertia::render('admin/AreaMilestones/Index', [
            'area' => $area,
            'milestones' => $area->milestones()->orderBy('sequence_order')->get(),
        ]);
    }

    public function store(Request $request, Area $area)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'location' => 'nullable|string',
            'sequence_order' => 'nullable|integer',
            'is_final_delivery' => 'boolean',
            'is_warehouse_handoff' => 'boolean',
        ]);

        $validated['location'] = $validated['location'] ?? $validated['description'] ?? null;
        unset($validated['description']);

        $validated['sequence_order'] ??= ((int) $area->milestones()->max('sequence_order')) + 1;

        if (($validated['is_warehouse_handoff'] ?? false) && $area->milestones()->where('is_warehouse_handoff', true)->exists()) {
            throw ValidationException::withMessages([
                'is_warehouse_handoff' => 'Only one warehouse handoff milestone is allowed per area.',
            ]);
        }

        $area->milestones()->create($validated);

        return redirect()->route('admin.areas.milestones.index', $area)->with('success', 'Milestone added successfully.');
    }

    public function update(Request $request, AreaMilestone $milestone)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'location' => 'nullable|string',
            'sequence_order' => 'required|integer',
            'is_final_delivery' => 'boolean',
            'is_warehouse_handoff' => 'boolean',
        ]);

        if (($validated['is_warehouse_handoff'] ?? false)) {
            $conflictingMilestoneExists = AreaMilestone::query()
                ->where('area_id', $milestone->area_id)
                ->where('is_warehouse_handoff', true)
                ->where('id', '!=', $milestone->id)
                ->exists();

            if ($conflictingMilestoneExists) {
                throw ValidationException::withMessages([
                    'is_warehouse_handoff' => 'Only one warehouse handoff milestone is allowed per area.',
                ]);
            }
        }

        $milestone->update($validated);

        return back()->with('success', 'Milestone updated successfully.');
    }

    public function destroy(AreaMilestone $milestone)
    {
        $milestone->delete();

        return back()->with('success', 'Milestone deleted successfully.');
    }
}
