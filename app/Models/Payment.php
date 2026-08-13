<?php

namespace App\Models;

use App\Concerns\LogsActivity;
use App\Concerns\VersionsEntity;
use App\Services\TransactionSnapshotService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Payment extends Model
{
    use LogsActivity, SoftDeletes, VersionsEntity;

protected $fillable = [
        'invoice_id',
        'invoice_snapshot',
        'invoice_version_id',
        'snapshot_taken_at',
        'amount',
        'payment_method',
        'reference_number',
        'paid_at',
        'collected_by',
        'stripe_payment_intent_id',
        'stripe_payment_method_id',
        'stripe_status',
        'idempotency_key',
        'confirmed_at',
        'confirmed_by',
        'is_cash_payment',
        'confirmation_note',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
            'invoice_snapshot' => 'array',
            'snapshot_taken_at' => 'datetime',
            'confirmed_at' => 'datetime',
            'is_cash_payment' => 'boolean',
        ];
    }

    public function invoice()
    {
        return $this->belongsTo(Invoice::class);
    }

public function collectedBy()
    {
        return $this->belongsTo(User::class, 'collected_by');
    }

    public function confirmedByUser()
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    /**
     * Check if this payment is pending admin confirmation.
     */
    public function isPendingConfirmation(): bool
    {
        return $this->is_cash_payment 
            && $this->paid_at !== null 
            && $this->confirmed_at === null;
    }

    /**
     * Check if this payment has been confirmed by admin.
     */
    public function isConfirmed(): bool
    {
        return $this->confirmed_at !== null;
    }

    /**
     * Check if this payment is a settled/confirmed cash payment.
     */
    public function isSettled(): bool
    {
        // Non-cash payments are settled if they have paid_at
        if (! $this->is_cash_payment) {
            return $this->paid_at !== null;
        }

        // Cash payments are settled only if confirmed
        return $this->confirmed_at !== null;
    }

    public static function buildSnapshotPayloadForInvoice(Invoice $invoice): array
    {
        return app(TransactionSnapshotService::class)->paymentPayloadForInvoice($invoice);
    }

    public function resolveInvoiceSnapshot(): array
    {
        $snapshotService = app(TransactionSnapshotService::class);
        $invoice = $this->invoice;

        return $snapshotService->mergeLiveWithSnapshot(
            $snapshotService->invoiceSnapshot($invoice),
            $this->invoice_snapshot,
        );
    }
}
