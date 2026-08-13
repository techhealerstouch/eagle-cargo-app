<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $invoices = \Illuminate\Support\Facades\DB::table('invoices')->get();

        foreach ($invoices as $invoice) {
            if ((float) $invoice->vat_amount <= 0 || (float) $invoice->vatable_revenue <= 0) {
                continue;
            }

            $ratio = (float) $invoice->vat_amount / (float) $invoice->vatable_revenue;
            
            // Resolve the tax rate (normally 0.12 or 0.10)
            $rate = 0.12;
            if ($ratio > 0.11 && $ratio < 0.13) {
                $rate = 0.12;
            } elseif ($ratio > 0.09 && $ratio < 0.11) {
                $rate = 0.10;
            } else {
                $rate = round($ratio, 4);
            }

            $vatableRevenue = round((float) $invoice->amount / (1 + $rate), 2);
            $vatAmount = round((float) $invoice->amount - $vatableRevenue, 2);

            if (abs($vatableRevenue - (float) $invoice->vatable_revenue) > 0.001 || abs($vatAmount - (float) $invoice->vat_amount) > 0.001) {
                // Update Invoice
                \Illuminate\Support\Facades\DB::table('invoices')
                    ->where('id', $invoice->id)
                    ->update([
                        'vatable_revenue' => $vatableRevenue,
                        'vat_amount' => $vatAmount,
                        'updated_at' => now(),
                    ]);

                // Update Invoice Snapshot in Payments
                $payments = \Illuminate\Support\Facades\DB::table('payments')
                    ->where('invoice_id', $invoice->id)
                    ->get();

                foreach ($payments as $payment) {
                    if ($payment->invoice_snapshot) {
                        $snapshot = json_decode($payment->invoice_snapshot, true);
                        if (is_array($snapshot)) {
                            $snapshot['vatable_revenue'] = $vatableRevenue;
                            $snapshot['vat_amount'] = $vatAmount;
                            \Illuminate\Support\Facades\DB::table('payments')
                                ->where('id', $payment->id)
                                ->update([
                                    'invoice_snapshot' => json_encode($snapshot),
                                    'updated_at' => now(),
                                ]);
                        }
                    }
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op or we can reverse it if needed. But since it's correcting data accuracy, it's safe as a non-reversible correction.
    }
};
