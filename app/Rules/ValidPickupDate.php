<?php

namespace App\Rules;

use App\Models\Booking;
use App\Services\SettingsService;
use Carbon\Carbon;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Translation\PotentiallyTranslatedString;

class ValidPickupDate implements ValidationRule
{
    protected ?Booking $booking;

    protected ?int $pickupZoneId;

    public function __construct(?Booking $booking = null, ?int $pickupZoneId = null)
    {
        $this->booking = $booking;
        $this->pickupZoneId = $pickupZoneId;
    }

    /**
     * Run the validation rule.
     *
     * @param  Closure(string, ?string=): PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! $value) {
            return;
        }

        // If editing an existing booking and the preferred date hasn't changed, skip validation
        if ($this->booking && Carbon::parse($this->booking->preferred_date)->format('Y-m-d H:i') === Carbon::parse($value)->format('Y-m-d H:i')) {
            return;
        }

        try {
            $date = Carbon::parse($value)->startOfDay();
        } catch (\Exception $e) {
            $fail('The :attribute is not a valid date.');

            return;
        }

        // Resolve zone ID early so zone-specific logistics settings take precedence
        $zoneId = $this->pickupZoneId ?? $this->booking?->pickup_zone_id ?? $this->booking?->sender?->pickup_zone_id;

        /** @var SettingsService $settingsService */
        $settingsService = app(SettingsService::class);
        $logistics = $settingsService->getLogisticsSettings($zoneId);

        // 1. Check Lead Time
        $leadTimeDays = $logistics['leadTimeDays'] ?? 2;
        $minDate = Carbon::now()->startOfDay()->addDays($leadTimeDays);

        if ($date->isBefore($minDate)) {
            $fail("The pickup date must be at least {$leadTimeDays} days from today.");

            return;
        }

        $dateString = $date->format('Y-m-d');

        // 2. Check Blackout Dates
        $blackoutDates = $logistics['blackoutDates'] ?? [];
        if (in_array($dateString, $blackoutDates, true)) {
            $fail("The selected date ({$dateString}) is currently unavailable for pickups.");

            return;
        }

        // 3. Check Calendar Blocking / Blackout Events
        if (app(\App\Services\CalendarEventService::class)->isDateBlockedForZone($date, $zoneId)) {
            $fail("The selected date ({$dateString}) is unavailable for pickups due to a scheduled holiday or blackout.");

            return;
        }

        // 4. Check Specific Date Overrides (Highest Precedence)
        $specificDates = $logistics['specificDates'] ?? [];
        if (isset($specificDates[$dateString])) {
            $config = $specificDates[$dateString];
            $isAvailable = is_array($config) ? ($config['available'] ?? true) : (bool) $config;

            if (! $isAvailable) {
                $fail("The selected date ({$dateString}) is currently unavailable for pickups in this area.");

                return;
            }

            // Explicitly available!
            return;
        }

        // 5. Check Pickup Windows
        $pickupWindows = $logistics['pickupWindows'] ?? [];
        $dayOfWeek = $date->dayOfWeek; // 0 (Sunday) - 6 (Saturday)
        $weekOfMonth = (int) ceil($date->day / 7);

        // Check if any window is a specific date window matching today
        foreach ($pickupWindows as $window) {
            if (! empty($window['date']) && $window['date'] === $dateString) {
                if (! ($window['enabled'] ?? true) || ($window['available'] ?? true) === false) {
                    $fail("The selected date ({$dateString}) is currently unavailable for pickups in this area.");

                    return;
                }

                return;
            }
        }

        // Filter for recurring windows only (those with 'days' defined and no specific 'date')
        $recurringWindows = array_filter($pickupWindows, fn ($w) => ! empty($w['days']) && empty($w['date']));

        if (! empty($recurringWindows)) {
            $isWithinWindow = false;
            foreach ($recurringWindows as $window) {
                if (! ($window['enabled'] ?? true)) {
                    continue;
                }

                // Day check
                if (! in_array($dayOfWeek, $window['days'] ?? [], false)) {
                    continue;
                }

                // Week of month check
                if (! in_array($weekOfMonth, $window['weeks_of_month'] ?? [1, 2, 3, 4, 5], false)) {
                    continue;
                }

                $isWithinWindow = true;
                break;
            }

            if (! $isWithinWindow) {
                $fail('The selected pickup date is outside of available operation windows.');

                return;
            }
        } elseif (! empty($specificDates)) {
            // Specific calendar dates are configured for this area, but this date is not on the schedule
            $fail("No pickup service is scheduled for {$dateString} in this area.");

            return;
        }
    }
}
