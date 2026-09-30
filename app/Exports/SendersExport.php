<?php

namespace App\Exports;

use App\Models\Sender;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class SendersExport implements FromCollection, ShouldAutoSize, WithHeadings, WithMapping, WithStyles
{
    protected ?Collection $senders;

    protected bool $isTemplate;

    public function __construct(?Collection $senders = null, bool $isTemplate = false)
    {
        $this->senders = $senders;
        $this->isTemplate = $isTemplate;
    }

    public function collection(): Collection
    {
        if ($this->isTemplate) {
            return collect([]);
        }

        return $this->senders ?? Sender::all();
    }

    public function headings(): array
    {
        if ($this->isTemplate) {
            return [
                'First Name',
                'Last Name',
                'Email',
                'Country',
                'Mobile',
                'Secondary Mobile',
                'Address',
                'Suburb',
                'State',
                'Postcode',
            ];
        }

        return [
            'First Name',
            'Last Name',
            'Email',
            'Country',
            'Mobile',
            'Secondary Mobile',
            'Address',
            'Suburb',
            'State',
            'Postcode',
            'Created At',
        ];
    }

    /**
     * @param  Sender  $sender
     */
    public function map($sender): array
    {
        if ($this->isTemplate) {
            return [];
        }

        return [
            $sender->first_name,
            $sender->last_name,
            $sender->email,
            $sender->country ?? 'Australia',
            $sender->mobile,
            $sender->secondary_mobile,
            $sender->address,
            $sender->suburb,
            $sender->state,
            $sender->postcode,
            $sender->created_at?->format('Y-m-d H:i:s'),
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
