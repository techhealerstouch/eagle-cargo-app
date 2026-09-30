<?php

namespace App\Imports;

use App\Enums\BookingStatus;
use App\Enums\BookingType;
use App\Enums\PaymentStatus;
use App\Models\Booking;
use App\Models\Sender;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class BookingsImport implements ToCollection, WithHeadingRow
{
    public int $createdCount = 0;

    public int $updatedCount = 0;

    public array $failures = [];

    public function collection(Collection $rows): void
    {
        foreach ($rows as $index => $row) {
            $rowNumber = $index + 2;

            $senderEmail = strtolower(trim((string) ($row['sender_email'] ?? '')));
            $referenceNumber = trim((string) ($row['reference_number'] ?? ''));
            $statusStr = strtolower(trim((string) ($row['status'] ?? 'pending')));
            $bookingTypeStr = strtolower(trim((string) ($row['booking_type'] ?? 'home_pickup')));
            $paymentStatusStr = strtolower(trim((string) ($row['payment_status'] ?? 'pending')));
            $serviceType = trim((string) ($row['service_type'] ?? ''));
            $preferredDateRaw = $row['preferred_date'] ?? null;
            $paymentMethod = trim((string) ($row['payment_method'] ?? ''));
            $paymentReference = trim((string) ($row['payment_reference'] ?? ''));
            $notes = trim((string) ($row['notes'] ?? ''));
            $adminNotes = trim((string) ($row['admin_notes'] ?? ''));

            // Skip completely empty rows
            if (empty($senderEmail) && empty($referenceNumber) && empty($statusStr)) {
                continue;
            }

            $validator = Validator::make([
                'sender_email' => $senderEmail,
                'status' => $statusStr,
                'payment_status' => $paymentStatusStr,
            ], [
                'sender_email' => 'required|email',
                'status' => 'required|string',
                'payment_status' => 'required|string',
            ]);

            if ($validator->fails()) {
                $this->failures[] = [
                    'row' => $rowNumber,
                    'errors' => $validator->errors()->all(),
                ];

                continue;
            }

            $sender = Sender::where('email', $senderEmail)->first();
            if (! $sender) {
                $this->failures[] = [
                    'row' => $rowNumber,
                    'errors' => ["Sender with email '{$senderEmail}' not found. Please create or import the sender first."],
                ];

                continue;
            }

            // Parse status enum or normalize
            $status = BookingStatus::tryFrom($statusStr);
            if (! $status) {
                // Try case-insensitive matching
                foreach (BookingStatus::cases() as $case) {
                    if (strcasecmp($case->value, $statusStr) === 0 || strcasecmp($case->name, $statusStr) === 0) {
                        $status = $case;
                        break;
                    }
                }
                if (! $status) {
                    $status = BookingStatus::Pending;
                }
            }

            // Parse payment status
            $paymentStatus = PaymentStatus::tryFrom($paymentStatusStr);
            if (! $paymentStatus) {
                foreach (PaymentStatus::cases() as $case) {
                    if (strcasecmp($case->value, $paymentStatusStr) === 0 || strcasecmp($case->name, $paymentStatusStr) === 0) {
                        $paymentStatus = $case;
                        break;
                    }
                }
                if (! $paymentStatus) {
                    $paymentStatus = PaymentStatus::Pending;
                }
            }

            // Parse booking type
            $bookingType = BookingType::tryFrom($bookingTypeStr);
            if (! $bookingType) {
                foreach (BookingType::cases() as $case) {
                    if (strcasecmp($case->value, $bookingTypeStr) === 0 || strcasecmp($case->name, $bookingTypeStr) === 0) {
                        $bookingType = $case;
                        break;
                    }
                }
            }

            // Parse preferred date
            $preferredDate = null;
            if (! empty($preferredDateRaw)) {
                try {
                    if (is_numeric($preferredDateRaw)) {
                        $preferredDate = ExcelDate::excelToDateTimeObject($preferredDateRaw)->format('Y-m-d');
                    } else {
                        $preferredDate = Carbon::parse($preferredDateRaw)->format('Y-m-d');
                    }
                } catch (\Throwable $e) {
                    $preferredDate = null;
                }
            }

            $booking = null;
            if (! empty($referenceNumber)) {
                $booking = Booking::where('reference_number', $referenceNumber)->first();
            }

            if ($booking) {
                $booking->bypassStatusValidation = true;
                $updateData = [
                    'sender_id' => $sender->id,
                    'status' => $status,
                    'payment_status' => $paymentStatus,
                ];

                if ($bookingType) {
                    $updateData['booking_type'] = $bookingType;
                }
                if (! empty($serviceType)) {
                    $updateData['service_type'] = $serviceType;
                }
                if ($preferredDate) {
                    $updateData['preferred_date'] = $preferredDate;
                }
                if (! empty($paymentMethod)) {
                    $updateData['payment_method'] = $paymentMethod;
                }
                if (! empty($paymentReference)) {
                    $updateData['payment_reference'] = $paymentReference;
                }
                if (! empty($notes)) {
                    $updateData['notes'] = $notes;
                }
                if (! empty($adminNotes)) {
                    $updateData['admin_notes'] = $adminNotes;
                }

                $booking->update($updateData);
                $this->updatedCount++;
            } else {
                $createData = [
                    'sender_id' => $sender->id,
                    'status' => $status,
                    'booking_type' => $bookingType ?? BookingType::HomePickup,
                    'payment_status' => $paymentStatus,
                    'service_type' => ! empty($serviceType) ? $serviceType : 'standard',
                    'preferred_date' => $preferredDate,
                    'payment_method' => ! empty($paymentMethod) ? $paymentMethod : null,
                    'payment_reference' => ! empty($paymentReference) ? $paymentReference : null,
                    'notes' => ! empty($notes) ? $notes : null,
                    'admin_notes' => ! empty($adminNotes) ? $adminNotes : null,
                    'is_manual' => true,
                ];

                if (! empty($referenceNumber)) {
                    $createData['reference_number'] = $referenceNumber;
                }

                $newBooking = new Booking($createData);
                $newBooking->bypassStatusValidation = true;
                $newBooking->save();
                $this->createdCount++;
            }
        }
    }
}
