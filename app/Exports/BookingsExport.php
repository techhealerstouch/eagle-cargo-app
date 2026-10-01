<?php

namespace App\Exports;

use App\Models\Booking;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class BookingsExport implements FromCollection, ShouldAutoSize, WithHeadings, WithMapping, WithStyles
{
    public const ALL_SECTIONS = ['booking', 'sender', 'recipient', 'boxes', 'payment', 'notes'];

    protected ?Collection $bookings;

    protected bool $isTemplate;

    protected array $sections;

    public function __construct(?Collection $bookings = null, bool $isTemplate = false, array $sections = [])
    {
        $this->bookings = $bookings;
        $this->isTemplate = $isTemplate;
        $this->sections = !empty($sections) ? $sections : self::ALL_SECTIONS;
    }

    public function collection(): Collection
    {
        if ($this->isTemplate) {
            return collect([]);
        }

        return $this->bookings ?? Booking::with(['sender', 'boxes.recipient', 'boxes.boxType', 'invoice'])->get();
    }

    public function headings(): array
    {
        if ($this->isTemplate) {
            return [
                'Reference Number',
                'Sender Email',
                'Booking Type',
                'Status',
                'Payment Status',
                'Service Type',
                'Preferred Date',
                'Payment Method',
                'Payment Reference',
                'Notes',
                'Admin Notes',
            ];
        }

        $headers = [];

        if (in_array('booking', $this->sections)) {
            $headers = array_merge($headers, [
                'Reference Number',
                'Booking Type',
                'Service Type',
                'Preferred Date',
                'Status',
                'Created At',
            ]);
        }

        if (in_array('sender', $this->sections)) {
            $headers = array_merge($headers, [
                'Sender Name',
                'Sender Email',
                'Sender Phone',
                'Sender Address',
            ]);
        }

        if (in_array('recipient', $this->sections)) {
            $headers = array_merge($headers, [
                'Recipient Name',
                'Recipient Phone',
                'Destination',
                'Delivery Address',
            ]);
        }

        if (in_array('boxes', $this->sections)) {
            $headers = array_merge($headers, [
                'Box Count',
                'Tracking Numbers',
                'Box Types',
                'Tracking Milestones',
            ]);
        }

        if (in_array('payment', $this->sections)) {
            $headers = array_merge($headers, [
                'Payment Status',
                'Payment Method',
                'Payment Reference',
                'Total Amount (AUD)',
            ]);
        }

        if (in_array('notes', $this->sections)) {
            $headers = array_merge($headers, [
                'Customer Notes',
                'Admin Notes',
            ]);
        }

        return !empty($headers) ? $headers : ['Reference Number'];
    }

    /**
     * @param  Booking  $booking
     */
    public function map($booking): array
    {
        if ($this->isTemplate) {
            return [];
        }

        $row = [];

        if (in_array('booking', $this->sections)) {
            $bookingType = $booking->booking_type instanceof \BackedEnum
                ? $booking->booking_type->value
                : (string) $booking->booking_type;

            $status = $booking->status instanceof \BackedEnum
                ? $booking->status->value
                : (string) $booking->status;

            $row = array_merge($row, [
                $booking->reference_number,
                ucfirst(str_replace('_', ' ', $bookingType)),
                $booking->service_type ? ucfirst(str_replace('_', ' ', $booking->service_type)) : 'Standard',
                $booking->preferred_date ? $booking->preferred_date->format('Y-m-d') : 'N/A',
                ucfirst(str_replace('_', ' ', $status)),
                $booking->created_at ? $booking->created_at->format('Y-m-d H:i:s') : 'N/A',
            ]);
        }

        if (in_array('sender', $this->sections)) {
            $senderName = trim(($booking->sender?->first_name ?? '').' '.($booking->sender?->last_name ?? ''));
            $senderAddress = $booking->sender?->address
                ? trim($booking->sender->address . ', ' . ($booking->sender->suburb ?? '') . ' ' . ($booking->sender->state ?? '') . ' ' . ($booking->sender->postcode ?? ''))
                : 'N/A';

            $row = array_merge($row, [
                $senderName ?: 'N/A',
                $booking->sender?->email ?: 'N/A',
                $booking->sender?->mobile ?: 'N/A',
                $senderAddress,
            ]);
        }

        if (in_array('recipient', $this->sections)) {
            $recipientNames = $booking->boxes->map(fn ($b) => $b->recipient?->name)->filter()->unique()->implode(', ');
            $recipientPhones = $booking->boxes->map(fn ($b) => $b->recipient?->mobile)->filter()->unique()->implode(', ');
            $recipientAddresses = $booking->boxes->map(fn ($b) => $b->recipient?->address ? ($b->recipient->address . ', ' . ($b->recipient->city ?? '')) : null)->filter()->unique()->implode(' | ');
            $destination = $booking->destination ?: ($booking->boxes->map(fn ($b) => $b->recipient?->province)->filter()->first() ?: 'N/A');

            $row = array_merge($row, [
                $recipientNames ?: 'N/A',
                $recipientPhones ?: 'N/A',
                $destination,
                $recipientAddresses ?: 'N/A',
            ]);
        }

        if (in_array('boxes', $this->sections)) {
            $boxCount = $booking->boxes_count ?? $booking->boxes->count();
            $trackingNumbers = $booking->boxes->pluck('tracking_number')->filter()->implode(', ');
            $boxTypes = $booking->boxes->map(fn ($b) => $b->boxType?->name)->filter()->unique()->implode(', ');

            $stepService = app(\App\Services\TrackingStepService::class);
            $milestones = $booking->boxes->map(function ($b) use ($stepService) {
                if ($b->tracking_step_key) {
                    $step = $stepService->getStep($b->tracking_step_key);
                    if ($step && !empty($step['label'])) {
                        return $step['label'];
                    }
                }
                return $b->status ? ucfirst(str_replace('_', ' ', $b->status instanceof \BackedEnum ? $b->status->value : (string) $b->status)) : null;
            })->filter()->unique()->implode(', ');

            $row = array_merge($row, [
                $boxCount,
                $trackingNumbers ?: 'N/A',
                $boxTypes ?: 'N/A',
                $milestones ?: 'N/A',
            ]);
        }

        if (in_array('payment', $this->sections)) {
            $paymentStatus = $booking->payment_status instanceof \BackedEnum
                ? $booking->payment_status->value
                : (string) $booking->payment_status;

            $totalAmount = $booking->total_amount
                ?? $booking->invoice?->total_amount
                ?? 0;

            $row = array_merge($row, [
                ucfirst(str_replace('_', ' ', $paymentStatus)),
                $booking->payment_method ? strtoupper($booking->payment_method) : 'N/A',
                $booking->payment_reference ?: 'N/A',
                number_format((float) $totalAmount, 2),
            ]);
        }

        if (in_array('notes', $this->sections)) {
            $row = array_merge($row, [
                $booking->notes ?: 'N/A',
                $booking->admin_notes ?: 'N/A',
            ]);
        }

        return !empty($row) ? $row : [$booking->reference_number];
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '1E293B'],
                ],
            ],
        ];
    }
}
