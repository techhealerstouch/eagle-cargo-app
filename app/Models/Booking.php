<?php

namespace App\Models;

use App\Concerns\LogsActivity;
use App\Concerns\NormalizesNotes;
use App\Concerns\VersionsEntity;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Services\TransactionSnapshotService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

/**
 * @property \Illuminate\Database\Eloquent\Collection<int, \App\Models\Box> $boxes
 * @property \Illuminate\Support\Carbon|null $preferred_date
 * @property \Illuminate\Support\Carbon|null $confirmed_at
 * @property \Illuminate\Support\Carbon|null $shipped_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class Booking extends Model
{
    use HasFactory, LogsActivity, NormalizesNotes, SoftDeletes, VersionsEntity;

    protected $fillable = [
        'sender_id',
        'sender_snapshot',
        'primary_recipient_snapshot',
        'sender_version_id',
        'recipient_version_id',
        'snapshot_taken_at',
        'reference_number',
        'initialization_key',
        'service_type',
        'status',
        'preferred_date',
        'payment_status',
        'payment_overridden_at',
        'payment_overridden_by',
        'proof_of_payment',
        'payment_reference',
        'declaration_form_status',
        'declaration_form_path',
        'notes',
        'payment_method',
        'admin_notes',
        'confirmed_at',
        'shipped_at',
        'declaration_data',
        'is_manual',
        'empty_box_count',
        'empty_box_fee',
        'pickup_zone_id',
        'attention_required',
    ];

    protected $hidden = ['admin_notes'];

    protected $casts = [
        'preferred_date' => 'date',
        'confirmed_at' => 'datetime',
        'shipped_at' => 'datetime',
        'payment_overridden_at' => 'datetime',
        'sender_snapshot' => 'array',
        'primary_recipient_snapshot' => 'array',
        'snapshot_taken_at' => 'datetime',
        'status' => BookingStatus::class,
        'payment_status' => PaymentStatus::class,
        'declaration_data' => 'array',
        'is_manual' => 'boolean',
        'empty_box_count' => 'integer',
        'empty_box_fee' => 'decimal:2',
        'attention_required' => 'boolean',
    ];

    protected $appends = ['destination', 'recipient_name', 'delivery_progress', 'undelivered_boxes_count', 'boxes_without_serial_count'];

    /**
     * Set the booking status with transition validation.
     *
     * @param  string|BookingStatus  $value
     *
     * @throws \InvalidArgumentException|\RuntimeException
     */
    public bool $bypassStatusValidation = false;

    public function setStatusAttribute($value)
    {
        $newStatus = $value instanceof BookingStatus ? $value : BookingStatus::tryFrom($value);

        if (! $newStatus) {
            $valueStr = is_scalar($value) ? (string) $value : gettype($value);
            throw new \InvalidArgumentException("Invalid status: {$valueStr}");
        }

        if ($this->exists) {
            $originalStatusValue = $this->getOriginal('status');
            $currentStatus = $originalStatusValue instanceof BookingStatus
                ? $originalStatusValue
                : BookingStatus::tryFrom($originalStatusValue);

            // Validation logic (only if changing)
            if (! $this->bypassStatusValidation && $currentStatus && $currentStatus !== $newStatus && ! $currentStatus->canTransitionTo($newStatus)) {
                throw new \RuntimeException("Unauthorized transition from {$currentStatus->value} to {$newStatus->value}");
            }
        }

        $this->attributes['status'] = $newStatus->value;
    }

    public function sender()
    {
        return $this->belongsTo(Sender::class);
    }

    public function pickupZone()
    {
        return $this->belongsTo(PickupZone::class);
    }

    public function paymentOverriddenByUser()
    {
        return $this->belongsTo(User::class, 'payment_overridden_by');
    }

    public function getUndeliveredBoxesCountAttribute(): int
    {
        if ($this->relationLoaded('boxes')) {
            return $this->boxes->where('status', '!=', BoxStatus::Delivered->value)->count();
        }

        return $this->boxes()->where('status', '!=', BoxStatus::Delivered->value)->count();
    }

    public function getBoxesWithoutSerialCountAttribute(): int
    {
        if ($this->relationLoaded('boxes')) {
            return $this->boxes->whereNull('serial_number')->count();
        }

        return $this->boxes()->whereNull('serial_number')->count();
    }

    public function getDeliveryProgressAttribute(): ?string
    {
        if (! in_array($this->status, [BookingStatus::Shipped, BookingStatus::PartiallyDelivered, BookingStatus::Delivered])) {
            return null;
        }

        if ($this->relationLoaded('boxes')) {
            $totalBoxes = $this->boxes->count();
            if ($totalBoxes === 0) {
                return null;
            }
            $deliveredBoxes = $this->boxes->where('status', BoxStatus::Delivered->value)->count();
        } else {
            $totalBoxes = $this->boxes()->count();
            if ($totalBoxes === 0) {
                return null;
            }
            $deliveredBoxes = $this->boxes()->where('status', BoxStatus::Delivered->value)->count();
        }

        return "{$deliveredBoxes}/{$totalBoxes}";
    }

    public function getRecipientNameAttribute()
    {
        $box = $this->relationLoaded('boxes')
            ? $this->boxes->first()
            : $this->boxes()->with('recipient')->first();

        return $box?->recipient?->name ?? 'N/A';
    }

    public function getDestinationAttribute()
    {
        $box = $this->relationLoaded('boxes')
            ? $this->boxes->first()
            : $this->boxes()->with('recipient')->first();

        if ($box) {
            if (! empty($box->destination)) {
                return (string) $box->destination;
            }

            $recipient = $box->relationLoaded('recipient')
                ? $box->recipient
                : $box->recipient()->first();

            if ($recipient) {
                return "{$recipient->city}, {$recipient->province}";
            }
        }

        return 'N/A';
    }

    public function boxes()
    {
        return $this->hasMany(Box::class);
    }

    public function trackingLogs()
    {
        return $this->morphMany(TrackingLog::class, 'trackable')->latest();
    }

    public function needsDeclaration(): bool
    {
        // Cancelled bookings don't need declarations
        if ($this->status === BookingStatus::Cancelled) {
            return false;
        }

        // If explicitly marked as received, we don't need it
        if (in_array($this->declaration_form_status, ['submitted_online', 'physical_copy_received'])) {
            return false;
        }

        // Needs declaration if data is empty AND no file path exists
        return empty($this->declaration_data) && empty($this->declaration_form_path);
    }

    public function invoices()
    {
        return $this->hasMany(Invoice::class);
    }

    public function invoice()
    {
        return $this->hasOne(Invoice::class)->latestOfMany();
    }

    public function undeliveredBoxes()
    {
        return $this->hasMany(Box::class)
            ->whereNotIn('status', [BoxStatus::Delivered->value, BoxStatus::Cancelled->value]);
    }

    public function runsheets()
    {
        return $this->belongsToMany(Runsheet::class)
            ->withPivot('sequence')
            ->withTimestamps();
    }

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeUnassigned($query)
    {
        return $query->doesntHave('runsheets');
    }

    /**
     * Scope a query to include only potential duplicate bookings.
     * Filtered for those that are duplicates of an OLDER booking.
     *
     * Bug 7 fix: apply time-window and status filters at the DB level so we
     * never load the entire bookings table into PHP memory.
     */
    public function scopePotentialDuplicates($query, $hours = 24)
    {
        return $query
            ->where('status', '!=', BookingStatus::Cancelled->value)
            ->where('created_at', '>=', now()->subHours($hours))
            ->with('boxes') // eager-load to avoid N+1 inside isPotentialDuplicate
            ->get()
            ->filter(fn ($booking) => $booking->isPotentialDuplicate($hours))
            ->pluck('id')
            ->toArray(); // Ensure it returns an array
    }

    /**
     * Determine if this booking is a potential duplicate within a given timeframe.
     *
     * Fairness rule: only newer bookings are flagged when an older equivalent booking exists.
     */
    public function isPotentialDuplicate($hours = 24): bool
    {
        $statusValue = $this->status instanceof \BackedEnum
            ? (string) $this->status->value
            : (string) $this->status;

        if ($statusValue === BookingStatus::Cancelled->value) {
            return false;
        }

        // Use relation if loaded, otherwise direct query
        $recipientIds = $this->relationLoaded('boxes')
            ? $this->boxes->pluck('recipient_id')->sort()->values()
            : DB::table('boxes')
                ->where('booking_id', $this->id)
                ->pluck('recipient_id')
                ->sort()
                ->values();

        if ($recipientIds->isEmpty()) {
            return false;
        }

        $thisRawCreatedAt = $this->getRawOriginal('created_at') ?: $this->created_at;
        $thisCreatedAt = Carbon::parse($thisRawCreatedAt);

        // Only compare against bookings from the same sender in the relevant time window.
        // Eager load boxes to avoid N+1 queries when plucking duplicate recipient IDs below.
        /** @var Collection<int, self> $others */
        $others = self::query()
            ->where('sender_id', $this->sender_id)
            ->where('id', '!=', $this->id)
            ->where('created_at', '<=', $thisCreatedAt)
            ->where('created_at', '>=', (clone $thisCreatedAt)->subHours($hours))
            ->with('boxes')
            ->get();

        foreach ($others as $other) {
            /** @var self $other */
            $otherStatusValue = $other->status instanceof \BackedEnum
                ? (string) $other->status->value
                : (string) $other->status;

            if ($otherStatusValue === BookingStatus::Cancelled->value) {
                continue;
            }

            $otherRawCreatedAt = $other->getRawOriginal('created_at') ?: $other->created_at;
            $otherCreatedAt = Carbon::parse($otherRawCreatedAt);

            // Fairness: if the other booking is newer, this booking is not a duplicate of it.
            if ($otherCreatedAt->gt($thisCreatedAt)) {
                continue;
            }

            // Tie-break for same-second timestamps: lower ID is the original.
            if ($otherCreatedAt->eq($thisCreatedAt) && (int) $other->id >= (int) $this->id) {
                continue;
            }

            if ($thisCreatedAt->diffInHours($otherCreatedAt) > $hours) {
                continue;
            }

            $otherRecipientIds = $other->relationLoaded('boxes')
                ? $other->boxes->pluck('recipient_id')->sort()->values()
                : DB::table('boxes')
                    ->where('booking_id', $other->id)
                    ->pluck('recipient_id')
                    ->sort()
                    ->values();

            if (
                $recipientIds->count() === $otherRecipientIds->count()
                && $recipientIds->diff($otherRecipientIds)->isEmpty()
            ) {
                return true;
            }
        }

        return false;
    }

    public function hasCompletedPickupRunsheet(): bool
    {
        return $this->runsheets()
            ->where('type', RunsheetType::Pickup->value)
            ->where('status', RunsheetStatus::Completed->value)
            ->exists();
    }

    public function hasActiveRunsheetOfType(RunsheetType $type): bool
    {
        return $this->runsheets()
            ->where('type', $type->value)
            ->whereIn('status', RunsheetStatus::activeValues())
            ->exists();
    }

    public function hasWarehouseHandoffCompleted(): bool
    {
        if ($this->relationLoaded('boxes')) {
            $boxes = $this->boxes;
        } else {
            $boxes = $this->boxes()->get();
        }

        if ($boxes->isEmpty()) {
            return false;
        }

        // Check if every box has completed warehouse handoff
        foreach ($boxes as $box) {
            if ($box->relationLoaded('updates')) {
                $updates = $box->updates;
            } else {
                $updates = $box->updates()->get();
            }

            $hasHandoff = $updates->contains(function ($update) {
                $phase = $update->tracking_phase instanceof \BackedEnum
                    ? $update->tracking_phase->value
                    : $update->tracking_phase;

                if (in_array($phase, [
                    'received_manila_warehouse',
                    'sorting',
                    'dispatched_to_local_hub',
                ], true)) {
                    return true;
                }

                if ($update->relationLoaded('milestone')) {
                    $milestone = $update->milestone;
                } else {
                    $milestone = $update->milestone()->first();
                }

                return $milestone && $milestone->is_warehouse_handoff;
            });

            if (! $hasHandoff) {
                return false;
            }
        }

        return true;
    }

    public static function buildSnapshotPayload(self $booking): array
    {
        return app(TransactionSnapshotService::class)->bookingPayload($booking);
    }

    public function resolveSenderSnapshot(): array
    {
        $snapshotService = app(TransactionSnapshotService::class);
        $liveSender = $this->sender;

        return $snapshotService->mergeLiveWithSnapshot(
            $snapshotService->senderSnapshot($liveSender),
            $this->sender_snapshot,
        );
    }

    public function resolvePrimaryRecipientSnapshot(): array
    {
        $snapshotService = app(TransactionSnapshotService::class);
        $primaryBox = $this->boxes->first();
        $liveRecipient = $primaryBox?->recipient;

        return $snapshotService->mergeLiveWithSnapshot(
            $snapshotService->recipientSnapshot($liveRecipient),
            $this->primary_recipient_snapshot,
        );
    }

    public function toHistoricalPayload(): array
    {
        return app(TransactionSnapshotService::class)->bookingHistoricalPayload($this);
    }
}
