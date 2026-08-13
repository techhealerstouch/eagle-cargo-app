<?php

namespace App\Http\Controllers;

use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\AreaMilestone;
use App\Models\Box;
use App\Models\Runsheet;
use App\Repositories\Contracts\BoxRepositoryInterface;
use App\Services\RunsheetService;
use App\Services\TrackingStepService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class CourierController extends Controller
{
    public function __construct(
        private readonly BoxRepositoryInterface $boxRepo,
        private readonly RunsheetService $runsheetService,
        private readonly TrackingStepService $trackingStepService,
    ) {}

    public function dashboard()
    {
        $user = Auth::user();
        $role = $this->resolveAuthenticatedRole();

        $runsheets = Runsheet::with(['boxes.recipient.area', 'boxes.booking.sender'])
            ->where(function ($query) use ($user, $role) {
                $this->applyRunsheetAssigneeScope($query, (int) $user->id, $role);
            })
            ->whereIn('status', [RunsheetStatus::Assigned, RunsheetStatus::InProgress])
            ->orderBy('status', 'asc')
            ->orderBy('scheduled_date', 'asc')
            ->get();

        $stats = $this->boxRepo->getStatsByCourier($user->id);

        $stats['activeRunsheets'] = $runsheets->count();

        return Inertia::render('courier/Dashboard', [
            'runsheets' => $runsheets,
            'stats' => $stats,
        ]);
    }

    public function runsheetIndex()
    {
        $user = Auth::user();
        $role = $this->resolveAuthenticatedRole();

        $runsheets = Runsheet::with(['boxes.recipient.area', 'boxes.booking.sender'])
            ->where(function ($query) use ($user, $role) {
                $this->applyRunsheetAssigneeScope($query, (int) $user->id, $role);
            })
            ->orderBy('scheduled_date', 'desc')
            ->get();

        return Inertia::render('courier/Runsheets', [
            'runsheets' => $runsheets,
        ]);
    }

    public function runsheetShow(Runsheet $runsheet)
    {
        if (! $this->isAssignedToRunsheet($runsheet)) {
            abort(403);
        }

        $runsheet->load(['boxes.recipient.area', 'boxes.booking.sender']);

        return Inertia::render('courier/RunsheetDetail', [
            'runsheet' => $runsheet,
        ]);
    }

    public function scanPage()
    {
        return Inertia::render('courier/ScanBox');
    }

    public function showBox(Box $box)
    {
        $canView = $this->canAccessBox($box, true);
        if (! $canView) {
            abort(403);
        }

        $canUpdate = $this->canAccessBox($box, false);

        $box = $this->boxRepo->loadBoxDetails($box);

        // Fetch only courier steps that are valid transitions from the box's current status
        $courierSteps = $this->getTransitionableCourierSteps($box);

        return Inertia::render('courier/BoxDetail', [
            'box' => $box,
            'canUpdate' => $canUpdate,
            'trackingSteps' => $courierSteps,
        ]);
    }

    public function scanBox(Request $request)
    {
        $request->validate([
            'tracking_number' => 'required|string',
        ]);

        $box = $this->boxRepo->findByIdentifier($request->tracking_number);

        if (! $box) {
            return back()->withErrors(['tracking_number' => 'Box not found with that serial or tracking number.']);
        }

        if (! $this->canAccessBox($box, true)) {
            // Check if user has an active runsheet - if not, deny access completely (403)
            $userId = Auth::id();
            $hasActiveRunsheet = Runsheet::where('type', RunsheetType::Delivery->value)
                ->where('courier_id', $userId)
                ->whereIn('status', [RunsheetStatus::Assigned->value, RunsheetStatus::InProgress->value])
                ->exists();

            if (! $hasActiveRunsheet) {
                abort(403, 'You do not have an active delivery runsheet to claim this box. Please ask an admin to assign one to you.');
            }

            // User has active runsheet but box isn't attached - try to claim
            $claimResult = $this->tryAutoClaimBox($box);
            if ($claimResult !== true) {
                abort(403, $claimResult);
            }
        }

        // Auto-start runsheet upon scan
        $this->autoStartRunsheetForCourier($box);

        return redirect()->route('courier.box.show', ['box' => $box->tracking_number]);
    }

    private function autoStartRunsheetForCourier(Box $box): void
    {
        $userId = Auth::id();
        if (! $userId) {
            return;
        }

        $activeRunsheet = Runsheet::where('type', RunsheetType::Delivery->value)
            ->where('courier_id', $userId)
            ->where('status', RunsheetStatus::Assigned->value)
            ->whereHas('boxes', function ($query) use ($box) {
                $query->where('boxes.id', $box->id);
            })
            ->first();

        if ($activeRunsheet) {
            try {
                $this->runsheetService->transition($activeRunsheet, RunsheetStatus::InProgress);
            } catch (\Exception $e) {
                // Silently ignore if it cannot transition
            }
        }
    }

    private function tryAutoClaimBox(Box $box): bool|string
    {
        $userId = Auth::id();
        if (! $userId) {
            return 'You must be logged in.';
        }

        $activeRunsheet = Runsheet::where('type', RunsheetType::Delivery->value)
            ->where('courier_id', $userId)
            ->whereIn('status', [RunsheetStatus::Assigned->value, RunsheetStatus::InProgress->value])
            ->first();

        if (! $activeRunsheet) {
            return 'You do not have an active delivery runsheet to claim this box. Please ask an admin to assign one to you.';
        }

        // Verify the box's recipient area is compatible with the runsheet's existing boxes.
        $box->loadMissing('recipient:id,area_id');
        $boxAreaId = $box->recipient?->area_id;
        if ($boxAreaId) {
            $existingAreaIds = $activeRunsheet->boxes()
                ->with('recipient:id,area_id')
                ->get()
                ->map(fn (Box $runsheetBox) => $runsheetBox->recipient?->area_id)
                ->filter()
                ->unique()
                ->values();

            if ($existingAreaIds->isNotEmpty() && ! $existingAreaIds->contains($boxAreaId)) {
                return 'This box is destined for a different delivery area than your current runsheet. Please ask an admin to assign it to the correct courier.';
            }
        }

        try {
            $this->runsheetService->attachBoxes($activeRunsheet, [$box->id]);

            return true;
        } catch (\Exception $e) {
            return $e->getMessage();
        }
    }

    public function startRunsheet(Runsheet $runsheet)
    {
        if (! $this->isAssignedToRunsheet($runsheet)) {
            abort(403);
        }

        try {
            $this->runsheetService->transition($runsheet, RunsheetStatus::InProgress);
        } catch (\InvalidArgumentException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->back()->with('success', 'Runsheet started.');
    }

    public function completeRunsheet(Runsheet $runsheet)
    {
        if (! $this->isAssignedToRunsheet($runsheet)) {
            abort(403);
        }

        try {
            $this->runsheetService->transition($runsheet, RunsheetStatus::Completed);
        } catch (\InvalidArgumentException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->back()->with('success', 'Runsheet completed.');
    }

    public function updateBoxStatus(Request $request, Box $box)
    {
        if (! $this->canAccessBox($box, false)) {
            abort(403);
        }

        // Fetch only courier steps that are valid transitions from the box's current status
        $courierSteps = $this->getTransitionableCourierSteps($box);
        if (count($courierSteps) === 0 && ! $request->filled('area_milestone_id')) {
            return redirect()->back()->with('error', 'No valid delivery tracking actions are available for this box status.');
        }

        $allowedStepKeys = array_column($courierSteps, 'key');

        $validated = $request->validate([
            'tracking_step_key' => ['required_without:area_milestone_id', 'nullable', 'string', function ($attribute, $value, $fail) use ($allowedStepKeys) {
                if ($value && ! in_array($value, $allowedStepKeys)) {
                    $fail('Couriers cannot update tracking to this status.');
                }
            }],
            'courier_notes' => 'nullable|string',
            'area_milestone_id' => ['nullable', Rule::exists('area_milestones', 'id')],
            'delivery_proof' => ['nullable', 'file', 'mimes:jpeg,jpg,png,pdf', 'max:3072'],
            'signature' => ['nullable', 'string'],
        ]);

        if ($request->input('tracking_step_key') === 'delivered') {
            if (! $request->hasFile('delivery_proof') && ! $box->delivery_proof_path) {
                throw ValidationException::withMessages([
                    'delivery_proof' => 'A photo or PDF of the delivery proof is required to mark this box as Delivered.',
                ]);
            }
        }

        $systemStatus = null;
        $trackingLabel = null;

        if ($request->filled('tracking_step_key')) {
            $stepConfig = collect($courierSteps)->firstWhere('key', $validated['tracking_step_key']);
            $systemStatus = $stepConfig['system_status'] ?? null;
            $trackingLabel = $stepConfig['label'] ?? null;
        }

        // Validate state transition before applying
        if ($systemStatus) {
            $currentStatus = $box->status instanceof BoxStatus
                ? $box->status
                : BoxStatus::tryFrom((string) $box->status);
            $targetStatus = BoxStatus::tryFrom($systemStatus);

            if (! $targetStatus) {
                return redirect()->back()->with('error', 'Selected tracking step has an invalid system status mapping.');
            }

            if ($currentStatus && $currentStatus !== $targetStatus && ! $currentStatus->canTransitionTo($targetStatus)) {
                return redirect()->back()->with('error', "Cannot move box from {$currentStatus->value} to {$targetStatus->value}.");
            }
        }

        $areaMilestoneId = $validated['area_milestone_id'] ?? null;
        if ($areaMilestoneId) {
            $areaId = $box->recipient?->area_id;

            if (! $areaId) {
                return redirect()->back()->with('error', 'This box does not have a recipient area for milestone updates.');
            }

            $isAllowedMilestone = AreaMilestone::query()
                ->whereKey($areaMilestoneId)
                ->where('area_id', $areaId)
                ->exists();

            if (! $isAllowedMilestone) {
                return redirect()->back()->with('error', 'Selected milestone does not belong to this recipient area.');
            }
        }

        $currentStatusValue = $box->status instanceof BoxStatus
            ? $box->status->value
            : (string) $box->status;

        $notes = $validated['courier_notes'];
        if ($trackingLabel) {
            $notes = $notes ? "{$trackingLabel} - {$notes}" : "{$trackingLabel}";
        }

        try {
            $this->boxRepo->updateStatus(
                box: $box,
                status: $systemStatus ?? $currentStatusValue,
                notes: $notes,
                courierId: Auth::id(),
                areaMilestoneId: $areaMilestoneId,
                deliveryProof: $request->file('delivery_proof'),
                signature: $validated['signature'] ?? null,
                trackingStepKey: $validated['tracking_step_key'] ?? null
            );
        } catch (\InvalidArgumentException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        } catch (\Exception $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        // Explicitly auto-start any 'Assigned' delivery runsheet for this courier containing this box
        $this->autoStartRunsheetForCourier($box);

        $this->runsheetService->syncRelatedRunsheets($box);

        return redirect()->back()->with('success', 'Box status updated successfully.');
    }

    private function canAccessBox(Box $box, bool $allowCompletedRunsheets): bool
    {
        $userId = Auth::id();
        if (! $userId) {
            return false;
        }

        $role = $this->resolveAuthenticatedRole();

        return $box->runsheets()
            ->where(function ($query) use ($userId, $role) {
                $this->applyRunsheetAssigneeScope($query, (int) $userId, $role);
            })
            ->when(! $allowCompletedRunsheets, function ($query) {
                $query->whereIn('runsheets.status', RunsheetStatus::activeValues());
            })
            ->exists();
    }

    public function isAssignedToRunsheet(Runsheet $runsheet): bool
    {
        $userId = Auth::id();
        if (! $userId) {
            return false;
        }

        $role = $this->resolveAuthenticatedRole();
        $runsheetType = $runsheet->type instanceof RunsheetType
            ? $runsheet->type
            : RunsheetType::from((string) $runsheet->type);

        return $runsheetType === RunsheetType::Delivery && (int) ($runsheet->courier_id ?? 0) === (int) $userId;
    }

    private function applyRunsheetAssigneeScope($query, int $userId, ?Role $role): void
    {

        $query
            ->where('runsheets.type', RunsheetType::Delivery->value)
            ->where('runsheets.courier_id', $userId);
    }

    /**
     * Return courier-configured tracking steps that are valid transitions from the box's current status.
     */
    private function getTransitionableCourierSteps(Box $box): array
    {
        $allSteps = $this->trackingStepService->getSteps();
        $courierSteps = array_values(array_filter($allSteps, function ($step) {
            return in_array('courier', $step['allowed_roles'] ?? [], true);
        }));

        $currentStatus = $box->status instanceof BoxStatus
            ? $box->status
            : BoxStatus::tryFrom((string) $box->status);

        if (! $currentStatus) {
            return $courierSteps;
        }

        return array_values(array_filter($courierSteps, function ($step) use ($currentStatus) {
            $targetStatus = BoxStatus::tryFrom((string) ($step['system_status'] ?? ''));

            if (! $targetStatus) {
                return false;
            }

            // Allow re-selecting current status (e.g., updating notes/proof on same status)
            if ($currentStatus === $targetStatus) {
                return true;
            }

            return $currentStatus->canTransitionTo($targetStatus);
        }));
    }

    private function resolveAuthenticatedRole(): ?Role
    {
        $role = Auth::user()?->role;
        if ($role instanceof Role) {
            return $role;
        }

        if (is_string($role)) {
            return Role::tryFrom($role);
        }

        return null;
    }
}
