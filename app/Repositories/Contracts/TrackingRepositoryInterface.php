<?php

namespace App\Repositories\Contracts;

use Illuminate\Http\UploadedFile;

interface TrackingRepositoryInterface
{
    /**
     * Get tracking data array for a given Box tracking number or Booking reference number
     */
    public function getTrackingData(string $trackingNumber): ?array;

    /**
     * Upload a declaration form for a given booking ID
     */
    public function uploadDeclaration(int $bookingId, UploadedFile $file, string $status = 'submitted_online'): bool;

    /**
     * Save digital declaration data for a given booking ID
     */
    public function saveDeclarationData(int $bookingId, array $data): bool;

    /**
     * Mask an email address for privacy-safe display (e.g. j***e@domain.com)
     */
    public function maskEmail(?string $email): ?string;

    /**
     * Get the number of remaining declaration email resends allowed for today (max 3 per day).
     */
    public function getRemainingDeclarationResends(\App\Models\Booking $booking): int;
}
