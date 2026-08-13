<?php

namespace Tests\Feature;

use App\Models\Invoice;
use Tests\TestCase;

class VatRoundingTest extends TestCase
{
    /**
     * Test that the sum of vatable_revenue and vat_amount is always equal to the invoice amount.
     */
    public function test_vat_rounding_breakdown_adds_up_to_total_amount(): void
    {
        // Try multiple test values (including the problematic 0.14 amount)
        $testCases = [
            ['amount' => 0.14, 'rate' => 0.12],
            ['amount' => 1.00, 'rate' => 0.12],
            ['amount' => 150.75, 'rate' => 0.12],
            ['amount' => 250.75, 'rate' => 0.12],
            ['amount' => 0.14, 'rate' => 0.10],
            ['amount' => 120.00, 'rate' => 0.10],
            ['amount' => 88.88, 'rate' => 0.05],
            ['amount' => 0.00, 'rate' => 0.12],
        ];

        foreach ($testCases as $case) {
            $amount = $case['amount'];
            $rate = $case['rate'];

            $breakdown = Invoice::calculateVatBreakdown($amount, $rate);

            if ($amount <= 0.0) {
                $this->assertEquals(0.0, $breakdown['vatable_revenue']);
                $this->assertEquals(0.0, $breakdown['vat_amount']);
                $this->assertEquals(0.0, $breakdown['vat_exempt_revenue']);
            } else {
                $sum = round($breakdown['vatable_revenue'] + $breakdown['vat_amount'] + $breakdown['vat_exempt_revenue'], 2);
                $this->assertEquals(
                    round($amount, 2),
                    $sum,
                    "Failed: sum of components ($sum) does not equal total amount ($amount) for rate $rate"
                );
            }
        }
    }
}
