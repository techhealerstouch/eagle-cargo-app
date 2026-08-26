<?php

namespace App\Models;

use App\Concerns\LogsActivity;
use App\Concerns\VersionsEntity;
use App\Enums\InvoiceStatus;
use App\Services\SettingsService;
use App\Services\TransactionSnapshotService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * @property \Illuminate\Support\Carbon|null $due_date
 * @property \Illuminate\Support\Carbon|null $sent_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class Invoice extends Model
{
    use HasFactory, LogsActivity, SoftDeletes, VersionsEntity;

    protected $fillable = [
        'booking_id',
        'invoice_number',
        'or_number',
        'amount',
        'surcharge_amount',
        'vat_amount',
        'vatable_revenue',
        'vat_exempt_revenue',
        'is_vat_inclusive',
        'status',
        'due_date',
        'sent_at',
        'zoho_invoice_id',
        'sender_snapshot',
        'booking_snapshot',
        'line_items_snapshot',
        'admin_team_snapshot',
        'snapshot_taken_at',
        'booking_version_id',
        'sender_version_id',
    ];

    protected function casts(): array
    {
        return [
            'amount'              => 'decimal:2',
            'surcharge_amount'    => 'decimal:2',
            'vat_amount'          => 'decimal:2',
            'vatable_revenue'     => 'decimal:2',
            'vat_exempt_revenue'  => 'decimal:2',
            'is_vat_inclusive'    => 'boolean',
            'due_date'            => 'date',
            'sent_at'             => 'datetime',
            'status'              => InvoiceStatus::class,
            'sender_snapshot'     => 'array',
            'booking_snapshot'    => 'array',
            'line_items_snapshot' => 'array',
            'admin_team_snapshot' => 'array',
            'snapshot_taken_at'   => 'datetime',
        ];
    }

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

public static function generateForBooking(Booking $booking): self
    {
        return DB::transaction(function () use ($booking) {
            $lockedBooking = Booking::query()
                ->whereKey($booking->id)
                ->lockForUpdate()
                ->firstOrFail();

            $existingInvoice = $lockedBooking->invoice()->first();
            if ($existingInvoice) {
                return $existingInvoice;
            }

            // Explicitly load boxes relationship to ensure we have access to all boxes
            $lockedBooking->load('boxes');

            // Ensure all boxes have prices resolved before taking the snapshot
            // This triggers the saving/saved events in BoxObserver only for boxes without a price
            $lockedBooking->boxes->each(function (Box $box) {
                if ($box->price_charged === null || (float) $box->price_charged === 0.0) {
                    $box->save();
                }
            });

            // Refresh the booking but keep boxes loaded for the snapshot
            $lockedBooking->refresh();
            $lockedBooking->load('boxes');

            $snapshotPayload = self::buildSnapshotPayload($lockedBooking);
            $boxesPrice = collect($snapshotPayload['line_items_snapshot'] ?? [])->sum('price_charged');
            $oversizedSurcharge = collect($snapshotPayload['line_items_snapshot'] ?? [])->sum('oversized_surcharge');
            $hasEmptyBoxInSnapshot = collect($snapshotPayload['line_items_snapshot'] ?? [])->contains('item_type', 'empty_box');
            $emptyBoxTotal = $hasEmptyBoxInSnapshot ? 0.0 : (float) (($lockedBooking->empty_box_count ?? 0) * ($lockedBooking->empty_box_fee ?? 10.00));
            $basePrice = $boxesPrice + $emptyBoxTotal + $oversizedSurcharge;

            // Calculate Afterpay surcharge (6.3%) if applicable
            $surchargeAmount = 0.0;
            if ($lockedBooking->payment_method === 'afterpay') {
                $surchargeAmount = round((float) $basePrice * 0.063, 2);
            }
            $totalPrice = (float) $basePrice + $surchargeAmount;

            $settingsService = app(SettingsService::class);
            $vatRate = $settingsService->getInvoiceSettings()['taxRate'];
            $vatBreakdown = self::calculateVatBreakdown((float) $totalPrice, (float) $vatRate);

            $invoice = self::create([
                'booking_id'      => $lockedBooking->id,
                'invoice_number'  => 'TMP-INV-'.Str::upper(Str::random(12)),
                'amount'          => $totalPrice,
                'surcharge_amount' => $surchargeAmount,
                'vatable_revenue' => $vatBreakdown['vatable_revenue'],
                'vat_amount'      => $vatBreakdown['vat_amount'],
                'vat_exempt_revenue' => $vatBreakdown['vat_exempt_revenue'],
                'is_vat_inclusive' => $vatBreakdown['is_vat_inclusive'],
                'due_date'        => now()->addDays(7), // Default 7 days due date
                'status'          => InvoiceStatus::Unpaid,
                ...$snapshotPayload,
            ]);

            $year = $invoice->created_at?->format('Y') ?? date('Y');
            $invoice->invoice_number = self::formatInvoiceNumber($invoice->id, $year);
            $invoice->saveQuietly();

            return $invoice->fresh();
        }, 3);
    }

    protected static function formatInvoiceNumber(int $id, string $year): string
    {
        return 'INV-'.$year.'-'.str_pad((string) $id, 5, '0', STR_PAD_LEFT);
    }

    /**
     * Recalculate the invoice amount when a booking's payment method changes.
     * This handles the case where Afterpay is added or removed after invoice creation.
     */
    public function recalculateAmount(): void
    {
        $booking = $this->booking()->with('boxes')->first();
        if (! $booking) {
            return;
        }

        // Regenerate snapshot to reflect any physical box changes (e.g., bulging box surcharge)
        $boxes = $booking->boxes()->with('batch', 'recipient', 'boxType')->get();
        $this->line_items_snapshot = app(\App\Services\TransactionSnapshotService::class)->lineItemsSnapshot($boxes, $booking);

        $basePrice = collect($this->line_items_snapshot)->sum('price_charged');
        $oversizedSurcharge = collect($this->line_items_snapshot)->sum('oversized_surcharge');

        $basePrice += $oversizedSurcharge;

        $surchargeAmount = 0.0;
        if ($booking->payment_method === 'afterpay') {
            $surchargeAmount = round((float) $basePrice * 0.063, 2);
        }
        $totalPrice = (float) $basePrice + $surchargeAmount;

        $settingsService = app(SettingsService::class);
        $vatRate = $settingsService->getInvoiceSettings()['taxRate'];
        $vatBreakdown = self::calculateVatBreakdown($totalPrice, (float) $vatRate);

        $this->updateQuietly([
            'amount'             => $totalPrice,
            'surcharge_amount'   => $surchargeAmount,
            'vatable_revenue'    => $vatBreakdown['vatable_revenue'],
            'vat_amount'         => $vatBreakdown['vat_amount'],
            'vat_exempt_revenue' => $vatBreakdown['vat_exempt_revenue'],
            'is_vat_inclusive'   => $vatBreakdown['is_vat_inclusive'],
        ]);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public static function buildSnapshotPayload(Booking $booking): array
    {
        return app(TransactionSnapshotService::class)->invoicePayloadForBooking($booking);
    }

    public function resolveSenderSnapshot(): array
    {
        $snapshotService = app(TransactionSnapshotService::class);
        $liveSender = $this->booking?->sender;

        return $snapshotService->mergeLiveWithSnapshot(
            $snapshotService->senderSnapshot($liveSender),
            $this->sender_snapshot,
        );
    }

    public function resolveBookingSnapshot(): array
    {
        $snapshotService = app(TransactionSnapshotService::class);

        return $snapshotService->mergeLiveWithSnapshot(
            $snapshotService->bookingSnapshot($this->booking),
            $this->booking_snapshot,
        );
    }

    public function resolveLineItemsSnapshot(): array
    {
        if (is_array($this->line_items_snapshot) && ! empty($this->line_items_snapshot)) {
            $items = $this->line_items_snapshot;
            $boxes = null;
            foreach ($items as &$item) {
                if (!empty($item['is_door_to_door']) && !isset($item['door_to_door_fee'])) {
                    if ($boxes === null) {
                        $boxes = $this->booking?->boxes()->with('recipient')->get()->keyBy('id') ?? collect();
                    }
                    $boxId = $item['id'] ?? null;
                    $box = $boxId ? $boxes->get($boxId) : null;
                    if ($box) {
                        $areaId = $box->recipient?->area_id ?? $box->area_id;
                        $item['door_to_door_fee'] = $areaId
                            ? (float) app(\App\Services\ReferenceDataService::class)->doorToDoorFeeFor($areaId)
                            : 0.0;
                    } else {
                        $item['door_to_door_fee'] = 0.0;
                    }
                }
            }
            return $items;
        }

        $boxes = $this->booking?->boxes()->with('batch')->get() ?? collect();

        return app(TransactionSnapshotService::class)->lineItemsSnapshot($boxes, $this->booking);
    }

    public function resolveAdminTeamSnapshot(): array
    {
        if (is_array($this->admin_team_snapshot) && ! empty($this->admin_team_snapshot)) {
            return $this->admin_team_snapshot;
        }

        $adminLogs = ActivityLog::where('model_type', Booking::class)
            ->where('model_id', $this->booking_id)
            ->whereIn('action', ['created', 'updated'])
            ->with('user')
            ->latest()
            ->get();

        $adminUser = $adminLogs->first()?->user;

        return ['name' => $adminUser?->name ?? 'Admin'];
    }

    public static function calculateVatBreakdown(float $amount, float $taxRate): array
    {
        $amount = max($amount, 0.0);
        $taxRate = max($taxRate, 0.0);

        if ($amount <= 0.0 || $taxRate <= 0.0) {
            return [
                'vatable_revenue' => 0.0,
                'vat_amount' => 0.0,
                'vat_exempt_revenue' => round($amount, 2),
                'is_vat_inclusive' => true,
            ];
        }

        $vatableRevenue = round($amount / (1 + $taxRate), 2);
        $vatAmount = round($amount - $vatableRevenue, 2);

        return [
            'vatable_revenue' => $vatableRevenue,
            'vat_amount' => $vatAmount,
            'vat_exempt_revenue' => 0.0,
            'is_vat_inclusive' => true,
        ];
    }

    public function toHistoricalPayload(): array
    {
        $payload = $this->toArray();
        $payload['booking'] = $payload['booking'] ?? [];

        $senderSnapshot = $this->resolveSenderSnapshot();
        $bookingSnapshot = $this->resolveBookingSnapshot();
        $lineItemsSnapshot = $this->resolveLineItemsSnapshot();

        $payload['line_items_snapshot'] = $lineItemsSnapshot;
        $payload['booking']['sender'] = array_merge($payload['booking']['sender'] ?? [], $senderSnapshot);
        $payload['booking']['reference_number'] = $bookingSnapshot['reference_number'] ?? ($payload['booking']['reference_number'] ?? null);
        $payload['booking']['destination'] = $bookingSnapshot['destination'] ?? ($payload['booking']['destination'] ?? null);
        $payload['booking']['booking_type'] = $bookingSnapshot['booking_type'] ?? ($this->booking?->booking_type instanceof \BackedEnum ? $this->booking->booking_type->value : ($this->booking?->booking_type ?? 'drop_off'));
        $payload['booking']['boxes'] = $lineItemsSnapshot;
        $payload['admin_team'] = $this->resolveAdminTeamSnapshot();

        $pickerName = 'N/A';
        if ($this->booking) {
            $pickupRunsheet = $this->booking->runsheets()->where('type', 'pickup')->first();
            if ($pickupRunsheet && $pickupRunsheet->picker) {
                $pickerName = $pickupRunsheet->picker->name;
            }
        }
        $payload['picker'] = ['name' => $pickerName];

        return $payload;
    }
}
