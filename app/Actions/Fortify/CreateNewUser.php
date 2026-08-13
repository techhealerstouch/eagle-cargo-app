<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Enums\Role;
use App\Models\Courier;
use App\Models\Picker;
use App\Models\Recipient;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules, ProfileValidationRules;

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        Validator::make($input, [
            ...$this->profileRules(),
            'password' => $this->passwordRules(),
            'role' => ['required', 'string', Rule::in([
                Role::Sender->value,
                Role::Recipient->value,
            ])],
            'mobile' => ['required', 'string', 'max:20'],
            'address' => ['required', 'string', 'max:500'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'license_number' => [Rule::requiredIf($input['role'] === Role::Courier->value), 'nullable', 'string', 'max:50'],
        ])->validate();

        $user = User::create([
            'name' => $input['name'],
            'email' => $input['email'],
            'password' => $input['password'],
            'role' => $input['role'],
        ]);

        $userRole = $user->role instanceof Role
            ? $user->role
            : (is_string($user->role) ? Role::tryFrom($user->role) : null);

        $nameParts = preg_split('/\s+/', trim($user->name)) ?: [];
        $firstName = $nameParts[0] ?? $user->name;
        $lastName = count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 1)) : '';

        if ($userRole === Role::Sender) {
            Sender::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'email' => $user->email,
                    'country' => $input['country'] ?? 'Australia',
                    'mobile' => $input['mobile'],
                    'address' => $input['address'],
                    'suburb' => $input['suburb'] ?? null,
                    'state' => $input['state'] ?? null,
                    'postcode' => $input['postcode'] ?? null,
                    'latitude' => $input['latitude'] ?? null,
                    'longitude' => $input['longitude'] ?? null,
                ]
            );
        } elseif ($userRole === Role::Recipient) {
            Recipient::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone_number' => $input['mobile'],
                    'address' => $input['address'],
                    'city' => $input['suburb'] ?? '',
                    'province' => $input['state'] ?? '',
                    'zip_code' => $input['postcode'] ?? '',
                    'latitude' => $input['latitude'] ?? null,
                    'longitude' => $input['longitude'] ?? null,
                    'area_id' => 1, // Default or select from UI
                ]
            );
        } elseif ($userRole === Role::Courier) {
            Courier::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'email' => $user->email,
                    'mobile' => $input['mobile'],
                    'address' => $input['address'],
                    'suburb' => $input['suburb'] ?? null,
                    'state' => $input['state'] ?? null,
                    'postcode' => $input['postcode'] ?? null,
                    'latitude' => $input['latitude'] ?? null,
                    'longitude' => $input['longitude'] ?? null,
                    'license_number' => $input['license_number'] ?? null,
                ]
            );
        } elseif ($userRole === Role::Picker) {
            Picker::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'email' => $user->email,
                    'mobile' => $input['mobile'],
                    'address' => $input['address'],
                    'suburb' => $input['suburb'] ?? null,
                    'state' => $input['state'] ?? null,
                    'postcode' => $input['postcode'] ?? null,
                    'latitude' => $input['latitude'] ?? null,
                    'longitude' => $input['longitude'] ?? null,
                ]
            );
        }

        return $user;
    }
}
