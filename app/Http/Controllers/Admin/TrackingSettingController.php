<?php

namespace App\Http\Controllers\Admin;

use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Services\TrackingStepService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class TrackingSettingController extends Controller
{
    public function __construct(
        private readonly TrackingStepService $trackingStepService,
    ) {}

    /**
     * Display the tracking settings page.
     */
    public function index()
    {
        return Inertia::render('settings/tracking', [
            'steps' => $this->trackingStepService->getSteps(),
        ]);
    }

    /**
     * Update the tracking steps.
     */
    public function update(Request $request)
    {
        $allowedRoles = [
            Role::Picker->value,
            Role::Warehouse->value,
            Role::Courier->value,
            Role::Admin->value,
            Role::SuperAdmin->value,
        ];

        $validated = $request->validate([
            'steps' => 'required|array|min:2',
            'steps.*.key' => 'required|string|max:50',
            'steps.*.label' => 'required|string|max:100',
            'steps.*.phase' => 'required|string|in:Origin,International Transit,Destination',
            'steps.*.icon' => 'required|string|max:30',
            'steps.*.allowed_roles' => 'sometimes|array',
            'steps.*.allowed_roles.*' => ['string', Rule::in($allowedRoles)],
            'steps.*.system_status' => ['required', 'string', Rule::in(array_column(BoxStatus::cases(), 'value'))],
        ]);

        $this->trackingStepService->updateSteps($validated['steps']);

        return back()->with('success', 'Tracking steps updated successfully.');
    }
}
