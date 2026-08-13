<?php

namespace App\Services;

use App\Enums\CommissionStatus;
use App\Enums\CommissionType;
use App\Models\Box;
use App\Models\Commission;
use App\Models\Setting;
use App\Models\User;

class CommissionService
{
    /**
     * Calculates the commission amount for a box and picker.
     */
    public function calculateForBox(Box $box, User $picker): float
    {
        $settings = app(SettingsService::class);
        $type = $picker->commission_type ?? $settings->get('commission_default_type', CommissionType::FLAT->value);
        $typeEnum = $type instanceof CommissionType ? $type : CommissionType::tryFrom($type);
        
        $ratesSetting = $settings->get('commission_default_rates', '{"flat": 0}');
        $rates = $picker->commission_rates ?? (is_array($ratesSetting) ? $ratesSetting : json_decode($ratesSetting, true));

        return match ($typeEnum) {
            CommissionType::FLAT => (float) ($rates['amount'] ?? $rates['flat'] ?? 0),
            CommissionType::SIZE => $this->calculateSizeBased($box, $rates),
            CommissionType::PERCENTAGE => $this->calculatePercentageBased($box, $rates),
            default => 0,
        };
    }

    private function calculateSizeBased(Box $box, array $rates): float
    {
        // Handle both nested "sizes" object or flat structure
        $sizes = $rates['sizes'] ?? $rates;
        $boxTypeName = $box->boxType?->name ?? 'default';
        return (float) ($sizes[$boxTypeName] ?? $sizes['default'] ?? 0);
    }

    private function calculatePercentageBased(Box $box, array $rates): float
    {
        $percentage = (float) ($rates['percentage'] ?? 0);
        $value = (float) ($box->declared_value ?? $box->price_charged ?? 0);
        
        return ($value * $percentage) / 100;
    }

    /**
     * Creates a pending commission record for a picked-up box.
     */
    public function createCommission(Box $box, User $picker): ?Commission
    {
        // Check if active commission already exists
        if (Commission::where('box_id', $box->id)
            ->where('picker_id', $picker->id)
            ->where('status', '!=', CommissionStatus::CANCELLED)
            ->exists()) {
            return null;
        }

        $baseAmount = $this->calculateForBox($box, $picker);
        $amount = $baseAmount;
        $distanceKm = 0;
        $distanceBonus = 0;

        $settings = app(SettingsService::class);
        $distanceRate = (float) $settings->get('distance_rate_per_km', 0);
        
        if ($distanceRate > 0 && $picker->picker && $box->booking?->sender) {
            $lat1 = $picker->picker->latitude;
            $lon1 = $picker->picker->longitude;
            $lat2 = $box->booking->sender->latitude;
            $lon2 = $box->booking->sender->longitude;
            
            if ($lat1 !== null && $lon1 !== null && $lat2 !== null && $lon2 !== null) {
                $distanceKm = $this->calculateDistance($lat1, $lon1, $lat2, $lon2);
                $distanceBonus = ($distanceKm * $distanceRate);
                $amount += $distanceBonus;
            }
        }

        if ($amount <= 0) {
            return null; // Don't create zero amount commissions
        }

        return Commission::create([
            'picker_id' => $picker->id,
            'box_id' => $box->id,
            'amount' => $amount,
            'distance_km' => $distanceKm,
            'type' => 'standard',
            'status' => CommissionStatus::PENDING,
            'breakdown' => [
                'base_rate' => round($baseAmount, 2),
                'distance_bonus' => round($distanceBonus, 2),
                'distance_km' => round($distanceKm, 2),
            ]
        ]);
    }

    public function cancelCommission(Box $box, ?User $picker = null): void
    {
        $settings = app(SettingsService::class);
        $cancellationFee = (float) $settings->get('cancellation_flat_fee', 0);
        
        $query = Commission::where('box_id', $box->id)->where('status', '!=', CommissionStatus::CANCELLED);
        if ($picker) {
            $query->where('picker_id', $picker->id);
        }
        
        $existingCommissions = $query->get();
        
        if ($cancellationFee > 0 && $existingCommissions->isEmpty() && $picker) {
            Commission::create([
                'picker_id' => $picker->id,
                'box_id' => $box->id,
                'amount' => $cancellationFee,
                'type' => 'cancellation',
                'status' => CommissionStatus::PENDING,
                'distance_km' => 0,
                'breakdown' => [
                    'cancellation_fee' => round($cancellationFee, 2),
                    'reason' => 'Box cancelled before collection'
                ]
            ]);
            return;
        }

        foreach ($existingCommissions as $commission) {
            if ($commission->status === CommissionStatus::PAID) {
                // It's already paid, create a clawback entry
                $clawbackAmount = -$commission->amount;
                if ($cancellationFee > 0) {
                    $clawbackAmount += $cancellationFee;
                }

                if ($clawbackAmount < 0 || $cancellationFee > 0) {
                    Commission::create([
                        'picker_id' => $commission->picker_id,
                        'box_id' => $box->id,
                        'amount' => $clawbackAmount,
                        'type' => 'clawback',
                        'status' => CommissionStatus::PENDING, // This will be deducted from next payout
                        'distance_km' => 0,
                        'breakdown' => [
                            'original_commission_id' => $commission->id,
                            'reversed_amount' => round(-$commission->amount, 2),
                            'cancellation_fee' => round($cancellationFee, 2),
                            'reason' => 'Box cancelled after commission payout'
                        ]
                    ]);
                }
            } else {
                // It's PENDING
                if ($cancellationFee > 0) {
                    $commission->update([
                        'amount' => $cancellationFee,
                        'type' => 'cancellation',
                        'breakdown' => [
                            'cancellation_fee' => round($cancellationFee, 2),
                            'original_breakdown' => $commission->breakdown
                        ]
                    ]);
                } else {
                    $commission->update(['status' => CommissionStatus::CANCELLED]);
                }
            }
        }
    }

    private function calculateDistance(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6371; // km
        
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        
        $a = sin($dLat / 2) * sin($dLat / 2) +
             cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
             sin($dLon / 2) * sin($dLon / 2);
             
        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
        
        return $earthRadius * $c; // in km
    }
}
