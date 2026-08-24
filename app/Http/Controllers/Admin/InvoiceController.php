<?php

namespace App\Http\Controllers\Admin;

use App\Enums\InvoiceStatus;
use App\Enums\Role;
use App\Enums\RunsheetType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateInvoiceRequest;
use App\Models\Invoice;
use App\Models\Payment;
use App\Services\SettingsService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class InvoiceController extends Controller
{
    public function index(Request $request)
    {
        $query = Invoice::with('booking.sender');

        if ($request->boolean('trashed') && Auth::user()?->role === Role::SuperAdmin) {
            $query = Invoice::onlyTrashed()->with('booking.sender');
        }

        $query = $this->applyFilters($query, $request);

        $invoices = $query->paginate(10)->withQueryString();

        return Inertia::render('admin/invoices/index', [
            'invoices' => $invoices,
            'filters' => $request->only(['search', 'status', 'sort', 'direction', 'trashed']),
        ]);
    }

    public function show(Invoice $invoice, SettingsService $settingsService)
    {
        $this->authorizePickerInvoiceAccess($invoice);

        $invoice->load(['booking.sender', 'booking.boxes.boxType', 'booking.boxes.recipient', 'payments', 'booking.runsheets.picker']);

        return Inertia::render('admin/invoices/show', [
            'invoice' => $invoice->toHistoricalPayload(),
            'invoiceSettings' => $settingsService->getInvoiceSettings(),
        ]);
    }

    public function pdf(Invoice $invoice, SettingsService $settingsService)
    {
        $this->authorizePickerInvoiceAccess($invoice);


        $invoice->load(['booking.sender', 'booking.boxes.boxType', 'booking.runsheets.picker']);
        $invoiceSettings = $settingsService->getInvoiceSettings();
        $senderSnapshot = $invoice->resolveSenderSnapshot();
        $bookingSnapshot = $invoice->resolveBookingSnapshot();
        $lineItemsSnapshot = $invoice->resolveLineItemsSnapshot();
        $adminTeamSnapshot = $invoice->resolveAdminTeamSnapshot();

        $pdf = Pdf::loadView('admin.invoices.pdf', compact(
            'invoice',
            'invoiceSettings',
            'senderSnapshot',
            'bookingSnapshot',
            'lineItemsSnapshot',
            'adminTeamSnapshot'
        ))->setPaper('a4', 'portrait');

        return $pdf->stream($invoice->invoice_number.'.pdf');
    }

    private function authorizePickerInvoiceAccess(Invoice $invoice): void
    {
        $user = Auth::user();

        if (! $user || $user->role !== Role::Picker) {
            return;
        }

        $isAssigned = $invoice->booking()
            ->whereHas('runsheets', fn ($query) => $query
                ->where('runsheets.type', RunsheetType::Pickup->value)
                ->where('runsheets.picker_id', $user->id))
            ->exists();

        if (! $isAssigned) {
            abort(403, 'Unauthorized. You can only view invoices for your assigned bookings.');
        }
    }
    public function edit(Invoice $invoice)
    {
        return Inertia::render('admin/invoices/edit', [
            'invoice' => $invoice->load('booking.sender'),
        ]);
    }

    public function update(UpdateInvoiceRequest $request, Invoice $invoice, SettingsService $settingsService)
    {
        // Item 50: Invoice immutability after payment
        if ($invoice->payments()->exists()) {
            return back()->with('error', 'Invoices with payments cannot be edited.');
        }

        $validated = $request->validated();
        $vatRate = $settingsService->getInvoiceSettings()['taxRate'];
        $vatBreakdown = Invoice::calculateVatBreakdown((float) $validated['amount'], (float) $vatRate);

        $status = $validated['status'] instanceof InvoiceStatus ? $validated['status']->value : (string) $validated['status'];
        $paymentFields = ['payment_method', 'reference_number', 'proof_of_payment'];
        $invoiceData = Arr::except(array_merge($validated, $vatBreakdown), $paymentFields);

        $invoice->update($invoiceData);

        if ($status === 'paid' || $status === InvoiceStatus::Paid->value) {
            $proofPath = null;
            if ($request->hasFile('proof_of_payment')) {
                $proofPath = $request->file('proof_of_payment')->store('proofs_of_payment', 'public');
            }

            $method = $validated['payment_method'] ?? 'bank_transfer';
            $reference = !empty($validated['reference_number']) ? $validated['reference_number'] : (in_array($method, ['cash', 'cash_on_pickup']) ? 'Cash Payment' : 'Manual Admin Entry');

            if ($invoice->booking) {
                $bookingUpdate = [
                    'payment_method' => $method,
                    'payment_reference' => $reference,
                ];
                if ($proofPath) {
                    $bookingUpdate['proof_of_payment'] = $proofPath;
                }
                $invoice->booking->update($bookingUpdate);
            }

            if (! $invoice->payments()->exists()) {
                Payment::create([
                    'invoice_id' => $invoice->id,
                    'amount' => $invoice->amount,
                    'payment_method' => $method,
                    'reference_number' => $reference,
                    'paid_at' => now(),
                    'collected_by' => Auth::id(),
                    'confirmed_at' => now(),
                    'confirmed_by' => Auth::id(),
                    'is_cash_payment' => in_array($method, ['cash', 'cash_on_pickup']),
                    'confirmation_note' => 'Manually marked as Paid via Invoice Edit',
                ]);
            }
        }

        return redirect()->route('admin.invoices.index')->with('success', 'Invoice updated successfully.');
    }

    public function bulkMarkPaid(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
            'status' => 'nullable|string',
        ]);

        if ($request->boolean('select_all')) {
            $query = Invoice::query();
            $query = $this->applyFilters($query, $request);
            $invoices = $query->where('status', '!=', 'paid')->get();
        } else {
            $invoices = Invoice::whereIn('id', $validated['ids'])
                ->where('status', '!=', 'paid')
                ->get();
        }

        foreach ($invoices as $invoice) {
            $invoice->update(['status' => InvoiceStatus::Paid]);

            if (! $invoice->payments()->exists()) {
                Payment::create([
                    'invoice_id' => $invoice->id,
                    'amount' => $invoice->amount,
                    'payment_method' => 'bank_transfer',
                    'reference_number' => 'Bulk Admin Update',
                    'paid_at' => now(),
                    'collected_by' => Auth::id(),
                    'confirmed_at' => now(),
                    'confirmed_by' => Auth::id(),
                    'is_cash_payment' => false,
                    'confirmation_note' => 'Manually marked as Paid via Bulk Update',
                ]);
            }
        }

        return redirect()->route('admin.invoices.index')->with('success', count($invoices).' invoices marked as Paid.');
    }

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
            'status' => 'nullable|string',
        ]);

        if ($request->boolean('select_all')) {
            $query = Invoice::query();
            $query = $this->applyFilters($query, $request);
            $invoices = $query->get();
        } else {
            $invoices = Invoice::whereIn('id', $validated['ids'])->get();
        }

        $deletedCount = 0;
        $skippedCount = 0;

        foreach ($invoices as $invoice) {
            if ($invoice->payments()->exists()) {
                $skippedCount++;
            } else {
                $invoice->delete();
                $deletedCount++;
            }
        }

        $msg = "{$deletedCount} invoices archived successfully.";
        if ($skippedCount > 0) {
            $msg .= " {$skippedCount} invoices were skipped because they have payments.";
        }

        return redirect()->route('admin.invoices.index')->with('success', $msg);
    }

    public function destroy(Invoice $invoice)
    {
        if ($invoice->payments()->exists()) {
             return back()->with('error', 'Cannot delete an invoice that has payments.');
        }

        $invoice->delete();

        return redirect()->route('admin.invoices.index')->with('success', 'Invoice archived.');
    }

    public function restore(string $id)
    {
        if (Auth::user()?->role !== Role::SuperAdmin) {
            abort(403, 'Unauthorized');
        }

        $invoice = Invoice::withTrashed()->findOrFail($id);
        $invoice->restore();

        return redirect()->back()->with('success', 'Invoice restored successfully.');
    }

    private function applyFilters(Builder $query, Request $request): Builder
    {
        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($invoiceQuery) use ($search) {
                $invoiceQuery
                    ->where('invoice_number', 'like', "%{$search}%")
                    ->orWhereHas('booking', function ($bookingQuery) use ($search) {
                        $bookingQuery
                            ->where('reference_number', 'like', "%{$search}%")
                            ->orWhereHas('sender', function ($senderQuery) use ($search) {
                                $senderQuery
                                    ->where('first_name', 'like', "%{$search}%")
                                    ->orWhere('last_name', 'like', "%{$search}%")
                                    ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"]);
                            });
                    });
            });
        }

        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        $sortableColumns = ['invoice_number', 'amount', 'status', 'created_at'];
        $sort = in_array($request->sort, $sortableColumns) ? $request->sort : 'created_at';
        $direction = in_array($request->direction, ['asc', 'desc']) ? $request->direction : 'desc';

        return $query->orderBy($sort, $direction)->orderBy('id', 'desc');
    }
}
