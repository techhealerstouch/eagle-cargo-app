<?php

namespace App\Http\Resources;

use App\Models\Invoice;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'invoice_number' => $this->invoice_number,
            'or_number' => $this->or_number,
            'amount' => $this->amount,
            'vat_amount' => $this->vat_amount,
            'vatable_revenue' => $this->vatable_revenue,
            'vat_exempt_revenue' => $this->vat_exempt_revenue,
            'is_vat_inclusive' => $this->is_vat_inclusive,
            'status' => $this->status?->value,
            'due_date' => $this->due_date?->toISOString(),
            'sent_at' => $this->sent_at?->toISOString(),
            'zoho_invoice_id' => $this->zoho_invoice_id,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
