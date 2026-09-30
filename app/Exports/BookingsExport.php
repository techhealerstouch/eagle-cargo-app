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
    protected ?Collection $bookings;

    protected bool $isTemplate;

    public function __construct(?Collection $bookings = null, bool $isTemplate = false)
    {
        $this->bookings = $bookings;
        $this->isTemplate = $isTemplate;
    }

    public function collection(): Collection
    {
        if ($this->isTemplate) {
            return collect([]);
        }

        return $this->bookings ?? Booking::with(['sender', 'boxes.recipient'])->get();
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

        return [
            'Reference Number',
            'Sender Email',
            'Sender Name',
            'Booking Type',
            'Status',
            'Payment Status',
            'Service Type',
            'Preferred Date',
            'Payment Method',
            'Payment Reference',
            'Notes',
            'Admin Notes',
            'Destination',
            'Box Count',
            'Created At',
        ];
    }

    /**
     * @param  Booking  $booking
     */
    public function map($booking): array
    {
        if ($this->isTemplate) {
            return [];
        }

        $bookingType = $booking->booking_type instanceof \BackedEnum
            ? $booking->booking_type->value
            : (string) $booking->booking_type;

        $status = $booking->status instanceof \BackedEnum
            ? $booking->status->value
            : (string) $booking->status;

        $paymentStatus = $booking->payment_status instanceof \BackedEnum
            ? $booking->payment_status->value
            : (string) $booking->payment_status;

        $senderName = trim(($booking->sender?->first_name ?? '').' '.($booking->sender?->last_name ?? ''));

        return [
            $booking->reference_number,
            $booking->sender?->email,
            $senderName ?: 'N/A',
            $bookingType,
            $status,
            $paymentStatus,
            $booking->service_type,
            $booking->preferred_date?->format('Y-m-d'),
            $booking->payment_method,
            $booking->payment_reference,
            $booking->notes,
            $booking->admin_notes,
            $booking->destination,
            $booking->boxes_count ?? $booking->boxes->count(),
            $booking->created_at?->format('Y-m-d H:i:s'),
        ];
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
