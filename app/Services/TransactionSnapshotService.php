<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Invoice;
use App\Models\Recipient;
use App\Models\Sender;
use App\Services\ReferenceDataService;

/**
 * Service for managing transactional data snapshots.
 *
 * This service creates point-in-time snapshots of transaction entities
 * (Bookings, Boxes, Invoices, Senders, Recipients) for audit and historical
 * reference purposes. Snapshots preserve the state of related entities
 * at the time of important events like invoice generation or payment processing.
 *
 * Key Features:
 * - Immutable snapshots stored in model JSON fields
 * - Version tracking via EntityVersionService
 * - Merge live data with historical snapshots for reconciliation
 * - Line item snapshots for invoice generation
 *
 * @see EntityVersionService
 * @see Booking
 * @see Box
 * @see Invoice
 */
class TransactionSnapshotService
{
    public function __construct(private readonly EntityVersionService $entityVersionService) {}

    public function invoicePayloadForBooking(Booking $booking): array
    {
        $booking = $booking->loadMissing([
            'sender',
            'boxes.boxType',
            'boxes.recipient',
            'boxes.batch',
        ]);

        $sender = $booking->sender;
        $boxes = $booking->boxes;
        $adminLogs = ActivityLog::where('model_type', Booking::class)
            ->where('model_id', $booking->id)
            ->whereIn('action', ['created', 'updated'])
            ->with('user')
            ->latest()
            ->get();

        $adminUser = $adminLogs->first()?->user;

        return [
            'sender_snapshot' => $this->senderSnapshot($sender),
            'booking_snapshot' => $this->bookingSnapshot($booking),
            'line_items_snapshot' => $this->lineItemsSnapshot($boxes, $booking),
            'admin_team_snapshot' => [
                'name' => $adminUser?->name ?? 'Admin',
            ],
            'snapshot_taken_at' => now(),
            'booking_version_id' => $booking->exists ? $this->entityVersionService->latestVersionId($booking) : null,
            'sender_version_id' => ($sender && $sender->exists) ? $this->entityVersionService->latestVersionId($sender) : null,
        ];
    }

    public function bookingPayload(Booking $booking): array
    {
        $booking = $booking->loadMissing([
            'sender',
            'boxes.recipient',
        ]);

        $sender = $booking->sender;
        $primaryRecipient = $booking->boxes->pluck('recipient')->filter()->first();

        return [
            'sender_snapshot' => $this->senderSnapshot($sender),
            'primary_recipient_snapshot' => $this->recipientSnapshot($primaryRecipient),
            'sender_version_id' => ($sender && $sender->exists) ? $this->entityVersionService->latestVersionId($sender) : null,
            'recipient_version_id' => ($primaryRecipient && $primaryRecipient->exists) ? $this->entityVersionService->latestVersionId($primaryRecipient) : null,
            'snapshot_taken_at' => now(),
        ];
    }

    public function boxPayload(Box $box): array
    {
        $box = $box->loadMissing('recipient');
        $recipient = $box->recipient;
        $recipientSnapshot = $this->recipientSnapshot($recipient);

        return [
            'destination' => $this->resolvedBoxDestination($box, $recipientSnapshot),
            'recipient_snapshot' => $recipientSnapshot,
            'recipient_version_id' => ($recipient && $recipient->exists) ? $this->entityVersionService->latestVersionId($recipient) : null,
            'price_snapshot' => $box->price_charged,
            'snapshot_taken_at' => now(),
        ];
    }

    public function paymentPayloadForInvoice(Invoice $invoice): array
    {
        $invoice = $invoice->loadMissing('booking');

        return [
            'invoice_snapshot' => $this->invoiceSnapshot($invoice),
            'invoice_version_id' => $invoice->exists ? $this->entityVersionService->latestVersionId($invoice) : null,
            'snapshot_taken_at' => now(),
        ];
    }

    public function bookingHistoricalPayload(Booking $booking): array
    {
        $booking = $booking->loadMissing([
            'sender',
            'boxes.recipient',
            'boxes.boxType',
            'trackingLogs',
        ]);

        $payload = $booking->toArray();
        $payload['sender'] = $this->mergeLiveWithSnapshot(
            $this->senderSnapshot($booking->sender),
            $booking->sender_snapshot,
        );

        $payload['boxes'] = $booking->boxes->map(function (Box $box): array {
            return $this->boxHistoricalPayload($box);
        })->values()->all();

        $payload['invoice'] = $this->invoiceSnapshot($booking->invoice);

        $primaryRecipient = $this->primaryRecipientFromBookingPayload($payload);
        if (! empty($primaryRecipient)) {
            $payload['recipient_name'] = $payload['recipient_name'] ?? ($primaryRecipient['name'] ?? null);
            $payload['recipient_phone'] = $payload['recipient_phone'] ?? ($primaryRecipient['phone_number'] ?? null);
        }

        if (empty($payload['destination']) || $payload['destination'] === 'N/A') {
            $payload['destination'] = $payload['boxes'][0]['destination'] ?? $this->destinationFromSnapshot($primaryRecipient) ?? 'N/A';
        }

        return $payload;
    }

    public function boxHistoricalPayload(Box $box): array
    {
        $box = $box->loadMissing([
            'recipient',
            'boxType',
            'trackingLogs',
        ]);

        $payload = $box->toArray();
        $recipientPayload = $this->mergeLiveWithSnapshot(
            $this->recipientSnapshot($box->recipient),
            $box->recipient_snapshot,
        );

        $payload['recipient'] = $recipientPayload;
        $payload['price_charged'] = (float) ($box->price_snapshot ?? $box->price_charged ?? 0);
        $payload['destination'] = $this->resolvedBoxDestination($box, $recipientPayload);

        if (! isset($payload['box_type'])) {
            $payload['box_type'] = [
                'id' => $box->boxType?->id,
                'name' => $box->boxType?->name,
                'dimensions' => $box->boxType?->dimensions,
            ];
        }

        return $payload;
    }

    public function lineItemsSnapshot(mixed $boxes, ?Booking $booking = null): array
    {
        if ($boxes instanceof Box) {
            $boxes = [$boxes];
        } elseif (! is_iterable($boxes)) {
            $boxes = [];
        }

        $items = [];
        $firstBox = is_array($boxes) ? ($boxes[0] ?? null) : (method_exists($boxes, 'first') ? $boxes->first() : null);
        $booking = $booking ?? $firstBox?->booking;

        foreach ($boxes as $box) {
            if (! $box instanceof Box) {
                continue;
            }

            $areaId = $box->recipient?->area_id ?? $box->area_id;
            $doorToDoorFee = ($box->is_door_to_door && $areaId)
                ? (float) app(ReferenceDataService::class)->doorToDoorFeeFor($areaId)
                : 0.0;

            $items[] = [
                'id' => $box->id,
                'tracking_number' => $box->tracking_number,
                'serial_number' => $box->serial_number,
                'batch_number' => $box->batch?->batch_number,
                'price_charged' => (float) ($box->price_snapshot ?? $box->price_charged ?? 0),
                'is_door_to_door' => (bool) $box->is_door_to_door,
                'door_to_door_fee' => $doorToDoorFee,
                'destination' => $this->resolvedBoxDestination($box, is_array($box->recipient_snapshot) ? $box->recipient_snapshot : []),
                'box_type' => [
                    'name' => $box->boxType?->name,
                    'dimensions' => $box->boxType?->dimensions,
                ],
                'is_bulging' => (bool) $box->is_bulging,
                'oversized_surcharge' => (float) $box->oversized_surcharge,
            ];
        }

        if ($booking && ($booking->empty_box_count ?? 0) > 0) {
            $count = (int) $booking->empty_box_count;
            $fee = (float) ($booking->empty_box_fee ?? 10.00);
            $items[] = [
                'id' => 'empty_box_' . $booking->id,
                'is_add_on' => true,
                'item_type' => 'empty_box',
                'item_name' => 'Empty Box Delivery (' . $count . ' @ $' . number_format($fee, 2) . ')',
                'tracking_number' => 'ADD-ON-EMPTY-BOX',
                'price_charged' => round($count * $fee, 2),
                'destination' => 'N/A',
                'box_type' => [
                    'name' => 'Empty Box Delivery',
                    'dimensions' => 'N/A',
                ],
            ];
        }

        return $items;
    }

    public function senderSnapshot(?Sender $sender): array
    {
        return [
            'id' => $sender?->id,
            'first_name' => $sender?->first_name,
            'last_name' => $sender?->last_name,
            'email' => $sender?->email,
            'mobile' => $sender?->mobile,
            'secondary_mobile' => $sender?->secondary_mobile,
            'phone' => $sender?->mobile,
            'address' => $sender?->address,
            'suburb' => $sender?->suburb,
            'state' => $sender?->state,
            'postcode' => $sender?->postcode,
            'latitude' => $sender?->latitude ? (float) $sender->latitude : null,
            'longitude' => $sender?->longitude ? (float) $sender->longitude : null,
        ];
    }

    public function recipientSnapshot(?Recipient $recipient): array
    {
        return [
            'id' => $recipient?->id,
            'name' => $recipient?->name,
            'phone_number' => $recipient?->phone_number,
            'secondary_phone_number' => $recipient?->secondary_phone_number,
            'address' => $recipient?->address,
            'city' => $recipient?->city,
            'province' => $recipient?->province,
            'zip_code' => $recipient?->zip_code,
            'latitude' => $recipient?->latitude ? (float) $recipient->latitude : null,
            'longitude' => $recipient?->longitude ? (float) $recipient->longitude : null,
        ];
    }

    public function bookingSnapshot(?Booking $booking): array
    {
        if (! $booking) {
            return [
                'id' => null,
                'reference_number' => null,
                'destination' => 'N/A',
                'service_type' => null,
                'booking_type' => null,
                'preferred_date' => null,
            ];
        }

        $destination = $booking->boxes->pluck('destination')->filter()->first() ?? $booking->destination;

        return [
            'id' => $booking->id,
            'reference_number' => $booking->reference_number,
            'destination' => $destination,
            'service_type' => $booking->service_type,
            'booking_type' => $booking->booking_type instanceof \BackedEnum ? $booking->booking_type->value : ($booking->booking_type ?? 'drop_off'),
            'preferred_date' => optional($booking->preferred_date)->format('Y-m-d H:i:s'),
        ];
    }

    public function invoiceSnapshot(?Invoice $invoice): array
    {
        $status = $invoice?->status;

        return [
            'id' => $invoice?->id,
            'invoice_number' => $invoice?->invoice_number,
            'amount' => (float) ($invoice?->amount ?? 0),
            'vat_amount' => (float) ($invoice?->vat_amount ?? 0),
            'vatable_revenue' => (float) ($invoice?->vatable_revenue ?? 0),
            'vat_exempt_revenue' => (float) ($invoice?->vat_exempt_revenue ?? 0),
            'is_vat_inclusive' => (bool) ($invoice?->is_vat_inclusive ?? true),
            'status' => $status instanceof \BackedEnum ? $status->value : $status,
            'booking_id' => $invoice?->booking_id,
            'booking_reference_number' => $invoice?->booking?->reference_number,
        ];
    }

    public function mergeLiveWithSnapshot(array $live, mixed $snapshot): array
    {
        return array_merge($live, is_array($snapshot) ? $snapshot : []);
    }

    public function destinationFromRecipient(?Recipient $recipient): string
    {
        if (! $recipient) {
            return 'N/A';
        }

        return collect([$recipient->city, $recipient->province])->filter()->implode(', ');
    }

    private function resolvedBoxDestination(Box $box, array $recipientSnapshot): string
    {
        $persistedDestination = (string) ($box->getRawOriginal('destination') ?? '');
        if ($persistedDestination !== '') {
            return $persistedDestination;
        }

        $snapshotDestination = $this->destinationFromSnapshot($recipientSnapshot);
        if ($snapshotDestination) {
            return $snapshotDestination;
        }

        if ($box->recipient) {
            return $this->destinationFromRecipient($box->recipient);
        }

        return 'N/A';
    }

    private function destinationFromSnapshot(array $recipientSnapshot): ?string
    {
        $city = $recipientSnapshot['city'] ?? null;
        $province = $recipientSnapshot['province'] ?? null;

        if (! $city && ! $province) {
            return null;
        }

        return collect([$city, $province])->filter()->implode(', ');
    }

    private function primaryRecipientFromBookingPayload(array $bookingPayload): array
    {
        $firstBoxRecipient = data_get($bookingPayload, 'boxes.0.recipient');

        if (is_array($firstBoxRecipient) && ! empty($firstBoxRecipient)) {
            return $firstBoxRecipient;
        }

        $primarySnapshot = $bookingPayload['primary_recipient_snapshot'] ?? null;

        return is_array($primarySnapshot) ? $primarySnapshot : [];
    }
}
