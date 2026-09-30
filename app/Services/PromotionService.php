<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Promotion;
use App\Models\PromotionRedemption;
use App\Models\Sender;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class PromotionService
{
    /**
     * Validate a promo code against a set of booking parameters.
     *
     * @param string $code
     * @param int|null $senderId
     * @param array $boxes (array of box data, e.g., [['type_id' => 1, 'pickup_zone_id' => 1], ...])
     * @param float $subtotal
     * @param int $emptyBoxCount
     * @param float $emptyBoxFee
     * @return array ['valid' => bool, 'message' => string, 'discount_amount' => float, 'promotion' => Promotion|null]
     */
    public function validateAndCalculate(
        string $code,
        ?int $senderId,
        array $boxes,
        float $subtotal,
        int $emptyBoxCount = 0,
        float $emptyBoxFee = 0.0
    ): array {
        $promotion = Promotion::where('code', $code)->first();

        if (!$promotion) {
            return ['valid' => false, 'message' => 'Invalid promo code.', 'discount_amount' => 0.0, 'promotion' => null];
        }

        if (!$promotion->is_active) {
            return ['valid' => false, 'message' => 'This promo code is no longer active.', 'discount_amount' => 0.0, 'promotion' => null];
        }

        $now = Carbon::now();
        if ($promotion->valid_from && $now->lt($promotion->valid_from)) {
            return ['valid' => false, 'message' => 'This promo code is not yet valid.', 'discount_amount' => 0.0, 'promotion' => null];
        }

        if ($promotion->valid_to && $now->gt($promotion->valid_to)) {
            return ['valid' => false, 'message' => 'This promo code has expired.', 'discount_amount' => 0.0, 'promotion' => null];
        }

        if ($promotion->max_uses !== null && $promotion->uses_count >= $promotion->max_uses) {
            return ['valid' => false, 'message' => 'This promo code has reached its usage limit.', 'discount_amount' => 0.0, 'promotion' => null];
        }

        if ($senderId) {
            $userUses = PromotionRedemption::where('promotion_id', $promotion->id)
                ->where('sender_id', $senderId)
                ->count();

            if ($userUses >= $promotion->max_uses_per_user) {
                return ['valid' => false, 'message' => 'You have already used this promo code the maximum number of times.', 'discount_amount' => 0.0, 'promotion' => null];
            }

            if ($promotion->first_time_sender_only) {
                $hasPriorBookings = Booking::where('sender_id', $senderId)
                    ->where('status', '!=', 'cancelled')
                    ->exists();

                if ($hasPriorBookings) {
                    return ['valid' => false, 'message' => 'This promo code is valid for first-time senders only.', 'discount_amount' => 0.0, 'promotion' => null];
                }
            }
        } elseif ($promotion->first_time_sender_only) {
            // Cannot verify if guest is first time sender, might need to assume yes until they login
        }

        $boxCount = count($boxes) + $emptyBoxCount;
        if ($boxCount < $promotion->min_box_count) {
            return ['valid' => false, 'message' => "You must have at least {$promotion->min_box_count} box(es) to use this promo code.", 'discount_amount' => 0.0, 'promotion' => null];
        }

        if ($promotion->min_spend !== null && $subtotal < $promotion->min_spend) {
            return ['valid' => false, 'message' => "A minimum spend of $" . number_format($promotion->min_spend, 2) . " is required.", 'discount_amount' => 0.0, 'promotion' => null];
        }

        // Check applicable pickup zones
        if (!empty($promotion->applicable_pickup_zones)) {
            $hasValidZone = false;
            foreach ($boxes as $box) {
                if (isset($box['pickup_zone_id']) && in_array($box['pickup_zone_id'], $promotion->applicable_pickup_zones)) {
                    $hasValidZone = true;
                    break;
                }
            }
            if (!$hasValidZone && $boxCount > 0 && count($boxes) > 0) { // Only fail if we have actual boxes but none in the zone
                return ['valid' => false, 'message' => 'This promo code is not valid for your selected pickup zone.', 'discount_amount' => 0.0, 'promotion' => null];
            }
        }

        // Check applicable box types
        if (!empty($promotion->applicable_box_types)) {
            $hasValidBoxType = false;
            foreach ($boxes as $box) {
                if (isset($box['type_id']) && in_array($box['type_id'], $promotion->applicable_box_types)) {
                    $hasValidBoxType = true;
                    break;
                }
            }
            if (!$hasValidBoxType && count($boxes) > 0) {
                return ['valid' => false, 'message' => 'This promo code is not valid for your selected box type(s).', 'discount_amount' => 0.0, 'promotion' => null];
            }
        }

        // Calculate discount
        $discountAmount = 0.0;
        switch ($promotion->type) {
            case 'fixed_discount':
                $discountAmount = (float) $promotion->value;
                break;
            case 'percentage_discount':
                $discountAmount = $subtotal * ((float) $promotion->value / 100);
                if ($promotion->max_discount !== null && $discountAmount > $promotion->max_discount) {
                    $discountAmount = (float) $promotion->max_discount;
                }
                break;
            case 'per_box_discount':
                $discountAmount = (float) $promotion->value * count($boxes); // Apply per actual box (or include empty boxes?)
                break;
            case 'waive_empty_box_fee':
                $discountAmount = (float) $emptyBoxCount * (float) $emptyBoxFee;
                break;
            case 'buy_x_get_y_free':
                $buyQty = (int) ($promotion->buy_quantity ?? 0);
                $freeQty = (int) ($promotion->free_quantity ?? 1);

                if (count($boxes) < $buyQty) {
                    return [
                        'valid' => false,
                        'message' => "You need at least {$buyQty} box(es) to use this promo code.",
                        'discount_amount' => 0.0,
                        'promotion' => null,
                    ];
                }

                // Sort box prices ascending and sum the cheapest N as discount
                $boxPrices = collect($boxes)
                    ->map(fn ($box) => (float) ($box['price_charged'] ?? $box['price'] ?? 0))
                    ->sort()
                    ->values();

                $discountAmount = $boxPrices->take($freeQty)->sum();

                if ($promotion->max_discount !== null && $discountAmount > $promotion->max_discount) {
                    $discountAmount = (float) $promotion->max_discount;
                }
                break;
        }

        // Discount cannot exceed subtotal
        if ($discountAmount > $subtotal) {
            $discountAmount = $subtotal;
        }

        return [
            'valid' => true,
            'message' => 'Promo code applied successfully!',
            'discount_amount' => round($discountAmount, 2),
            'promotion' => $promotion
        ];
    }

    /**
     * Record a promotion redemption after successful booking.
     */
    public function recordRedemption(Promotion $promotion, Booking $booking): void
    {
        DB::transaction(function () use ($promotion, $booking) {
            PromotionRedemption::create([
                'promotion_id' => $promotion->id,
                'booking_id' => $booking->id,
                'sender_id' => $booking->sender_id,
                'discount_amount' => $booking->discount_amount,
                'redeemed_at' => now(),
            ]);

            $promotion->increment('uses_count');
        });
    }
}
