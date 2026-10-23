<?php

namespace App\Http\Controllers\Admin;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Exports\BoxesExport;
use App\Http\Controllers\Controller;
use App\Services\DeveloperAccess;
use App\Http\Requests\Admin\StoreBoxRequest;
use App\Http\Requests\Admin\UpdateBoxRequest;
use App\Imports\BoxesImport;
use App\Models\Area;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Repositories\Contracts\BoxRepositoryInterface;
use App\Services\AuditLogService;
use App\Services\BatchService;
use App\Services\TrackingCacheService;
use App\Services\TrackingStepService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class BoxController extends Controller
{
    public function index(Request $request)
    {
        $query = Box::with(['booking.sender', 'recipient', 'boxType', 'batch', 'latestUpdate']);

        if ($request->boolean('trashed') && app(DeveloperAccess::class)->isDeveloperOrSuperAdmin(Auth::user())) {
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

        $filterBatches = Batch::latest()->get(['id', 'batch_number']);

        return Inertia::render('admin/boxes/index', [
            'boxes' => $boxes,
            'filters' => $request->only(['search', 'status', 'area_id', 'batch_id', 'sort', 'direction', 'trashed']),
            'activeBatches' => $activeBatches,
            'filterBatches' => $filterBatches,
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

        return redirect($this->adminReturnUrl('admin.boxes.index'))->with('success', 'Box registered successfully.');
    }

    public function show(Box $box)
    {
        $box->load(['booking.sender', 'booking.boxes', 'recipient', 'boxType', 'batch', 'trackingLogs', 'latestUpdate', 'updates.updater']);
        if (empty($box->tracking_step_key) && ! empty($box->latestUpdate?->tracking_step_key)) {
            $box->tracking_step_key = $box->latestUpdate->tracking_step_key;
        }

        return Inertia::render('admin/boxes/show', [
            'box' => $box,
        ]);
    }

    public function edit(Box $box)
    {
        $bookings = Booking::with('sender')->latest()->get();

        $box->load(['booking.sender', 'latestUpdate']);
        if (empty($box->tracking_step_key) && ! empty($box->latestUpdate?->tracking_step_key)) {
            $box->tracking_step_key = $box->latestUpdate->tracking_step_key;
        }

        return Inertia::render('admin/boxes/edit', [
            'box' => $box,
            'bookings' => $bookings,
        ]);
    }

    public function update(UpdateBoxRequest $request, Box $box, BoxRepositoryInterface $boxRepo)
    {
        $validated = $request->validated();
        $overrideReason = $validated['admin_delivery_override_reason'] ?? null;
        unset($validated['admin_delivery_override_reason']);

        if (! $request->boolean('update_eta') && ! $request->boolean('update_eta_date') && ! $request->filled('eta_date')) {
            unset($validated['eta_date']);
        }
        if (! $request->boolean('update_eta') && ! $request->boolean('update_eta_message') && ! $request->filled('eta_message')) {
            unset($validated['eta_message']);
        }
        if (! $request->boolean('update_estimate_delivery') && ! $request->filled('estimate_delivery_date')) {
            unset($validated['estimate_delivery_date']);
        }
        if (! $request->boolean('update_estimate_delivery') && ! $request->filled('estimate_delivery_message')) {
            unset($validated['estimate_delivery_message']);
        }
        unset($validated['update_eta']);
        unset($validated['update_eta_date']);
        unset($validated['update_eta_message']);
        unset($validated['update_estimate_delivery']);

        $newStatus = $validated['status'] ?? null;
        $trackingStepKey = $validated['tracking_step_key'] ?? null;
        // Do not unset tracking_step_key so it gets saved to the boxes table
        $this->assertTrackingStepCanBeApplied($box, $trackingStepKey);

        $currentStatusVal = $box->status instanceof BoxStatus ? $box->status->value : (string) $box->status;
        $statusChanged = $newStatus && $currentStatusVal !== $newStatus;
        $stepChanged = $trackingStepKey && $trackingStepKey !== $box->tracking_step_key;

        if ($statusChanged || $stepChanged) {
            if ($newStatus === BoxStatus::Delivered->value && $this->requiresDeliveryOverride($box) && blank($overrideReason)) {
                throw ValidationException::withMessages([
                    'admin_delivery_override_reason' => 'An admin override reason is required when marking a box Delivered without proof and signature.',
                ]);
            }

            unset($validated['status']);
            $box->update($validated);

            $boxRepo->updateStatus(
                $box,
                $newStatus ?? $currentStatusVal,
                ($validated['courier_notes'] ?? null) ?: 'Status updated by Admin',
                Auth::id(),
                deliveryOverrideReason: $overrideReason,
                trackingStepKey: $trackingStepKey,
                bypassValidation: true,
            );
        } else {
            $box->update($validated);
        }

        app(TrackingCacheService::class)->forgetBox($box);

        return redirect($this->adminReturnUrl('admin.boxes.index'))->with('success', 'Box updated successfully.');
    }

    public function bulkUpdateStatus(Request $request, BoxRepositoryInterface $boxRepo)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'ids.*' => 'integer|exists:boxes,id',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
            'status' => 'nullable|string', // Optional to allow ETA-only updates
            'tracking_step_key' => 'nullable|string',
            'filter_status' => 'nullable|string', // The status filter applied to the view
            'area_id' => 'nullable|exists:areas,id',
            'courier_notes' => 'nullable|string|max:2000',
            'update_eta' => 'nullable|boolean',
            'update_eta_date' => 'nullable|boolean',
            'update_eta_message' => 'nullable|boolean',
            'eta_date' => 'nullable|date',
            'eta_message' => 'nullable|string|max:255',
        ]);


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
        if ($request->boolean('update_eta') || $request->boolean('update_eta_date') || ($request->has('eta_date') && $request->filled('eta_date'))) {
            $updates['eta_date'] = $validated['eta_date'] ?? null;
        }
        if ($request->boolean('update_eta') || $request->boolean('update_eta_message') || ($request->has('eta_message') && $request->filled('eta_message'))) {
            $updates['eta_message'] = $validated['eta_message'] ?? null;
        }

        foreach ($boxes as $box) {
            try {
                if (! empty($updates)) {
                    $box->update($updates);
                    app(TrackingCacheService::class)->forgetBox($box);
                }

                $currentStatusVal = $box->status instanceof BoxStatus ? $box->status->value : (string) $box->status;
                $targetStatus = $request->filled('status') ? $validated['status'] : $currentStatusVal;

                if ($request->filled('status') || $request->filled('tracking_step_key')) {
                    $this->assertTrackingStepCanBeApplied($box, $trackingStepKey);
                    $boxRepo->updateStatus(
                        $box,
                        $targetStatus,
                        ($validated['courier_notes'] ?? null) ?: 'Status updated by Admin',
                        $userId,
                        trackingStepKey: $trackingStepKey,
                        bypassValidation: true,
                    );
                }
                app(TrackingCacheService::class)->forgetBox($box);
                $updated++;
            } catch (\Exception $e) {
                // skip invalid transitions if any
            }
        }

        return redirect($this->adminReturnUrl('admin.boxes.index'))->with('success', "{$updated} boxes status updated successfully.");
    }

    public function bulkAssignToBatch(Request $request, BoxRepositoryInterface $boxRepo, BatchService $batchService)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'ids.*' => 'integer|exists:boxes,id',
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

        $batch = Batch::findOrFail($validated['batch_id']);

        $eligibleBoxes = [];
        $skippedReasons = [];

        foreach ($boxes as $box) {
            if ($box->booking->status === BookingStatus::Cancelled) {
                $skippedReasons[] = "{$box->tracking_number} (Cancelled)";
                continue;
            }

            if (in_array($box->booking->status, [BookingStatus::Pending, BookingStatus::Draft])) {
                $skippedReasons[] = "{$box->tracking_number} (Booking Not Confirmed)";
                continue;
            }

            if (!in_array($box->booking->payment_status, [PaymentStatus::Paid, PaymentStatus::CashCollected])) {
                $skippedReasons[] = "{$box->tracking_number} (Not Paid)";
                continue;
            }

            if ($box->booking->needsDeclaration()) {
                $skippedReasons[] = "{$box->tracking_number} (Missing Declaration)";
                continue;
            }

            // Skip boxes that are already in this same batch
            if ($box->batch_id === $batch->id) {
                $skippedReasons[] = "{$box->tracking_number} (Already in this batch)";
                continue;
            }

            $eligibleBoxes[] = $box;
        }

        if (empty($eligibleBoxes)) {
            $msg = 'Cannot assign boxes to batch. None of the selected box(es) are eligible: '.implode(', ', $skippedReasons);

            return redirect()->back()->with('error', $msg);
        }

        // For capacity check, only count boxes NOT already in a batch (transfers don't add net new boxes to the system)
        $freshBoxes = array_filter($eligibleBoxes, fn ($box) => $box->batch_id === null);
        $capacityError = $batchService->checkCapacity($batch, count($freshBoxes));
        if ($capacityError) {
            return redirect()->back()->with('error', $capacityError);
        }

        $userId = Auth::id();
        $affectedBatchIds = [$batch->id];
        $now = now();

        // Status ordering: statuses below LoadedToContainer will be advanced
        $statusesBelowLoaded = [
            BoxStatus::Pending->value,
            BoxStatus::Collected->value,
            BoxStatus::ReceivedByWarehouse->value,
        ];

        // Separate boxes that need status advancement from those that keep their status
        $advanceIds = [];
        $keepStatusIds = [];
        $trackingLogs = [];

        foreach ($eligibleBoxes as $box) {
            $oldBatchId = $box->batch_id;
            if ($oldBatchId && !in_array($oldBatchId, $affectedBatchIds, true)) {
                $affectedBatchIds[] = $oldBatchId;
            }

            $currentStatus = $box->status instanceof BoxStatus ? $box->status->value : $box->status;
            $isTransfer = $oldBatchId !== null;
            $needsAdvance = in_array($currentStatus, $statusesBelowLoaded, true);

            if ($needsAdvance) {
                // Box is below LoadedToContainer — advance it
                $advanceIds[] = $box->id;
                $trackingLogs[] = [
                    'box_id' => $box->id,
                    'status' => BoxStatus::LoadedToContainer->value,
                    'tracking_step_key' => 'loading_container',
                    'description' => ($isTransfer ? "Transferred" : "Assigned") . " to batch: {$batch->batch_number}",
                    'location' => 'Warehouse',
                    'tracking_phase' => \App\Enums\TrackingPhase::LOADING_CONTAINER->value,
                    'updated_by' => $userId,
                    'is_admin_override' => true,
                    'steps_bypassed' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            } else {
                // Box is already at or beyond LoadedToContainer — keep current status
                $keepStatusIds[] = $box->id;
                $trackingLogs[] = [
                    'box_id' => $box->id,
                    'status' => $currentStatus,
                    'tracking_step_key' => null,
                    'description' => ($isTransfer ? "Transferred" : "Assigned") . " to batch: {$batch->batch_number}",
                    'location' => $isTransfer ? 'In-Transit' : 'Warehouse',
                    'tracking_phase' => null,
                    'updated_by' => $userId,
                    'is_admin_override' => true,
                    'steps_bypassed' => 0,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        $allEligibleIds = array_merge($advanceIds, $keepStatusIds);

        DB::transaction(function () use ($allEligibleIds, $advanceIds, $batch, $trackingLogs) {
            // Bulk update batch_id for ALL eligible boxes
            Box::whereIn('id', $allEligibleIds)->update(['batch_id' => $batch->id]);

            // Only advance status for boxes that are below LoadedToContainer
            if (!empty($advanceIds)) {
                Box::whereIn('id', $advanceIds)->update(['status' => BoxStatus::LoadedToContainer->value, 'tracking_step_key' => 'loading_container']);
            }

            // Batch-insert tracking logs
            foreach (array_chunk($trackingLogs, 500) as $chunk) {
                \App\Models\BoxUpdate::insert($chunk);
            }
        });

        // Clear tracking cache for all affected boxes
        $trackingCacheService = app(TrackingCacheService::class);
        foreach ($eligibleBoxes as $box) {
            $box->batch_id = $batch->id;
            if (in_array($box->id, $advanceIds, true)) {
                $box->bypassStatusValidation = true;
                $box->status = BoxStatus::LoadedToContainer;
                $box->tracking_step_key = 'loading_container';
            }
            $trackingCacheService->forgetBox($box);
        }

        // Refresh counts on all affected batches (old + new)
        foreach ($affectedBatchIds as $bId) {
            $batchService->refreshAndEvaluateById($bId);
        }

        if ($batch->status === BatchStatus::Open) {
            $batchService->update($batch, ['status' => BatchStatus::Loading->value]);
        }

        $count = count($allEligibleIds);
        $keepStatusCount = count($keepStatusIds);

        if (count($skippedReasons) > 0 || $keepStatusCount > 0) {
            $parts = ["{$count} box(es) assigned to batch {$batch->batch_number}."];

            if ($keepStatusCount > 0) {
                $parts[] = "{$keepStatusCount} box(es) already at or beyond 'Loaded to Container' — status preserved.";
            }

            if (count($skippedReasons) > 0) {
                $skippedCount = count($skippedReasons);
                $parts[] = "{$skippedCount} box(es) were ineligible and left unassigned: ".implode(', ', $skippedReasons);
            }

            $flashType = count($skippedReasons) > 0 ? 'warning' : 'success';

            return redirect($this->adminReturnUrl('admin.boxes.index'))->with($flashType, implode(' ', $parts));
        }

        return redirect($this->adminReturnUrl('admin.boxes.index'))->with('success', "{$count} box(es) assigned to batch {$batch->batch_number} successfully.");
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

            return redirect($this->adminReturnUrl('admin.boxes.index'))->with('warning', $message);
        }

        return redirect($this->adminReturnUrl('admin.boxes.index'))->with('success', $message);
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
            'update_eta_date' => 'nullable|boolean',
            'update_eta_message' => 'nullable|boolean',
            'eta_date' => 'nullable|date',
            'eta_message' => 'nullable|string|max:255',
            'update_estimate_delivery' => 'nullable|boolean',
            'estimate_delivery_date' => 'nullable|date',
            'estimate_delivery_message' => 'nullable|string|max:255',
        ]);

        $newStatus = $validated['status'];
        $trackingStepKey = $validated['tracking_step_key'] ?? null;
        $overrideReason = $validated['admin_delivery_override_reason'] ?? null;
        $this->assertTrackingStepCanBeApplied($box, $trackingStepKey);

        $isDelivered = $newStatus === BoxStatus::Delivered->value;
        $isCollected = $newStatus === BoxStatus::Collected->value;

        // Proof is required only for delivered and collected statuses
        if ($isDelivered && ! $request->hasFile('delivery_proof') && blank($box->delivery_proof_path)) {
            throw ValidationException::withMessages([
                'delivery_proof' => 'A proof photo is required when marking a box as Delivered.',
            ]);
        }

        if ($isCollected && ! $request->hasFile('delivery_proof') && blank($box->pickup_proof_path)) {
            throw ValidationException::withMessages([
                'delivery_proof' => 'A proof photo is required when marking a box as Collected.',
            ]);
        }

        $updates = [];
        if ($request->boolean('update_eta') || $request->boolean('update_eta_date') || ($request->has('eta_date') && $request->filled('eta_date'))) {
            $updates['eta_date'] = $validated['eta_date'] ?? null;
        }
        if ($request->boolean('update_eta') || $request->boolean('update_eta_message') || ($request->has('eta_message') && $request->filled('eta_message'))) {
            $updates['eta_message'] = $validated['eta_message'] ?? null;
        }
        if ($request->boolean('update_estimate_delivery') || ($request->has('estimate_delivery_date') && $request->filled('estimate_delivery_date'))) {
            $updates['estimate_delivery_date'] = $validated['estimate_delivery_date'] ?? null;
        }
        if ($request->boolean('update_estimate_delivery') || ($request->has('estimate_delivery_message') && $request->filled('estimate_delivery_message'))) {
            $updates['estimate_delivery_message'] = $validated['estimate_delivery_message'] ?? null;
        }

        if (! empty($updates)) {
            $box->update($updates);
            app(TrackingCacheService::class)->forgetBox($box);
        }

        try {
            $boxRepo->updateStatus(
                $box,
                $newStatus,
                ($validated['courier_notes'] ?? null) ?: 'Status updated by Admin',
                Auth::id(),
                deliveryProof: $isDelivered ? $request->file('delivery_proof') : null,
                deliveryOverrideReason: $overrideReason,
                pickupProof: $isCollected ? $request->file('delivery_proof') : null,
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

        if (app(DeveloperAccess::class)->isDeveloperOrSuperAdmin(Auth::user())) {
            $canDelete = true;
        }

        if (! $canDelete) {
            return back()->with('error', 'Cannot delete a box unless its status is pending or cancelled.');
        }

        $box->delete();

        return redirect($this->adminReturnUrl('admin.boxes.index'))->with('success', 'Box archived successfully.');
    }

    public function restore($id)
    {
        if (! app(DeveloperAccess::class)->isDeveloperOrSuperAdmin(Auth::user())) {
            abort(403, 'Unauthorized');
        }

        $box = Box::withTrashed()->findOrFail($id);
        $box->restore();

        return redirect()->back()->with('success', 'Box restored successfully.');
    }

    public function exportExcel(Request $request)
    {
        $query = Box::with(['booking.sender', 'recipient', 'boxType', 'batch']);

        if ($request->filled('ids')) {
            $ids = is_array($request->ids) ? $request->ids : explode(',', (string) $request->ids);
            $query->whereIn('id', array_filter($ids));
        } else {
            $query = $this->applyFilters($query, $request);
        }

        $boxes = $query->get();

        app(AuditLogService::class)->logExportEvent('excel', 'Boxes list exported as Excel (.xlsx)', [
            'count' => $boxes->count(),
        ]);

        return Excel::download(new BoxesExport($boxes), 'boxes_export_'.now()->format('Ymd_His').'.xlsx');
    }

    public function downloadImportTemplate()
    {
        return Excel::download(new BoxesExport(null, true), 'boxes_import_template.xlsx');
    }

    public function importExcel(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        $import = new BoxesImport;
        Excel::import($import, $request->file('file'));

        $message = "Import completed: {$import->createdCount} created, {$import->updatedCount} updated.";
        if (! empty($import->failures)) {
            $failedCount = count($import->failures);
            $message .= " {$failedCount} rows had errors and were skipped.";
        }

        return back()->with([
            'success' => $message,
            'import_result' => [
                'created' => $import->createdCount,
                'updated' => $import->updatedCount,
                'failures' => $import->failures,
            ],
        ]);
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
                if ($request->payment_status === 'unpaid') {
                    $bq->whereIn('payment_status', [
                        PaymentStatus::Pending->value,
                        PaymentStatus::CashOnPickup->value,
                        PaymentStatus::BalancePending->value,
                    ]);
                } elseif ($request->payment_status === 'partial') {
                    $bq->whereIn('payment_status', [
                        PaymentStatus::PartiallyPaid->value,
                        PaymentStatus::BalancePending->value,
                    ]);
                } elseif ($request->payment_status === 'paid') {
                    $bq->whereIn('payment_status', [
                        PaymentStatus::Paid->value,
                        PaymentStatus::CashCollected->value,
                    ]);
                } else {
                    $bq->where('payment_status', $request->payment_status);
                }
            });
        }

        if ($request->filled('declaration_form_status')) {
            $query->whereHas('booking', function ($bq) use ($request) {
                if ($request->declaration_form_status === 'submitted') {
                    $bq->whereIn('declaration_form_status', ['submitted_online', 'physical_copy_received']);
                } elseif ($request->declaration_form_status === 'missing') {
                    $bq->where(function ($q) {
                        $q->where('declaration_form_status', 'missing')
                            ->orWhereNull('declaration_form_status');
                    })->whereNull('declaration_form_path');
                } else {
                    $bq->where('declaration_form_status', $request->declaration_form_status);
                }
            });
        }

        if ($request->filled('batch_id')) {
            if ($request->batch_id === 'unassigned') {
                $query->whereNull('batch_id');
            } else {
                $query->where('batch_id', $request->batch_id);
            }
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

    private function assertTrackingStepCanBeApplied(Box $box, ?string $trackingStepKey): void
    {
        if (blank($trackingStepKey)) {
            return;
        }

        $service = app(TrackingStepService::class);
        $steps = $service->getSteps();
        $selectedStep = collect($steps)->firstWhere('key', $trackingStepKey);

        if (! is_array($selectedStep)) {
            throw ValidationException::withMessages([
                'tracking_step_key' => 'The selected tracking step is not configured.',
            ]);
        }

        $currentKey = $box->tracking_step_key ?: $box->latestUpdate?->tracking_step_key;
        $currentStep = $currentKey
            ? collect($steps)->firstWhere('key', $currentKey)
            : $service->getStepBySystemStatus($box->status instanceof BoxStatus ? $box->status->value : (string) $box->status);

        if (is_array($currentStep) && (int) $selectedStep['order'] < (int) $currentStep['order']) {
            throw ValidationException::withMessages([
                'tracking_step_key' => 'A tracking step cannot move backward from the box\'s current journey position.',
            ]);
        }
    }
}
