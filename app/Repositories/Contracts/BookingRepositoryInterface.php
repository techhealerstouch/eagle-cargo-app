<?php

namespace App\Repositories\Contracts;

use App\Models\Booking;
use App\Models\Sender;

interface BookingRepositoryInterface
{
    public function createBooking(array $data, ?Sender $sender = null): Booking;

    public function updateBooking(Booking $booking, array $data): Booking;

    public function cancelBooking(Booking $booking): bool;

    public function saveDraft(array $data, Sender $sender, ?Booking $existingDraft = null): Booking;

    public function submitDraft(Booking $draft, array $data): Booking;

    public function assignPickerToRunsheet(Booking $booking, int $pickerId, ?int $runsheetId = null): Booking;

    public function assignToRunsheet(Booking $booking, int $courierId, ?int $runsheetId = null): Booking;
}
