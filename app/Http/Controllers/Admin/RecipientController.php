<?php

namespace App\Http\Controllers\Admin;

use App\Exports\RecipientsExport;
use App\Http\Controllers\Controller;
use App\Imports\RecipientsImport;
use App\Models\Area;
use App\Models\Recipient;
use App\Rules\Phone;
use App\Services\AuditLogService;
use App\Services\ReferenceDataService;
use App\Services\TransactionSnapshotService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class RecipientController extends Controller
{
    public function index(Request $request)
    {
        $query = Recipient::with(['sender', 'area']);

        $query->when($request->search, function ($q, $search) {
            $q->where(function ($qq) use ($search) {
                $qq->where('name', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%")
                    ->orWhere('province', 'like', "%{$search}%")
                    ->orWhereHas('sender', function ($sq) use ($search) {
                        $sq->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"]);
                    });
            });
        })->when($request->sender_id, function ($q, $sender_id) {
            $q->where('sender_id', $sender_id);
        });

        $recipients = $query->latest()->paginate(10)->withQueryString();

        return Inertia::render('admin/recipients/index', [
            'recipients' => $recipients,
            'filters' => $request->only(['search', 'sender_id']),
        ]);
    }

    public function show(Recipient $recipient)
    {
        $recipient->load(['sender', 'area', 'user']);

        $boxes = $recipient->boxes()
            ->with(['booking', 'boxType'])
            ->latest()
            ->paginate(10);

        $stats = [
            'totalBoxesCount' => $recipient->boxes()->count(),
        ];

        return Inertia::render('admin/recipients/show', [
            'recipient' => $recipient,
            'boxes' => $boxes,
            'stats' => $stats,
        ]);
    }

    public function edit(Recipient $recipient, ReferenceDataService $referenceDataService)
    {
        $areas = Area::where('is_active', true)->orderBy('name')->get();
        $provinces = $referenceDataService->activeProvinces();

        return Inertia::render('admin/recipients/edit', [
            'recipient' => $recipient->load(['sender', 'area']),
            'areas' => $areas,
            'provinces' => $provinces,
        ]);
    }

    public function update(Request $request, Recipient $recipient, ReferenceDataService $referenceDataService)
    {
        if ($request->filled('phone_number')) {
            $request->merge([
                'phone_number' => preg_replace('/[\s\-\(\)]+/', '', (string) $request->input('phone_number')),
            ]);
        }
        if ($request->filled('secondary_phone_number')) {
            $request->merge([
                'secondary_phone_number' => preg_replace('/[\s\-\(\)]+/', '', (string) $request->input('secondary_phone_number')),
            ]);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone_number' => [
                'nullable',
                'string',
                'max:20',
                new Phone('phone number'),
            ],
            'secondary_phone_number' => [
                'nullable',
                'string',
                'max:20',
                new Phone('secondary phone number'),
            ],
            'address' => 'required|string|max:500',
            'city' => 'required|string|max:100', // Mandate city to avoid N/A destinations (Item 74)
            'province' => 'required|string|max:100', // Mandate province (Item 74)
            'zip_code' => 'nullable|string|max:20',
            'landmarks' => 'nullable|string|max:500',
            'area_id' => 'nullable|exists:areas,id',
        ]);

        if (empty($validated['area_id']) && ! empty($validated['province'])) {
            $resolvedAreaId = $referenceDataService->resolveDestinationAreaId(
                $validated['province'],
                $validated['city'] ?? null
            );
            if ($resolvedAreaId) {
                $validated['area_id'] = $resolvedAreaId;
            }
        }

        $recipient->update($validated);

        app(TransactionSnapshotService::class)->syncActiveRecipientSnapshots($recipient);

        return redirect($this->adminReturnUrl('admin.recipients.index'))->with('success', 'Recipient updated successfully.');
    }

    public function exportExcel(Request $request)
    {
        $query = Recipient::with(['sender', 'area']);

        if ($request->filled('ids')) {
            $ids = is_array($request->ids) ? $request->ids : explode(',', (string) $request->ids);
            $query->whereIn('id', array_filter($ids));
        } else {
            $query->when($request->search, function ($q, $search) {
                $q->where(function ($qq) use ($search) {
                    $qq->where('name', 'like', "%{$search}%")
                        ->orWhere('city', 'like', "%{$search}%")
                        ->orWhere('province', 'like', "%{$search}%")
                        ->orWhereHas('sender', function ($sq) use ($search) {
                            $sq->where('first_name', 'like', "%{$search}%")
                                ->orWhere('last_name', 'like', "%{$search}%")
                                ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"]);
                        });
                });
            })->when($request->sender_id, function ($q, $sender_id) {
                $q->where('sender_id', $sender_id);
            });
        }

        $recipients = $query->latest()->get();

        app(AuditLogService::class)->logExportEvent('excel', 'Recipients list exported as Excel (.xlsx)', [
            'count' => $recipients->count(),
        ]);

        return Excel::download(new RecipientsExport($recipients), 'recipients_export_'.now()->format('Ymd_His').'.xlsx');
    }

    public function downloadImportTemplate()
    {
        return Excel::download(new RecipientsExport(null, true), 'recipients_import_template.xlsx');
    }

    public function importExcel(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        $import = new RecipientsImport;
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

    public function destroy(Recipient $recipient)
    {
        $recipient->delete();

        return redirect($this->adminReturnUrl('admin.recipients.index'))->with('success', 'Recipient deleted.');
    }
}
