<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\CommissionStatus;
use App\Enums\InvoiceStatus;
use App\Enums\PaymentStatus;
use App\Enums\PayoutMethod;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Payout;
use App\Models\User;
use App\Notifications\CashPaymentPendingConfirmation;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Stripe\Account;
use Stripe\AccountLink;
use Stripe\PaymentIntent;
use Stripe\Stripe;
use Stripe\Transfer;

class PaymentService
{
    /**
     * Record a payment for an invoice or booking.
     *
     * Uses an optional idempotency_key to prevent duplicate payments from
     * concurrent/retried submissions. If a payment with the same key already
     * exists, the existing record is returned instead of creating a new one.
     *
     * @param  array  $data  {
     *                       amount: float,
     *                       payment_method: string,
     *                       reference_number: string|null,
     *                       paid_at: string|datetime|null,
     *                       collected_by: int|null,
     *                       stripe_status: string|null,
     *                       stripe_payment_intent_id: string|null,
     *                       idempotency_key: string|null,
     *                       invoice_id: int|null,
     *                       booking_id: int|null,
     *                       }
     */
    public function recordPayment(array $data, ?Booking $booking = null, ?Invoice $invoice = null): Payment
    {
        // --- Idempotency Guard ---
        // If a key is provided and a payment with that key already exists,
        // return the existing payment to prevent duplicate charges.
        $idempotencyKey = isset($data['idempotency_key']) ? trim((string) $data['idempotency_key']) : null;
        if ($idempotencyKey === '') {
            $idempotencyKey = null;
        }

        if ($idempotencyKey) {
            $existing = Payment::where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                Log::info('Idempotent payment request deduplicated.', [
                    'idempotency_key' => $idempotencyKey,
                    'payment_id' => $existing->id,
                ]);

                return $existing;
            }
        }

        return DB::transaction(function () use ($data, $booking, $invoice, $idempotencyKey) {
            // Resolve Invoice if not provided but ID is in data
            if (! $invoice && ! empty($data['invoice_id'])) {
                $invoice = Invoice::find($data['invoice_id']);
            }

            // Resolve Booking if not provided but ID is in data
            if (! $booking && ! empty($data['booking_id'])) {
                $booking = Booking::find($data['booking_id']);
            }

            if ($booking && $booking->status === BookingStatus::Cancelled) {
                throw ValidationException::withMessages([
                    'booking_id' => 'Cannot record payment for a cancelled booking.',
                ]);
            }

            if (! $invoice && $booking) {
                // For bookings, we ensure an invoice exists before recording payment
                $invoice = Invoice::generateForBooking($booking);
            }

            if (! $invoice) {
                throw new \InvalidArgumentException('Either an Invoice or a Booking must be provided to record a payment.');
            }

            // Lock invoice row to serialize payment writes for the same invoice.
            $invoice = Invoice::query()
                ->whereKey($invoice->id)
                ->lockForUpdate()
                ->firstOrFail();

            $invoice->loadMissing('booking');

            if ($invoice->booking && $invoice->booking->status === BookingStatus::Cancelled) {
                throw ValidationException::withMessages([
                    'booking_id' => 'Cannot record payment for a cancelled booking.',
                ]);
            }

            if ($invoice->status === InvoiceStatus::Voided) {
                throw ValidationException::withMessages([
                    'invoice_id' => 'Cannot record payment for a voided invoice.',
                ]);
            }

            $outstanding = max((float) $invoice->amount - $this->settledPaymentsTotal($invoice), 0.0);

            if ($invoice->status === InvoiceStatus::Paid || $outstanding <= 0.0) {
                throw ValidationException::withMessages([
                    'invoice_id' => 'This invoice is already fully paid.',
                ]);
            }

            $amount = (float) $data['amount'];
            if ($amount > $outstanding + 0.00001) {
                throw ValidationException::withMessages([
                    'amount' => sprintf('Amount cannot exceed the outstanding balance of %.2f.', $outstanding),
                ]);
            }

            $paymentMethod = $data['payment_method'] ?? 'cash';
            $isCashPayment = $paymentMethod === 'cash';

            $paymentData = [
                'invoice_id' => $invoice->id,
                'amount' => $amount,
                'payment_method' => $paymentMethod,
                'reference_number' => $data['reference_number'] ?? null,
                'paid_at' => $data['paid_at'] ?? now(),
                'collected_by' => $data['collected_by'] ?? Auth::id(),
                'stripe_status' => $data['stripe_status'] ?? null,
                'stripe_payment_intent_id' => $data['stripe_payment_intent_id'] ?? null,
                'idempotency_key' => $idempotencyKey,
                'is_cash_payment' => $isCashPayment,
            ];

            if ($isCashPayment) {
                $currentUser = Auth::user();
                if ($currentUser && in_array($currentUser->role, [Role::SuperAdmin, Role::Admin])) {
                    $paymentData['confirmed_at'] = now();
                    $paymentData['confirmed_by'] = $currentUser->id;
                }
            }

            try {
                $payment = Payment::create($paymentData);

                if ($isCashPayment && empty($paymentData['confirmed_at'])) {
                    $admins = User::whereIn('role', [Role::SuperAdmin, Role::Admin])->get();
                    Notification::send($admins, new CashPaymentPendingConfirmation($payment));
                }
            } catch (QueryException $exception) {
                if ($idempotencyKey && $this->isIdempotencyKeyConflict($exception)) {
                    $existing = Payment::where('idempotency_key', $idempotencyKey)->first();
                    if ($existing) {
                        Log::info('Concurrent idempotent payment write deduplicated.', [
                            'idempotency_key' => $idempotencyKey,
                            'payment_id' => $existing->id,
                        ]);

                        return $existing;
                    }
                }

                throw $exception;
            }

            // Note: PaymentObserver handles syncing Invoice and Booking statuses
            // based on the total settled payments.

            return $payment;
        });
    }

    /**
     * Quick helper to record a full cash payment for a booking (commonly used by pickers).
     */
    public function recordFullCashPayment(Booking $booking, ?int $collectedBy = null): Payment
    {
        $invoice = Invoice::generateForBooking($booking);

        return $this->recordPayment([
            'amount' => $invoice->amount,
            'payment_method' => 'cash',
            'collected_by' => $collectedBy ?? Auth::id(),
            'idempotency_key' => 'cash_full_'.$booking->id.'_'.$invoice->id,
        ], $booking, $invoice);
    }

    /**
     * Create a Stripe PaymentIntent for a booking.
     */
    public function createPaymentIntent(Booking $booking, bool $forceNew = false)
    {
        Stripe::setApiKey(config('services.stripe.secret'));

        // 1. Ensure Invoice exists
        $invoice = Invoice::generateForBooking($booking);

        if ((float) $invoice->amount <= 0.0) {
            throw new \InvalidArgumentException(
                'Cannot create a Stripe payment intent for a zero-amount invoice. '.
                'Please ensure box prices are configured for the selected area and box type combinations. '.
                'Booking ID: '.$booking->id.', Invoice ID: '.$invoice->id
            );
        }

        // 2. Check for existing UNPAID payment intent for this invoice unless forced.
        $existingPayment = null;
        if (! $forceNew) {
            $existingPayment = Payment::where('invoice_id', $invoice->id)
                ->whereNotNull('stripe_payment_intent_id')
                ->where('stripe_status', '!=', 'succeeded')
                ->latest('id')
                ->first();
        }

        if ($existingPayment) {
            try {
                $paymentIntent = PaymentIntent::retrieve($existingPayment->stripe_payment_intent_id);

                // If Stripe says it's already succeeded, handle it
                if ($paymentIntent->status === 'succeeded') {
                    $this->handleSuccessfulPayment($paymentIntent);

                    return $paymentIntent;
                }

                if ($paymentIntent->status === 'canceled') {
                    throw new \RuntimeException('Existing PaymentIntent was canceled; generating a new intent.');
                }

                // Update amount if invoice changed
                if ($paymentIntent->amount !== (int) ($invoice->amount * 100)) {
                    // Bug 6 fix: cancel the stale intent and fall through to create a fresh one
                    // so we never present a client secret for the wrong amount.
                    try {
                        $paymentIntent->cancel();
                    } catch (\Exception $cancelException) {
                        Log::warning('Failed to cancel stale PaymentIntent.', [
                            'payment_intent_id' => $existingPayment->stripe_payment_intent_id,
                            'error' => $cancelException->getMessage(),
                        ]);
                    }
                    // Mark the DB record so it is not picked up again
                    $existingPayment->update(['stripe_status' => 'canceled']);
                    // Fall through to create a new PaymentIntent below
                    $existingPayment = null;
                } else {
                    return $paymentIntent;
                }

            } catch (\Exception $e) {
                // Ignore and fall through to create new
            }
        }

        $idempotencyKey = 'pi_invoice_'.$invoice->id.'_'.$invoice->amount;

        try {
            $paymentIntent = PaymentIntent::create([
                'amount' => (int) ($invoice->amount * 100),
                'currency' => config('services.stripe.currency', 'aud'),
                'metadata' => [
                    'booking_id' => $booking->id,
                    'invoice_id' => $invoice->id,
                    'reference' => $booking->reference_number,
                ],
                'automatic_payment_methods' => [
                    'enabled' => true,
                ],
            ], [
                'idempotency_key' => $idempotencyKey,
            ]);
        } catch (\Exception $e) {
            $paymentIntent = PaymentIntent::create([
                'amount' => (int) ($invoice->amount * 100),
                'currency' => config('services.stripe.currency', 'aud'),
                'metadata' => [
                    'booking_id' => $booking->id,
                    'invoice_id' => $invoice->id,
                    'reference' => $booking->reference_number,
                ],
                'automatic_payment_methods' => [
                    'enabled' => true,
                ],
            ], [
                'idempotency_key' => $idempotencyKey.'_'.time(),
            ]);
        }

        // Return immediately if it's returning cached succeeded intent
        if ($paymentIntent->status === 'succeeded') {
            $this->handleSuccessfulPayment($paymentIntent);

            return $paymentIntent;
        }

        if ($paymentIntent->status === 'canceled') {
            $paymentIntent = PaymentIntent::create([
                'amount' => (int) ($invoice->amount * 100),
                'currency' => config('services.stripe.currency', 'aud'),
                'metadata' => [
                    'booking_id' => $booking->id,
                    'invoice_id' => $invoice->id,
                    'reference' => $booking->reference_number,
                ],
                'automatic_payment_methods' => [
                    'enabled' => true,
                ],
            ], [
                'idempotency_key' => $idempotencyKey.'_'.time(),
            ]);
        }

        // Store initial record (pending)
        Payment::updateOrCreate(
            ['stripe_payment_intent_id' => $paymentIntent->id],
            [
                'invoice_id' => $invoice->id,
                'amount' => $invoice->amount,
                'payment_method' => 'stripe_card',
                'stripe_status' => $paymentIntent->status,
            ]
        );

        return $paymentIntent;
    }

    /**
     * Handle successful payment from Stripe webhook or confirmation.
     */
    public function handleSuccessfulPayment(PaymentIntent $paymentIntent)
    {
        $invoiceId = $paymentIntent->metadata->invoice_id ?? null;
        $bookingId = $paymentIntent->metadata->booking_id ?? null;

        // Re-entrancy guard
        $existingPayment = Payment::where('stripe_payment_intent_id', $paymentIntent->id)->first();
        if ($existingPayment && $existingPayment->stripe_status === 'succeeded') {
            return;
        }

        DB::transaction(function () use ($invoiceId, $bookingId, $paymentIntent) {
            $payment = Payment::where('stripe_payment_intent_id', $paymentIntent->id)
                ->lockForUpdate()
                ->first();

            if ($payment) {
                if ($payment->stripe_status === 'succeeded') {
                    return;
                }

                // If intent was initially pending via updateOrCreate, update it to succeeded now
                $payment->update([
                    'stripe_status' => 'succeeded',
                    'paid_at' => now(),
                    'reference_number' => $paymentIntent->id,
                ]);
            } else {
                // Bug fix: When the webhook arrives before createIntent is committed,
                // we should insert it via recordPayment for idempotency and constraints.
                $invoice = $invoiceId ? Invoice::find($invoiceId) : null;
                if (! $invoice && $bookingId) {
                    $invoice = Booking::find($bookingId)?->invoice;
                }

                if ($invoice) {
                    $this->recordPayment([
                        'amount' => $paymentIntent->amount / 100,
                        'payment_method' => 'stripe_card',
                        'stripe_payment_intent_id' => $paymentIntent->id,
                        'stripe_status' => 'succeeded',
                        'paid_at' => now(),
                        'reference_number' => $paymentIntent->id,
                        'idempotency_key' => 'stripe_wh_'.$paymentIntent->id,
                    ], null, $invoice);
                } else {
                    Log::error('Stripe webhook failed to find invoice.', [
                        'payment_intent_id' => $paymentIntent->id,
                        'metadata' => $paymentIntent->metadata,
                    ]);
                }
            }
        });
    }

    private function settledPaymentsTotal(Invoice $invoice): float
    {
        return (float) $invoice->payments()
            ->where(function ($query) {
                $query->whereNotNull('paid_at')
                    ->orWhere('stripe_status', 'succeeded');
            })
            ->sum('amount');
    }

    private function isIdempotencyKeyConflict(QueryException $exception): bool
    {
        $sqlState = $exception->errorInfo[0] ?? null;
        $message = Str::lower($exception->getMessage());

        return in_array($sqlState, ['23000', '23505'], true)
            && str_contains($message, 'idempotency');
    }

    /**
     * Confirm a cash payment recorded by a picker.
     * Admin calls this to verify the cash was actually received.
     */
    public function confirmCashPayment(Payment $payment, ?int $confirmedBy = null, ?string $note = null): Payment
    {
        if (! $payment->is_cash_payment) {
            throw new \InvalidArgumentException('Only cash payments require confirmation.');
        }

        if ($payment->confirmed_at !== null) {
            throw new \InvalidArgumentException('This payment has already been confirmed.');
        }

        $payment->update([
            'confirmed_at' => now(),
            'confirmed_by' => $confirmedBy ?? Auth::id(),
            'confirmation_note' => $note,
        ]);

        // Safety net: explicitly re-sync invoice & booking status.
        // The PaymentObserver should handle this, but if it didn't fire
        // (e.g. event suppression, trait listener error), this ensures
        // the invoice and booking statuses are always consistent.
        $this->ensureInvoiceStatusSynced($payment);

        return $payment->fresh();
    }

    /**
     * Reject a cash payment recorded by a picker.
     * Admin calls this if the cash was not actually received.
     * This deletes the payment record.
     */
    public function rejectCashPayment(Payment $payment, ?string $reason = null): void
    {
        if (! $payment->is_cash_payment) {
            throw new \InvalidArgumentException('Only cash payments can be rejected.');
        }

        Log::info('Cash payment rejected.', [
            'payment_id' => $payment->id,
            'amount' => $payment->amount,
            'reason' => $reason,
            'rejected_by' => Auth::id(),
        ]);

        $invoiceId = $payment->invoice_id;

        $payment->delete();

        // Safety net: explicitly re-sync after deletion, in case the
        // PaymentObserver::deleted() didn't fire or used stale data.
        if ($invoiceId) {
            $this->ensureInvoiceStatusSyncedByInvoiceId($invoiceId);
        }
    }

    /**
     * Explicitly re-sync invoice & booking statuses from a payment reference.
     *
     * This is a safety net: the PaymentObserver should do this automatically,
     * but if it didn't fire (e.g. VersionsEntity trait error, withoutEvents(),
     * event suppression), this ensures the statuses are always consistent.
     */
    private function ensureInvoiceStatusSynced(Payment $payment): void
    {
        $this->ensureInvoiceStatusSyncedByInvoiceId($payment->invoice_id);
    }

    private function ensureInvoiceStatusSyncedByInvoiceId(int $invoiceId): void
    {
        $invoice = Invoice::find($invoiceId);
        if (! $invoice || $invoice->status === InvoiceStatus::Voided) {
            return;
        }

        // Same settled logic as PaymentObserver, pushed to SQL
        $totalPaid = (string) $invoice->payments()
            ->where(function ($query) {
                $query
                    ->where(function ($q) {
                        $q->where(function ($inner) {
                            $inner->where('is_cash_payment', false)
                                ->orWhereNull('is_cash_payment');
                        })->whereNotNull('paid_at');
                    })
                    ->orWhere(function ($q) {
                        $q->where('is_cash_payment', true)
                            ->whereNotNull('confirmed_at');
                    });
            })
            ->sum('amount');

        $invoiceAmount = (string) $invoice->amount;
        $cmp = bccomp($totalPaid, $invoiceAmount, 2);

        if ($cmp >= 0) {
            $newStatus = InvoiceStatus::Paid;
        } elseif (bccomp($totalPaid, '0', 2) > 0) {
            $newStatus = InvoiceStatus::Partial;
        } else {
            $newStatus = InvoiceStatus::Unpaid;
        }

        if ($invoice->status !== $newStatus) {
            $invoice->update(['status' => $newStatus]);
        }

        $booking = $invoice->booking()->first();
        if ($booking) {
            if ($newStatus === InvoiceStatus::Paid) {
                if ($booking->payment_status !== PaymentStatus::Paid) {
                    $booking->update(['payment_status' => PaymentStatus::Paid]);
                }
            } else {
                if ($booking->payment_status === PaymentStatus::Paid) {
                    $booking->update(['payment_status' => PaymentStatus::Pending]);
                }
            }
        }
    }

    /**
     * Create a Stripe Connected Account for a picker.
     */
    public function createConnectedAccount(User $picker): string
    {
        Stripe::setApiKey(config('services.stripe.secret'));

        if (! $picker->stripe_account_id) {
            $account = Account::create([
                'type' => 'express',
                'country' => 'AU', // Assuming AU based on previous context, can be dynamic
                'email' => $picker->email,
                'capabilities' => [
                    'transfers' => ['requested' => true],
                ],
                'tos_acceptance' => [
                    'service_agreement' => 'recipient',
                ],
            ]);

            $picker->update(['stripe_account_id' => $account->id]);
        }

        $accountLink = AccountLink::create([
            'account' => $picker->stripe_account_id,
            'refresh_url' => route('picker.stripe.onboarding'),
            'return_url' => route('picker.stripe.onboarding.success'),
            'type' => 'account_onboarding',
        ]);

        return $accountLink->url;
    }

    /**
     * Transfer funds to a Connected Account.
     */
    public function transferToConnectedAccount(Payout $payout): Transfer
    {
        Stripe::setApiKey(config('services.stripe.secret'));

        $picker = $payout->picker;

        if (! $picker || ! $picker->stripe_account_id || ! $picker->stripe_onboarding_completed) {
            throw new \Exception('Picker Stripe account is not fully configured.');
        }

        $amountInCents = (int) round((float) $payout->total_amount * 100);

        if ($amountInCents < 1) {
            throw new \Exception('Payout amount must be at least 0.01.');
        }

        $transfer = Transfer::create([
            'amount' => $amountInCents,
            'currency' => config('services.stripe.currency', 'aud'),
            'destination' => $picker->stripe_account_id,
            'metadata' => [
                'payout_id' => $payout->id,
            ],
        ]);

        return $transfer;
    }

    /**
     * Check onboarding status of a connected account.
     */
    public function checkConnectedAccountStatus(User $picker): void
    {
        if (! $picker->stripe_account_id) {
            return;
        }

        Stripe::setApiKey(config('services.stripe.secret'));
        $account = Account::retrieve($picker->stripe_account_id);

        if ($account->details_submitted) {
            $picker->update(['stripe_onboarding_completed' => true]);
        }
    }

    /**
     * Process a picker-initiated cash out.
     */
    public function processPickerCashout(User $picker, string $destinationAccountId): Payout
    {
        if (! $picker->stripe_account_id || ! $picker->stripe_onboarding_completed) {
            throw new \Exception('Picker Stripe account is not fully configured.');
        }

        return DB::transaction(function () use ($picker, $destinationAccountId) {
            $commissions = $picker->commissions()
                ->where('status', CommissionStatus::PENDING->value)
                ->lockForUpdate()
                ->get();

            if ($commissions->isEmpty()) {
                throw new \Exception('No pending commissions for this picker.');
            }

            $totalAmount = $commissions->sum('amount');

            Stripe::setApiKey(config('services.stripe.secret'));

            // Set the chosen external account as default
            try {
                Account::updateExternalAccount(
                    $picker->stripe_account_id,
                    $destinationAccountId,
                    ['default_for_currency' => true]
                );
            } catch (\Exception $e) {
                Log::error('Failed to update default external account: '.$e->getMessage());
                throw new \Exception('Failed to set destination account. Please try again.');
            }

            $payout = Payout::create([
                'picker_id' => $picker->id,
                'total_amount' => $totalAmount,
                'payout_method' => PayoutMethod::Stripe->value,
                'paid_at' => now(),
            ]);

            $picker->commissions()
                ->where('status', CommissionStatus::PENDING->value)
                ->update([
                    'status' => CommissionStatus::PAID->value,
                    'payout_id' => $payout->id,
                ]);

            try {
                $transfer = $this->transferToConnectedAccount($payout);
                $payout->update(['reference_number' => $transfer->id]);
            } catch (\Exception $e) {
                Log::error('Stripe Payout Transfer failed: '.$e->getMessage());
                throw new \Exception('Stripe Transfer Failed: '.$e->getMessage());
            }

            return $payout;
        });
    }
}
