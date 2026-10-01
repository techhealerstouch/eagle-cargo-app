<?php

namespace App\Http\Controllers;

use App\Enums\Feature;
use App\Enums\Role;
use App\Models\FeatureFlag;
use App\Services\AuditLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DeveloperFeatureController extends Controller
{
    public function index(): Response
    {
        // Ensure all enum-backed features exist in DB as system flags without deleting custom ones
        foreach (Feature::cases() as $feature) {
            $audiences = array_map(function ($aud) {
                return strtolower(str_replace(' ', '_', $aud));
            }, $feature->audiences());

            FeatureFlag::firstOrCreate(
                ['feature_key' => $feature->value],
                [
                    'name' => $feature->name(),
                    'description' => $feature->description(),
                    'status' => 'hidden',
                    'audiences' => $audiences,
                    'is_system' => true,
                    'enabled' => false,
                ]
            );
        }

        $features = FeatureFlag::query()
            ->with('updatedBy')
            ->orderByDesc('is_system')
            ->orderBy('name')
            ->get()
            ->map(function (FeatureFlag $flag) {
                return [
                    'id' => $flag->id,
                    'key' => $flag->feature_key,
                    'name' => $flag->name ?? $flag->feature_key,
                    'description' => $flag->description ?? '',
                    'status' => $flag->status ?? ($flag->enabled ? 'released' : 'hidden'),
                    'audiences' => $flag->audiences ?? [],
                    'maintenance_message' => $flag->maintenance_message,
                    'is_system' => (bool) $flag->is_system,
                    'enabled' => (bool) $flag->enabled,
                    'updated_at' => $flag->updated_at?->toISOString(),
                    'updated_by' => $flag->updatedBy?->only(['id', 'name']),
                ];
            })
            ->values();

        $roles = collect(Role::cases())->map(function (Role $role) {
            return [
                'value' => $role->value,
                'label' => ucwords(str_replace('_', ' ', $role->value)),
            ];
        })->values();

        return Inertia::render('developer/features', [
            'features' => $features,
            'roles' => $roles,
        ]);
    }

    public function store(Request $request, AuditLogService $auditLogService): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'feature_key' => ['required', 'string', 'max:100', 'regex:/^[a-z0-9_]+$/', 'unique:feature_flags,feature_key'],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['required', 'string', 'in:released,hidden,maintenance'],
            'audiences' => ['nullable', 'array'],
            'audiences.*' => ['string'],
            'maintenance_message' => ['nullable', 'string', 'max:1000'],
        ]);

        $status = $validated['status'];
        $enabled = ($status === 'released');

        $flag = FeatureFlag::create([
            'feature_key' => $validated['feature_key'],
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'status' => $status,
            'audiences' => $validated['audiences'] ?? [],
            'maintenance_message' => $validated['maintenance_message'] ?? null,
            'is_system' => false,
            'enabled' => $enabled,
            'updated_by' => $request->user()->id,
        ]);

        $auditLogService->logEvent(
            category: 'feature_access',
            action: 'feature_created',
            description: sprintf('Feature "%s" (%s) was created with status %s.', $flag->name, $flag->feature_key, $flag->status),
            subject: $flag,
            changes: [
                'feature_key' => $flag->feature_key,
                'status' => $flag->status,
                'audiences' => $flag->audiences,
            ],
            user: $request->user(),
        );

        return to_route('developer.features.index')->with('success', sprintf('Feature "%s" created successfully.', $flag->name));
    }

    public function update(Request $request, string $feature, AuditLogService $auditLogService): RedirectResponse
    {
        $flag = FeatureFlag::where('feature_key', $feature)->first();
        $enumFeature = Feature::tryFrom($feature);

        if (! $flag && ! $enumFeature) {
            abort(404);
        }

        if (! $flag && $enumFeature) {
            $audiences = array_map(function ($aud) {
                return strtolower(str_replace(' ', '_', $aud));
            }, $enumFeature->audiences());

            $flag = FeatureFlag::create([
                'feature_key' => $enumFeature->value,
                'name' => $enumFeature->name(),
                'description' => $enumFeature->description(),
                'status' => 'hidden',
                'audiences' => $audiences,
                'is_system' => true,
                'enabled' => false,
                'updated_by' => $request->user()->id,
            ]);
        }

        // Case 1: Simple toggle (no status or name sent)
        if (! $request->has('status') && ! $request->has('name')) {
            $oldStatus = $flag->status ?? ($flag->enabled ? 'released' : 'hidden');
            $newStatus = ($oldStatus === 'released') ? 'hidden' : 'released';
            $oldEnabled = (bool) $flag->enabled;
            $newEnabled = ($newStatus === 'released');

            $flag->forceFill([
                'status' => $newStatus,
                'enabled' => $newEnabled,
                'updated_by' => $request->user()->id,
            ])->save();

            $displayName = $flag->name ?: ($enumFeature?->name() ?? $flag->feature_key);

            $auditLogService->logEvent(
                category: 'feature_access',
                action: $newEnabled ? 'feature_released' : 'feature_hidden',
                description: sprintf('%s was %s.', $displayName, $newEnabled ? 'released' : 'hidden'),
                subject: $flag,
                changes: [
                    'feature_key' => $flag->feature_key,
                    'old_status' => $oldStatus,
                    'new_status' => $newStatus,
                    'old_state' => $oldEnabled,
                    'new_state' => $newEnabled,
                ],
                user: $request->user(),
            );

            return to_route('developer.features.index')->with('success', sprintf('%s is now %s.', $displayName, $newEnabled ? 'released' : 'hidden'));
        }

        // Case 2: Full details update
        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['sometimes', 'required', 'string', 'in:released,hidden,maintenance'],
            'audiences' => ['nullable', 'array'],
            'audiences.*' => ['string'],
            'maintenance_message' => ['nullable', 'string', 'max:1000'],
        ]);

        $oldValues = $flag->only(['name', 'description', 'status', 'audiences', 'maintenance_message', 'enabled']);

        if (isset($validated['name'])) {
            $flag->name = $validated['name'];
        }
        if (array_key_exists('description', $validated)) {
            $flag->description = $validated['description'];
        }
        if (isset($validated['status'])) {
            $flag->status = $validated['status'];
            $flag->enabled = ($validated['status'] === 'released');
        }
        if (array_key_exists('audiences', $validated)) {
            $flag->audiences = $validated['audiences'] ?? [];
        }
        if (array_key_exists('maintenance_message', $validated)) {
            $flag->maintenance_message = $validated['maintenance_message'];
        }

        $flag->updated_by = $request->user()->id;
        $flag->save();

        $auditLogService->logEvent(
            category: 'feature_access',
            action: 'feature_updated',
            description: sprintf('Feature "%s" (%s) was updated.', $flag->name, $flag->feature_key),
            subject: $flag,
            changes: [
                'feature_key' => $flag->feature_key,
                'old' => $oldValues,
                'new' => $flag->only(['name', 'description', 'status', 'audiences', 'maintenance_message', 'enabled']),
            ],
            user: $request->user(),
        );

        return to_route('developer.features.index')->with('success', sprintf('Feature "%s" updated successfully.', $flag->name));
    }

    public function destroy(string $feature, AuditLogService $auditLogService): RedirectResponse
    {
        $flag = FeatureFlag::where('feature_key', $feature)->firstOrFail();

        if ($flag->is_system) {
            return to_route('developer.features.index')->with('error', 'System feature flags cannot be deleted.');
        }

        $featureName = $flag->name;
        $featureKey = $flag->feature_key;

        $flag->delete();

        $auditLogService->logEvent(
            category: 'feature_access',
            action: 'feature_deleted',
            description: sprintf('Feature "%s" (%s) was deleted.', $featureName, $featureKey),
            subject: null,
            changes: [
                'feature_key' => $featureKey,
                'name' => $featureName,
            ],
            user: request()->user(),
        );

        return to_route('developer.features.index')->with('success', sprintf('Feature "%s" was deleted successfully.', $featureName));
    }
}
