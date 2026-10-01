<?php

namespace App\Http\Requests\Admin;

use App\Enums\CalendarEventCategory;
use App\Enums\CalendarEventType;
use App\Enums\CalendarEventVisibility;
use Illuminate\Validation\Rules\Enum;

trait CalendarEventRules
{
    /**
     * Shared validation rules for creating and updating calendar events.
     */
    protected function calendarEventRules(): array
    {
        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'event_type' => ['required', new Enum(CalendarEventType::class)],
            'category' => ['required', new Enum(CalendarEventCategory::class)],
            'visibility' => ['required', new Enum(CalendarEventVisibility::class)],
            'start_date' => ['required', 'date'],
            'end_date' => ['nullable', 'date', 'after_or_equal:start_date'],
            'is_all_day' => ['boolean'],
            'is_blocking' => ['boolean'],
            'color_hex' => ['nullable', 'string', 'max:20', 'regex:/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/'],
            'badge_label' => ['nullable', 'string', 'max:50'],
            'location' => ['nullable', 'string', 'max:255'],
            'batch_id' => ['nullable', 'exists:batches,id'],
            'runsheet_id' => ['nullable', 'exists:runsheets,id'],
            'pickup_zone_id' => ['nullable', 'exists:pickup_zones,id'],
            'area_id' => ['nullable', 'exists:areas,id'],
        ];
    }
}
