<?php

namespace App\Exports;

use App\Models\Box;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class BoxesExport implements FromCollection, ShouldAutoSize, WithHeadings, WithMapping, WithStyles
{
    protected ?Collection $boxes;

    protected bool $isTemplate;

    public function __construct(?Collection $boxes = null, bool $isTemplate = false)
    {
        $this->boxes = $boxes;
        $this->isTemplate = $isTemplate;
    }

    public function collection(): Collection
    {
        if ($this->isTemplate) {
            return collect([]);
        }

        return $this->boxes ?? Box::with(['booking', 'recipient', 'boxType'])->get();
    }

    public function headings(): array
    {
        if ($this->isTemplate) {
            return [
                'Booking Reference',
                'Recipient Phone',
                'Box Type',
                'Tracking Number',
                'Serial Number',
                'Weight',
                'Status',
                'Destination',
                'Price Charged',
                'Is Door To Door',
                'Warehouse Location',
                'Courier Notes',
            ];
        }

        return [
            'Booking Reference',
            'Recipient Phone',
            'Recipient Name',
            'Box Type',
            'Tracking Number',
            'Serial Number',
            'Weight',
            'Status',
            'Destination',
            'Price Charged',
            'Is Door To Door',
            'Warehouse Location',
            'Courier Notes',
            'Created At',
        ];
    }

    /**
     * @param  Box  $box
     */
    public function map($box): array
    {
        if ($this->isTemplate) {
            return [];
        }

        $status = $box->status instanceof \BackedEnum
            ? $box->status->value
            : (string) $box->status;

        return [
            $box->booking?->reference_number,
            $box->recipient?->phone_number,
            $box->recipient?->name ?? 'N/A',
            $box->boxType?->name ?? ($box->is_custom_size ? 'Custom' : 'Standard'),
            $box->tracking_number,
            $box->serial_number,
            $box->weight,
            $status,
            $box->destination,
            $box->price_charged,
            $box->is_door_to_door ? 'Yes' : 'No',
            $box->warehouse_location,
            $box->courier_notes,
            $box->created_at?->format('Y-m-d H:i:s'),
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
