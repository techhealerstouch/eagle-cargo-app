<?php

namespace App\Repositories\Contracts;

use App\Models\Box;
use Illuminate\Http\UploadedFile;

interface BoxRepositoryInterface
{
    /**
     * Find a box by its tracking number
     */
    public function findByTrackingNumber(string $trackingNumber): ?Box;

    /**
     * Find a box by staff-facing serial number or public tracking number.
     */
    public function findByIdentifier(string $identifier): ?Box;

    /**
     * Load relations for the detailed box view
     */
    public function loadBoxDetails(Box $box): Box;

    /**
     * Update the status of a box and create a timeline update
     */
    public function updateStatus(
        Box $box,
        string $status,
        ?string $notes,
        int $courierId,
        ?int $areaMilestoneId = null,
        ?UploadedFile $deliveryProof = null,
        ?string $trackingPhase = null,
        ?string $signature = null,
        ?string $deliveryOverrideReason = null,
        ?UploadedFile $pickupProof = null,
        bool $bypassValidation = false,
        ?string $serialNumber = null,
        ?string $trackingStepKey = null
    ): void;

    /**
     * Get aggregate statistics for a courier's assigned boxes
     */
    public function getStatsByCourier(int $courierId): array;
}
