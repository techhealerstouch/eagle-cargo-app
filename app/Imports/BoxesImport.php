<?php

namespace App\Imports;

use App\Enums\BoxStatus;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxType;
use App\Models\Recipient;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class BoxesImport implements ToCollection, WithHeadingRow
{
    public int $createdCount = 0;

    public int $updatedCount = 0;

    public array $failures = [];

    public function collection(Collection $rows): void
    {
        foreach ($rows as $index => $row) {
            $rowNumber = $index + 2;

            $bookingRef = trim((string) ($row['booking_reference'] ?? $row['booking_ref'] ?? ''));
            $recipientPhone = trim((string) ($row['recipient_phone'] ?? $row['recipient_phone_number'] ?? ''));
            $boxTypeName = trim((string) ($row['box_type'] ?? ''));
            $trackingNumber = trim((string) ($row['tracking_number'] ?? ''));
            $serialNumber = trim((string) ($row['serial_number'] ?? ''));
            $weight = $row['weight'] ?? null;
            $statusStr = strtolower(trim((string) ($row['status'] ?? 'pending')));
            $destination = trim((string) ($row['destination'] ?? ''));
            $priceCharged = $row['price_charged'] ?? null;
            $isDoorToDoorRaw = strtolower(trim((string) ($row['is_door_to_door'] ?? '')));
            $isDoorToDoor = in_array($isDoorToDoorRaw, ['1', 'true', 'yes', 'y'], true);
            $warehouseLocation = trim((string) ($row['warehouse_location'] ?? ''));
            $courierNotes = trim((string) ($row['courier_notes'] ?? ''));

            // Skip empty rows
            if (empty($bookingRef) && empty($trackingNumber) && empty($serialNumber)) {
                continue;
            }

            $validator = Validator::make([
                'booking_reference' => $bookingRef,
            ], [
                'booking_reference' => 'required|string',
            ]);

            if ($validator->fails()) {
                $this->failures[] = [
                    'row' => $rowNumber,
                    'errors' => $validator->errors()->all(),
                ];

                continue;
            }

            $booking = Booking::where('reference_number', $bookingRef)->first();
            if (! $booking) {
                $this->failures[] = [
                    'row' => $rowNumber,
                    'errors' => ["Booking with reference '{$bookingRef}' not found."],
                ];

                continue;
            }

            // Resolve Recipient if phone provided
            $recipientId = null;
            if (! empty($recipientPhone)) {
                $recipient = Recipient::where('sender_id', $booking->sender_id)
                    ->where('phone_number', $recipientPhone)
                    ->first();
                if ($recipient) {
                    $recipientId = $recipient->id;
                }
            }

            // Fallback to first recipient of booking's existing boxes if none found
            if (! $recipientId && $booking->boxes()->exists()) {
                $recipientId = $booking->boxes()->value('recipient_id');
            }

            // Resolve BoxType if provided
            $boxTypeId = null;
            if (! empty($boxTypeName)) {
                $boxType = BoxType::where('name', 'like', "%{$boxTypeName}%")->first();
                if ($boxType) {
                    $boxTypeId = $boxType->id;
                }
            }

            // Parse box status
            $status = BoxStatus::tryFrom($statusStr);
            if (! $status) {
                foreach (BoxStatus::cases() as $case) {
                    if (strcasecmp($case->value, $statusStr) === 0 || strcasecmp($case->name, $statusStr) === 0) {
                        $status = $case;
                        break;
                    }
                }
                if (! $status) {
                    $status = BoxStatus::Pending;
                }
            }

            $box = null;
            if (! empty($trackingNumber)) {
                $box = Box::where('tracking_number', $trackingNumber)->first();
            }

            if ($box) {
                $box->bypassStatusValidation = true;
                $updateData = [
                    'booking_id' => $booking->id,
                    'status' => $status,
                ];

                if ($recipientId) {
                    $updateData['recipient_id'] = $recipientId;
                }
                if ($boxTypeId) {
                    $updateData['box_type_id'] = $boxTypeId;
                }
                if (! empty($serialNumber)) {
                    $updateData['serial_number'] = $serialNumber;
                }
                if ($weight !== null && $weight !== '') {
                    $updateData['weight'] = (float) $weight;
                }
                if (! empty($destination)) {
                    $updateData['destination'] = $destination;
                }
                if ($priceCharged !== null && $priceCharged !== '') {
                    $updateData['price_charged'] = (float) $priceCharged;
                }
                $updateData['is_door_to_door'] = $isDoorToDoor;
                if (! empty($warehouseLocation)) {
                    $updateData['warehouse_location'] = $warehouseLocation;
                }
                if (! empty($courierNotes)) {
                    $updateData['courier_notes'] = $courierNotes;
                }

                $box->update($updateData);
                $this->updatedCount++;
            } else {
                $createData = [
                    'booking_id' => $booking->id,
                    'recipient_id' => $recipientId,
                    'box_type_id' => $boxTypeId,
                    'status' => $status,
                    'serial_number' => ! empty($serialNumber) ? $serialNumber : null,
                    'weight' => ($weight !== null && $weight !== '') ? (float) $weight : null,
                    'destination' => ! empty($destination) ? $destination : null,
                    'price_charged' => ($priceCharged !== null && $priceCharged !== '') ? (float) $priceCharged : 0.0,
                    'is_door_to_door' => $isDoorToDoor,
                    'warehouse_location' => ! empty($warehouseLocation) ? $warehouseLocation : null,
                    'courier_notes' => ! empty($courierNotes) ? $courierNotes : null,
                ];

                if (! empty($trackingNumber)) {
                    $createData['tracking_number'] = $trackingNumber;
                }

                $newBox = new Box($createData);
                $newBox->bypassStatusValidation = true;
                $newBox->save();
                $this->createdCount++;
            }
        }
    }
}
