<?php

namespace App\Exports;

use App\Models\Recipient;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class RecipientsExport implements FromCollection, ShouldAutoSize, WithHeadings, WithMapping, WithStyles
{
    protected ?Collection $recipients;

    protected bool $isTemplate;

    public function __construct(?Collection $recipients = null, bool $isTemplate = false)
    {
        $this->recipients = $recipients;
        $this->isTemplate = $isTemplate;
    }

    public function collection(): Collection
    {
        if ($this->isTemplate) {
            return collect([]);
        }

        return $this->recipients ?? Recipient::with('sender')->get();
    }

    public function headings(): array
    {
        if ($this->isTemplate) {
            return [
                'Sender Email',
                'First Name',
                'Last Name',
                'Full Name',
                'Email',
                'Phone Number',
                'Secondary Phone',
                'Address',
                'City',
                'Province',
                'Zip Code',
                'Landmarks',
            ];
        }

        return [
            'Sender Email',
            'First Name',
            'Last Name',
            'Full Name',
            'Email',
            'Phone Number',
            'Secondary Phone',
            'Address',
            'City',
            'Province',
            'Zip Code',
            'Landmarks',
            'Created At',
        ];
    }

    /**
     * @param  Recipient  $recipient
     */
    public function map($recipient): array
    {
        if ($this->isTemplate) {
            return [];
        }

        return [
            $recipient->sender?->email,
            $recipient->first_name,
            $recipient->last_name,
            $recipient->name,
            $recipient->email,
            $recipient->phone_number,
            $recipient->secondary_phone_number,
            $recipient->address,
            $recipient->city,
            $recipient->province,
            $recipient->zip_code,
            $recipient->landmarks,
            $recipient->created_at?->format('Y-m-d H:i:s'),
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
