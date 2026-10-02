<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCalendarEventRequest extends FormRequest
{
    use CalendarEventRules;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return $this->calendarEventRules();
    }
}
