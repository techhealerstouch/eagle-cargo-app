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

    public function __construct(?Booking $booking = null)
    {
        $this->booking = $booking;
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

        /** @var SettingsService $settingsService */
        $settingsService = app(SettingsService::class);
        $logistics = $settingsService->getLogisticsSettings();

        // 1. Check Lead Time
        $leadTimeDays = $logistics['leadTimeDays'] ?? 2;
        $minDate = Carbon::now()->startOfDay()->addDays($leadTimeDays);

        if ($date->isBefore($minDate)) {
            $fail("The pickup date must be at least {$leadTimeDays} days from today.");

            return;
        }

        // 2. Check Pickup Windows
        $pickupWindows = $logistics['pickupWindows'] ?? [];
        $dateString = $date->format('Y-m-d');
        $timeString = Carbon::parse($value)->format('H:i');
        $dayOfWeek = $date->dayOfWeek; // 0 (Sunday) - 6 (Saturday)
        $weekOfMonth = (int) ceil($date->day / 7);

        // If windows are defined, the date must match at least one window
        if (! empty($pickupWindows)) {
            $isWithinWindow = false;
            foreach ($pickupWindows as $window) {
                if (! ($window['enabled'] ?? true)) {
                    continue;
                }

                // Day check
                if (! in_array($dayOfWeek, $window['days'] ?? [])) {
                    continue;
                }

                // Week of month check
                if (! in_array($weekOfMonth, $window['weeks_of_month'] ?? [1, 2, 3, 4, 5])) {
                    continue;
                }

                // Time check has been removed as pickup is per day, not per specific time.
                $isWithinWindow = true;
                break;
            }

            if (! $isWithinWindow) {
                $fail('The selected pickup date is outside of available operation windows.');

                return;
            }
        }

        // 3. Check Blackout Dates
        $blackoutDates = $logistics['blackoutDates'] ?? [];
        $dateString = $date->format('Y-m-d');

        if (in_array($dateString, $blackoutDates)) {
            $fail("The selected date ({$dateString}) is currently unavailable for pickups.");

            return;
        }
    }
}
