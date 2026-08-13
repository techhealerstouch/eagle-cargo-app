<?php

namespace App\Http\Requests\Admin;

use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;
use Illuminate\Validation\Validator;

class StoreRunsheetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'courier_id' => 'nullable|exists:users,id',
            'picker_id' => 'nullable|exists:users,id',
            'scheduled_date' => 'required|date|after_or_equal:today',
            'area_description' => 'required|string|max:255',
            'status' => ['required', new Enum(RunsheetStatus::class)],
            'type' => ['required', new Enum(RunsheetType::class)],
            'booking_ids' => 'nullable|array',
            'booking_ids.*' => 'exists:bookings,id',
            'box_ids' => 'nullable|array',
            'box_ids.*' => 'exists:boxes,id',
            'stop_sequence' => 'nullable|array',
            'starting_serial_number' => 'required_if:type,pickup|string',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $type = (string) $this->input('type');
            if (! in_array($type, [RunsheetType::Pickup->value, RunsheetType::Delivery->value], true)) {
                return;
            }

            $status = (string) $this->input('status');
            if (in_array($status, [RunsheetStatus::Assigned->value, RunsheetStatus::InProgress->value], true)) {
                if ($type === RunsheetType::Delivery->value) {
                    $boxIds = $this->input('box_ids');
                    if (! is_array($boxIds) || count($boxIds) === 0) {
                        $validator->errors()->add('box_ids', 'At least one box is required when delivery runsheet status is assigned or in progress.');
                    }
                } else {
                    $bookingIds = $this->input('booking_ids');
                    if (! is_array($bookingIds) || count($bookingIds) === 0) {
                        $validator->errors()->add('booking_ids', 'At least one booking is required when pickup runsheet status is assigned or in progress.');
                    }
                }
            }

            $courierId = $this->input('courier_id');
            $pickerId = $this->input('picker_id');

            if ($type === RunsheetType::Pickup->value) {
                $resolvedPickerId = $pickerId ?: $courierId;
                if (! $resolvedPickerId) {
                    $validator->errors()->add('picker_id', 'A picker is required for pickup runsheets.');

                    return;
                }

                if ($this->resolveUserRoleValue((int) $resolvedPickerId) !== Role::Picker->value) {
                    $validator->errors()->add('picker_id', 'Selected user must have the picker role for pickup runsheets.');
                }

                return;
            }

            if (! $courierId) {
                $validator->errors()->add('courier_id', 'A courier is required for delivery runsheets.');

                return;
            }

            if ($this->resolveUserRoleValue((int) $courierId) !== Role::Courier->value) {
                $validator->errors()->add('courier_id', 'Selected user must have the courier role for delivery runsheets.');
            }
        });
    }

    private function resolveUserRoleValue(int $userId): ?string
    {
        $role = User::query()->whereKey($userId)->value('role');

        if ($role instanceof Role) {
            return $role->value;
        }

        return $role !== null ? (string) $role : null;
    }
}
