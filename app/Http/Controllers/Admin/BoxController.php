<?php

namespace App\Http\Controllers\Admin;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreBoxRequest;
use App\Http\Requests\Admin\UpdateBoxRequest;
use App\Models\Area;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Repositories\Contracts\BoxRepositoryInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class BoxController extends Controller
{
    public function index(Request $request)
    {
        $query = Box::with(['booking.sender', 'recipient', 'boxType', 'batch', 'latestUpdate']);

        if ($request->boolean('trashed') && Auth::user()?->role === Role::SuperAdmin) {
            $query = Box::onlyTrashed()->with(['booking.sender', 'recipient', 'boxType', 'batch', 'latestUpdate']);
        }

        $query = $this->applyFilters($query, $request);

        $boxes = $query->paginate(10)->withQueryString();

        // Batch-determine which boxes are eligible for admin status updates
        if ($boxes->count() > 0) {
            $boxIds = $boxes->pluck('id')->toArray();
            $eligibleIds = Box::whereIn('id', $boxIds)
                ->where('status', '!=', BoxStatus::Delivered->value)
                ->pluck('id')
                ->toArray();

            $eligibleSet = array_flip($eligibleIds);
            $boxes->each(function ($box) use ($eligibleSet) {
                $box->is_eligible_for_update = isset($eligibleSet[$box->id]);
            });
        }

        $activeBatches = Batch::whereIn('status', [
            BatchStatus::Open,
            BatchStatus::Loading,
        ])->latest()->get();

        $areas = Area::where('is_active', true)->orderBy('name')->get(['id', 'name']);

        return Inertia::render('admin/boxes/index', [
            'boxes' => $boxes,
            'filters' => $request->only(['search', 'status', 'area_id', 'sort', 'direction', 'trashed']),
            'activeBatches' => $activeBatches,
            'areas' => $areas,
        ]);
    }

    public function create()
    {
        $bookings = Booking::with('sender')->latest()->get();

        return Inertia::render('admin/boxes/create', [
            'bookings' => $bookings,
        ]);
    }

    public function store(StoreBoxRequest $request)
    {
        Box::create($request->validated());

        return redirect()->route('admin.boxes.index')->with('success', 'Box registered successfully.');
    }

    public function show(Box $box)
    {
        return Inertia::render('admin/boxes/show', [
            'box' => $box->load(['booking.sender', 'booking.boxes', 'recipient', 'boxType', 'trackingLogs']),
        ]);
    }

    public function edit(Box $box)
    {
        $bookings = Booking::with('sender')->latest()->get();

        return Inertia::render('admin/boxes/edit', [
            'box' => $box->load('booking.sender'),
            'bookings' => $bookings,
        ]);
    }

    public function update(UpdateBoxRequest $request, Box $box, BoxRepositoryInterface $boxRepo)
    {
        $validated = $request->validated();
        $overrideReason = $validated['admin_delivery_override_reason'] ?? null;
        unset($validated['admin_delivery_override_reason']);

        if (!$request->boolean('update_eta')) {
            unset($validated['eta_date']);
            unset($validated['eta_message']);
        }
        if (!$request->boolean('update_estimate_delivery')) {
            unset($validated['estimate_delivery_date']);
            unset($validated['estimate_delivery_message']);
        }
        unset($validated['update_eta']);
        unset($validated['update_estimate_delivery']);

        $newStatus = $validated['status'] ?? null;
        $trackingStepKey = $validated['tracking_step_key'] ?? null;
        // Do not unset tracking_step_key so it gets saved to the boxes table

        if ($newStatus && ($box->status instanceof BoxStatus ? $box->status->value : $box->status) !== $newStatus) {
            if ($newStatus === BoxStatus::Delivered->value && $this->requiresDeliveryOverride($box) && blank($overrideReason)) {
                throw ValidationException::withMessages([
                    'admin_delivery_override_reason' => 'An admin override reason is required when marking a box Delivered without proof and signature.',
                ]);
            }

            unset($validated['status']);
            $box->update($validated);

            $boxRepo->updateStatus(
                $box,
                $newStatus,
                'Status updated by Admin',
                Auth::id(),
                deliveryOverrideReason: $overrideReason,
                bypassValidation: true,
                trackingStepKey: $trackingStepKey
            );
        } else {
            $box->update($validated);
        }

        if (array_key_exists('eta_date', $validated) || array_key_exists('eta_message', $validated) || array_key_exists('estimate_delivery_date', $validated) || array_key_exists('estimate_delivery_message', $validated)) {
            app(\App\Services\TrackingCacheService::class)->forgetBox($box);
        }

        return redirect()->route('admin.boxes.index')->with('success', 'Box updated successfully.');
    }

    public function bulkUpdateStatus(Request $request, BoxRepositoryInterface $boxRepo)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'ids.*' => 'integer|exists:boxes,id',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
            'status' => 'required|string', // The new status to set
            'tracking_step_key' => 'nullable|string',
            'filter_status' => 'nullable|string', // The status filter applied to the view
            'area_id' => 'nullable|exists:areas,id',
            'courier_notes' => 'nullable|string|max:2000',
            'update_eta' => 'nullable|boolean',
            'eta_date' => 'nullable|date',
            'eta_message' => 'nullable|string|max:255',
        ]);

        if ($validated['status'] === BoxStatus::Delivered->value) {
            return redirect()->route('admin.boxes.index')
                ->with('error', 'Bulk Delivered updates require per-box proof/signature review or an admin override reason.');
        }

        $requestForFilters = clone $request;
        if ($request->has('filter_status')) {
            $requestForFilters->merge(['status' => $request->filter_status]);
        } else {
            // Avoid filtering by the new status we are trying to set if 'status' was used for both
            $requestForFilters->request->remove('status');
        }

        if ($request->boolean('select_all')) {
            $query = Box::query();
            $query = $this->applyFilters($query, $requestForFilters);
            $boxes = $query->get();
        } else {
            $boxes = Box::whereIn('id', $validated['ids'])->get();
        }

        $updated = 0;
        $userId = Auth::id();
        $trackingStepKey = $validated['tracking_step_key'] ?? null;

        $updates = [];
        if ($request->boolean('update_eta')) {
            $updates['eta_date'] = $validated['eta_date'] ?? null;
            $updates['eta_message'] = $validated['eta_message'] ?? null;
        }

        foreach ($boxes as $box) {
            try {
                if (!empty($updates)) {
                    $box->update($updates);
                    app(\App\Services\TrackingCacheService::class)->forgetBox($box);
                }

                $boxRepo->updateStatus(
                    $box,
                    $validated['status'],
                    ($validated['courier_notes'] ?? null) ?: 'Status updated by Admin',
                    $userId,
                    bypassValidation: true,
                    trackingStepKey: $trackingStepKey
                );
                $updated++;
            } catch (\Exception $e) {
                // skip invalid transitions if any
            }
        }

        return redirect()->route('admin.boxes.index')->with('success', "{$updated} boxes status updated successfully.");
    }

    public function bulkAssignToBatch(Request $request, BoxRepositoryInterface $boxRepo)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
            'status' => 'nullable|string',
            'area_id' => 'nullable|exists:areas,id',
            'batch_id' => 'required|exists:batches,id',
        ]);

        if ($request->boolean('select_all')) {
            $query = Box::query();
            $query = $this->applyFilters($query, $request);
            $boxes = $query->get();
        } else {
            $boxes = Box::whereIn('id', $validated['ids'])->get();
        }

        $failedBoxes = [];
        $eligibleBoxes = [];
        foreach ($boxes as $box) {
            if ($box->booking->status === BookingStatus::Cancelled) {
                $failedBoxes[] = "{$box->tracking_number} (Cancelled)";
            } elseif (!in_array($box->booking->payment_status, [PaymentStatus::Paid, PaymentStatus::CashCollected], true)) {
                $failedBoxes[] = "{$box->tracking_number} (Not Paid)";
            } elseif ($box->booking->needsDeclaration()) {
                $failedBoxes[] = "{$box->tracking_number} (Missing Declaration)";
            } elseif ($box->batch_id !== null) {
                $failedBoxes[] = "{$box->tracking_number} (Already in a Batch)";
            } else {
                $eligibleBoxes[] = $box;
            }
        }

        if (count($eligibleBoxes) === 0) {
            $msg = "Cannot assign boxes to batch. All selected boxes are ineligible: " . implode(', ', $failedBoxes);
            return redirect()->back()->with('error', $msg);
        }

        $count = 0;
        $userId = Auth::id();
        $batch = Batch::find($validated['batch_id']);

        foreach ($eligibleBoxes as $box) {
            $box->update(['batch_id' => $validated['batch_id']]);
            $boxRepo->updateStatus(
                $box,
                BoxStatus::InTransit->value,
                "Assigned to batch: {$batch->batch_number}",
                $userId
            );
            $count++;
        }

        $msg = "{$count} boxes assigned to batch successfully.";
        if (count($failedBoxes) > 0) {
            $msg .= " The following boxes were skipped: " . implode(', ', $failedBoxes);
            return redirect()->route('admin.boxes.index')->with('warning', $msg);
        }

        return redirect()->route('admin.boxes.index')->with('success', $msg);
    }

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
            'status' => 'nullable|string',
            'area_id' => 'nullable|exists:areas,id',
        ]);

        if ($request->boolean('select_all')) {
            $query = Box::query();
            $query = $this->applyFilters($query, $request);
            $boxes = $query->get();
        } else {
            $boxes = Box::whereIn('id', $validated['ids'])->get();
        }

        $deleted = 0;
        $skipped = 0;

        foreach ($boxes as $box) {
            $status = $box->status instanceof BoxStatus ? $box->status->value : $box->status;
            if (in_array($status, [BoxStatus::Pending->value, BoxStatus::Cancelled->value], true)) {
                $box->delete();
                $deleted++;
            } else {
                $skipped++;
            }
        }

        $message = "{$deleted} boxes deleted successfully.";
        if ($skipped > 0) {
            $message .= " {$skipped} boxes skipped because they are not pending or cancelled.";
            return redirect()->route('admin.boxes.index')->with('warning', $message);
        }

        return redirect()->route('admin.boxes.index')->with('success', $message);
    }

    public function updateStatus(Request $request, Box $box, BoxRepositoryInterface $boxRepo)
    {
        if (! $box->isEligibleForAdminStatusUpdate()) {
            return redirect()->back()->with('error', 'This box cannot be updated because it has already been delivered.');
        }

        $validated = $request->validate([
            'status' => ['required', 'string', function ($attribute, $value, $fail) {
                if (! BoxStatus::tryFrom($value)) {
                    $fail("Invalid box status: {$value}");
                }
            }],
            'tracking_step_key' => 'nullable|string',
            'courier_notes' => 'nullable|string|max:2000',
            'admin_delivery_override_reason' => 'nullable|string|min:10|max:1000',
            'delivery_proof' => ['nullable', 'file', 'mimes:jpeg,jpg,png,pdf', 'max:5120'],
            'update_eta' => 'nullable|boolean',
            'eta_date' => 'nullable|date',
            'eta_message' => 'nullable|string|max:255',
            'update_estimate_delivery' => 'nullable|boolean',
            'estimate_delivery_date' => 'nullable|date',
            'estimate_delivery_message' => 'nullable|string|max:255',
        ]);

        $newStatus = $validated['status'];
        $trackingStepKey = $validated['tracking_step_key'] ?? null;
        $overrideReason = $validated['admin_delivery_override_reason'] ?? null;

        // Proof is required only for delivered and collected statuses
        $proofRequiredStatuses = [BoxStatus::Delivered->value, BoxStatus::Collected->value];
        if (in_array($newStatus, $proofRequiredStatuses) && ! $request->hasFile('delivery_proof') && blank($box->delivery_proof_path)) {
            throw ValidationException::withMessages([
                'delivery_proof' => 'A proof photo is required when marking a box as '.ucfirst(str_replace('_', ' ', $newStatus)).'.',
            ]);
        }

        $updates = [];
        if ($request->boolean('update_eta')) {
            $updates['eta_date'] = $validated['eta_date'] ?? null;
            $updates['eta_message'] = $validated['eta_message'] ?? null;
        }
        if ($request->boolean('update_estimate_delivery')) {
            $updates['estimate_delivery_date'] = $validated['estimate_delivery_date'] ?? null;
            $updates['estimate_delivery_message'] = $validated['estimate_delivery_message'] ?? null;
        }

        if (!empty($updates)) {
            $box->update($updates);
            app(\App\Services\TrackingCacheService::class)->forgetBox($box);
        }

        try {
            $boxRepo->updateStatus(
                $box,
                $newStatus,
                ($validated['courier_notes'] ?? null) ?: 'Status updated by Admin',
                Auth::id(),
                deliveryProof: $request->file('delivery_proof'),
                deliveryOverrideReason: $overrideReason,
                trackingStepKey: $trackingStepKey
            );
        } catch (\RuntimeException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        } catch (\InvalidArgumentException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->back()->with('success', 'Box status updated successfully.');
    }

    public function destroy(Box $box)
    {
        $status = $box->status instanceof BoxStatus ? $box->status->value : $box->status;
        $canDelete = in_array($status, [BoxStatus::Pending->value, BoxStatus::Cancelled->value], true);

        if (Auth::user()?->role === Role::SuperAdmin) {
            $canDelete = true;
        }

        if (! $canDelete) {
            return back()->with('error', 'Cannot delete a box unless its status is pending or cancelled.');
        }

        $box->delete();

        return redirect()->route('admin.boxes.index')->with('success', 'Box archived successfully.');
    }

    public function restore($id)
    {
        if (Auth::user()?->role !== Role::SuperAdmin) {
            abort(403, 'Unauthorized');
        }

        $box = Box::withTrashed()->findOrFail($id);
        $box->restore();

        return redirect()->back()->with('success', 'Box restored successfully.');
    }

    private function applyFilters($query, Request $request)
    {
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($qq) use ($search) {
                $qq->where('tracking_number', 'like', "%{$search}%")
                    ->orWhere('serial_number', 'like', "%{$search}%")
                    ->orWhereHas('booking', function ($bq) use ($search) {
                        $bq->where('reference_number', 'like', "%{$search}%")
                            ->orWhereHas('sender', function ($sq) use ($search) {
                                $sq->where('first_name', 'like', "%{$search}%")
                                    ->orWhere('last_name', 'like', "%{$search}%")
                                    ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"]);
                            });
                    })
                    ->orWhereHas('recipient', function ($rq) use ($search) {
                        $rq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('area_id')) {
            $query->whereHas('recipient', function ($rq) use ($request) {
                $rq->where('area_id', $request->area_id);
            });
        }

        if ($request->filled('payment_status')) {
            $query->whereHas('booking', function ($bq) use ($request) {
                $bq->where('payment_status', $request->payment_status);
            });
        }

        if ($request->filled('declaration_form_status')) {
            $query->whereHas('booking', function ($bq) use ($request) {
                if ($request->declaration_form_status === 'submitted') {
                    $bq->whereIn('declaration_form_status', ['submitted_online', 'physical_copy_received']);
                } else {
                    $bq->where('declaration_form_status', $request->declaration_form_status);
                }
            });
        }

        $sortableColumns = ['tracking_number', 'serial_number', 'status', 'created_at'];
        $sort = in_array($request->sort, $sortableColumns) ? $request->sort : 'created_at';
        $direction = in_array($request->direction, ['asc', 'desc']) ? $request->direction : 'desc';

        return $query->orderBy($sort, $direction)->orderBy('id', 'desc');
    }

    private function requiresDeliveryOverride(Box $box): bool
    {
        return blank($box->delivery_proof_path);
    }
}
