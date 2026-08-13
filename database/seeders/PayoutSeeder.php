<?php

namespace Database\Seeders;

use App\Enums\CommissionStatus;
use App\Models\Box;
use App\Models\Commission;
use App\Models\Payout;
use App\Models\Picker;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class PayoutSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $pickerUser = User::where('email', 'picker@example.com')->first();
        if (!$pickerUser) {
            $this->command->warn('Picker user not found. Run DatabaseSeeder first.');
            return;
        }

        // Ensure we have some boxes for the commissions
        $boxes = Box::factory()->count(10)->create();

        // 1. Create some pending commissions
        foreach ($boxes->take(4) as $box) {
            Commission::create([
                'picker_id' => $pickerUser->id,
                'box_id' => $box->id,
                'amount' => rand(5, 20) + (rand(0, 99) / 100),
                'type' => 'standard',
                'distance_km' => rand(0, 50),
                'breakdown' => [
                    'base_rate' => 5.00,
                    'distance_bonus' => 0.00,
                    'distance_km' => 0
                ],
                'status' => CommissionStatus::PENDING->value,
            ]);
        }

        // 2. Create a Cash Payout with paid commissions
        $cashAmount = 0;
        $cashCommissions = [];
        foreach ($boxes->slice(4, 3) as $box) {
            $amount = rand(5, 20) + (rand(0, 99) / 100);
            $cashAmount += $amount;
            $cashCommissions[] = Commission::create([
                'picker_id' => $pickerUser->id,
                'box_id' => $box->id,
                'amount' => $amount,
                'type' => 'standard',
                'distance_km' => rand(0, 50),
                'breakdown' => [
                    'base_rate' => 5.00,
                    'distance_bonus' => 0.00,
                    'distance_km' => 0
                ],
                'status' => CommissionStatus::PAID->value,
            ]);
        }

        $cashPayout = Payout::create([
            'picker_id' => $pickerUser->id,
            'total_amount' => $cashAmount,
            'payout_method' => 'cash',
            'reference_number' => 'CASH-' . Str::upper(Str::random(6)),
            'paid_at' => now()->subDays(2),
        ]);

        foreach ($cashCommissions as $commission) {
            $commission->update(['payout_id' => $cashPayout->id]);
        }

        // 3. Create a Stripe Payout
        $stripeAmount = 0;
        $stripeCommissions = [];
        foreach ($boxes->slice(7, 3) as $box) {
            $amount = rand(5, 20) + (rand(0, 99) / 100);
            $stripeAmount += $amount;
            $stripeCommissions[] = Commission::create([
                'picker_id' => $pickerUser->id,
                'box_id' => $box->id,
                'amount' => $amount,
                'type' => 'standard',
                'distance_km' => rand(0, 50),
                'breakdown' => [
                    'base_rate' => 5.00,
                    'distance_bonus' => 0.00,
                    'distance_km' => 0
                ],
                'status' => CommissionStatus::PAID->value,
            ]);
        }

        $stripePayout = Payout::create([
            'picker_id' => $pickerUser->id,
            'total_amount' => $stripeAmount,
            'payout_method' => 'stripe',
            'reference_number' => 'tr_' . Str::random(24),
            'paid_at' => now()->subDays(1),
        ]);

        foreach ($stripeCommissions as $commission) {
            $commission->update(['payout_id' => $stripePayout->id]);
        }

        $this->command->info('Successfully seeded payouts and commissions for picker@example.com');
    }
}
