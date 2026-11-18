<?php

namespace App\Http\Controllers\Admin;

use App\Enums\InvoiceStatus;
use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StorePaymentRequest;
use App\Models\Invoice;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PaymentController extends Controller
{
    public function __construct(
        private readonly PaymentService $paymentService
    ) {}

    public function index(Request $request)
    {
        // Mark all pending cash payments as read when viewed on the index page
        Payment::where('is_cash_payment', true)->whereNotNull('paid_at')->whereNull('confirmed_at')->where('is_read', false)->update(['is_read' => true]);

        $query = Payment::whereNotNull('paid_at')->with([
            'invoice' => fn ($q) => $q->withTrashed(),
            'invoice.booking' => fn ($q) => $q->withTrashed(),
            'invoice.booking.sender' => fn ($q) => $q->withTrashed(),
            'invoice.booking.paymentOverriddenByUser',
            'collectedBy'
        ]);

        if ($request->filled('search')) {
            $search = $request->search;
            $query->whereHas('invoice', function ($iq) use ($search) {
                $iq->where('invoice_number', 'like', "%{$search}%")
                    ->orWhereHas('booking', function ($bq) use ($search) {
                        $bq->where('reference_number', 'like', "%{$search}%")
                            ->orWhereHas('sender', function ($sq) use ($search) {
                                $sq->where('first_name', 'like', "%{$search}%")
                                    ->orWhere('last_name', 'like', "%{$search}%")
                                    ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"]);
                            });
                    });
            });
        }

        $rawMethod = $request->input('payment_method') ?? $request->input('method');
        $activeMethod = (filled($rawMethod) && $rawMethod !== 'all') ? (string) $rawMethod : null;

        if ($activeMethod !== null) {
            if ($activeMethod === 'cash') {
                $query->whereIn('payment_method', ['cash', 'cash_on_pickup']);
            } elseif ($activeMethod === 'stripe_card') {
                $query->whereIn('payment_method', ['stripe_card', 'stripe', 'card']);
            } else {
                $query->where('payment_method', $activeMethod);
            }
        }

        $sortableColumns = [
            'amount',
            'payment_method',
            'paid_at',
            'created_at',
        ];

        $sort = in_array($request->sort, $sortableColumns) ? $request->sort : 'created_at';
        $direction = in_array($request->direction, ['asc', 'desc']) ? $request->direction : 'desc';

        $payments = $query->orderBy($sort, $direction)
            ->paginate(10)
            ->withQueryString()
            ->through(function ($payment) {
                return [
                    'id' => $payment->id,
                    'amount' => $payment->amount,
                    'payment_method' => $payment->payment_method,
                    'reference_number' => $payment->reference_number,
                    'paid_at' => $payment->paid_at,
                    'confirmed_at' => $payment->confirmed_at,
                    'is_pending_confirmation' => $payment->isPendingConfirmation(),
                    'payment_overridden_at' => $payment->invoice?->booking?->payment_overridden_at,
                    'payment_overridden_by_name' => $payment->invoice?->booking?->paymentOverriddenByUser?->name,
                    'invoice' => $payment->invoice,
                    'collected_by' => $payment->collectedBy,
                ];
            });

        $filters = $request->only(['search', 'sort', 'direction']);
        if ($activeMethod !== null) {
            $filters['payment_method'] = $activeMethod;
        }

        return Inertia::render('admin/payments/index', [
            'payments' => $payments,
            'filters' => $filters,
        ]);
    }

    public function create()
    {
        $invoices = Invoice::with(['booking.sender', 'booking.boxes.recipient', 'payments'])
            ->whereNotIn('status', [InvoiceStatus::Paid->value, InvoiceStatus::Voided->value])
            ->whereHas('booking', function ($query) {
                $query->where('status', '!=', BookingStatus::Cancelled->value);
            })
            ->latest()
            ->get();

        return Inertia::render('admin/payments/create', [
            'invoices' => $invoices,
            'selectedInvoiceId' => request('invoice_id'),
        ]);
    }

    public function store(StorePaymentRequest $request)
    {
        $this->paymentService->recordPayment($request->validated());

        $returnUrl = request()->input('return_to') ?? session('admin_return_url.admin.payments.index') ?? session('admin_return_url') ?? route('admin.payments.index');
        return redirect($returnUrl)->with('success', 'Payment recorded successfully.');
    }

    public function destroy(Payment $payment)
    {
        $payment->delete();

        $returnUrl = request()->input('return_to') ?? session('admin_return_url.admin.payments.index') ?? session('admin_return_url') ?? route('admin.payments.index');
        return redirect($returnUrl)->with('success', 'Payment deleted.');
    }

    public function confirm(Payment $payment)
    {
        try {
            $this->paymentService->confirmCashPayment($payment);
            return redirect()->back()->with('success', 'Cash payment confirmed successfully. The booking status will update accordingly.');
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Failed to confirm payment: ' . $e->getMessage());
        }
    }

    public function reject(Payment $payment)
    {
        try {
            $this->paymentService->rejectCashPayment($payment, request('reason'));
            return redirect()->back()->with('success', 'Cash payment rejected and removed.');
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Failed to reject payment: ' . $e->getMessage());
        }
    }
}
