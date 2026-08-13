<?php

namespace App\Http\Requests\Admin;

use App\Enums\Role;
use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->role === Role::SuperAdmin || $this->user()->role === Role::Admin;
    }

    public function rules(): array
    {
        $allowedRoles = $this->allowedRolesForCurrentUser();
        $user = $this->route('user');

        return [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,'.$user->id,
            'role' => ['required', 'in:'.implode(',', $allowedRoles)],
            'mobile' => 'required_if:role,courier,picker,sender,warehouse|nullable|string|max:50',
            'address' => 'required_if:role,courier,picker,sender|nullable|string|max:500',
            'suburb' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:50',
            'postcode' => 'nullable|string|max:20',
            'password' => 'nullable|string|min:8|confirmed',
            'area_id' => 'nullable|exists:areas,id',
            'pickup_zone_id' => 'required_if:role,picker|nullable|exists:pickup_zones,id',
            'commission_type' => 'nullable|string|in:flat,size,percentage',
            'commission_rates' => 'nullable|array',
        ];
    }

    private function allowedRolesForCurrentUser(): array
    {
        $base = [Role::Admin->value, Role::Courier->value, Role::Picker->value, Role::Sender->value, Role::Warehouse->value];

        if ($this->user()?->role === Role::SuperAdmin) {
            array_unshift($base, Role::SuperAdmin->value);
        }

        return $base;
    }
}
