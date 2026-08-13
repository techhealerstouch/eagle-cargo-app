<?php

namespace App\Models;

use App\Concerns\LogsActivity;
use App\Concerns\NormalizesNotes;
use App\Concerns\VersionsEntity;
use App\Enums\BoxStatus;
use App\Enums\RunsheetStatus;
use App\Services\TransactionSnapshotService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Box extends Model
{
    use HasFactory, LogsActivity, NormalizesNotes, SoftDeletes, VersionsEntity;

    protected $fillable = [
        'booking_id',
        'recipient_id',
        'recipient_snapshot',
        'recipient_version_id',
        'snapshot_taken_at',
        'box_type_id',
        'is_custom_size',
        'is_door_to_door',
        'custom_length',
        'custom_width',
        'custom_height',
        'price_charged',
        'price_snapshot',
        'price_is_estimate',
        'batch_id',
        'is_bulging',
        'oversized_surcharge',
        'tracking_number',
        'serial_number',
        'allocation_number',
        'warehouse_location',
        'weight',
        'actual_cbm',
        'status',
        'tracking_step_key',
        'destination',
        'eta_date',
        'eta_message',
        'estimate_delivery_date',
        'estimate_delivery_message',
        'courier_notes',
        'delivery_proof_path',
        'pickup_proof_path',
        'signature_path',
    ];

    protected $casts = [
        'status'             => BoxStatus::class,
        'recipient_snapshot' => 'array',
        'snapshot_taken_at'  => 'datetime',
        'price_snapshot'     => 'decimal:2',
        'is_custom_size'     => 'boolean',
        'is_door_to_door'    => 'boolean',
        'price_is_estimate'  => 'boolean',
        'is_bulging'         => 'boolean',
        'oversized_surcharge'=> 'decimal:2',
        'custom_length'      => 'decimal:2',
        'custom_width'       => 'decimal:2',
        'custom_height'      => 'decimal:2',
        'eta_date'           => 'date',
        'estimate_delivery_date' => 'date',
    ];

    /**
     * Computed volume in cubic metres (L × W × H cm ÷ 1 000 000).
     * Returns null when the box does not use custom dimensions.
     */
    public function getCbmAttribute(): ?float
    {
        if (! $this->is_custom_size || ! $this->custom_length || ! $this->custom_width || ! $this->custom_height) {
            return null;
        }

        return round(
            ((float) $this->custom_length * (float) $this->custom_width * (float) $this->custom_height) / 1_000_000,
            6
        );
    }

    public bool $bypassStatusValidation = false;

    protected $appends = ['destination'];

    /**
     * Set the box status with transition validation.
     *
     * @param  string|BoxStatus  $value
     *
     * @throws \InvalidArgumentException|\RuntimeException
     */
    public function setStatusAttribute($value)
    {
        $newStatus = $value instanceof BoxStatus ? $value : BoxStatus::tryFrom($value);

        if (! $newStatus) {
            $valueStr = is_scalar($value) ? (string) $value : gettype($value);
            throw new \InvalidArgumentException("Invalid status: {$valueStr}");
        }

        if ($this->exists) {
            $originalStatusValue = $this->getOriginal('status');
            $currentStatus = $originalStatusValue instanceof BoxStatus
                ? $originalStatusValue
                : BoxStatus::tryFrom($originalStatusValue);

            // Validation logic (only if changing)
            if (! $this->bypassStatusValidation && $currentStatus && $currentStatus !== $newStatus && ! $currentStatus->canTransitionTo($newStatus)) {
                throw new \RuntimeException("Unauthorized transition from {$currentStatus->value} to {$newStatus->value}");
            }
        }

        $this->attributes['status'] = $newStatus->value;
    }

    public function getDestinationAttribute($value)
    {
        if (! empty($value)) {
            return $value;
        }

        if ($this->recipient) {
            return "{$this->recipient->city}, {$this->recipient->province}";
        }

        return 'N/A';
    }

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function trackingLogs()
    {
        return $this->morphMany(TrackingLog::class, 'trackable')->latest();
    }

    public function batch()
    {
        return $this->belongsTo(Batch::class);
    }

    public function recipient()
    {
        return $this->belongsTo(Recipient::class);
    }

    public function boxType()
    {
        return $this->belongsTo(BoxType::class)->withTrashed();
    }

    public function updates()
    {
        return $this->hasMany(BoxUpdate::class);
    }

    public function latestUpdate()
    {
        return $this->hasOne(BoxUpdate::class)->latestOfMany();
    }

    public function runsheets()
    {
        return $this->belongsToMany(Runsheet::class, 'box_runsheet')
            ->withPivot('sequence')
            ->withTimestamps();
    }

    public function commissions()
    {
        return $this->hasMany(Commission::class);
    }

    /**
     * Check if the box is eligible for an admin/superadmin status update.
     *
     * A box can only be updated when:
     *  - It has an active courier assigned (via a delivery runsheet), OR
     *  - It is currently at the Manila warehouse / sorting facility (received_by_branch).
     */
    public function isEligibleForAdminStatusUpdate(): bool
    {
        // Terminal states cannot be updated
        if ($this->status === BoxStatus::Delivered) {
            return false;
        }

        return true;
    }

    public static function buildSnapshotPayload(self $box): array
    {
        return app(TransactionSnapshotService::class)->boxPayload($box);
    }

    public function resolveRecipientSnapshot(): array
    {
        $snapshotService = app(TransactionSnapshotService::class);
        $liveRecipient = $this->recipient;

        return $snapshotService->mergeLiveWithSnapshot(
            $snapshotService->recipientSnapshot($liveRecipient),
            $this->recipient_snapshot,
        );
    }
}
