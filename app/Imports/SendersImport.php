<?php

namespace App\Imports;

use App\Models\Sender;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class SendersImport implements ToCollection, WithHeadingRow
{
    public int $createdCount = 0;

    public int $updatedCount = 0;

    public array $failures = [];

    public function collection(Collection $rows): void
    {
        foreach ($rows as $index => $row) {
            $rowNumber = $index + 2; // +2 considering 1-based index and header row

            $email = strtolower(trim((string) ($row['email'] ?? '')));
            $firstName = trim((string) ($row['first_name'] ?? ''));
            $lastName = trim((string) ($row['last_name'] ?? ''));
            $mobile = trim((string) ($row['mobile'] ?? ''));
            $secondaryMobile = trim((string) ($row['secondary_mobile'] ?? ''));
            $address = trim((string) ($row['address'] ?? ''));
            $suburb = trim((string) ($row['suburb'] ?? ''));
            $state = trim((string) ($row['state'] ?? ''));
            $postcode = trim((string) ($row['postcode'] ?? ''));
            $country = trim((string) ($row['country'] ?? 'Australia'));

            // Check if entire row is empty
            if (empty($email) && empty($firstName) && empty($lastName) && empty($mobile)) {
                continue;
            }

            $validator = Validator::make([
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $email,
                'mobile' => $mobile,
            ], [
                'first_name' => 'required|string|max:255',
                'last_name' => 'required|string|max:255',
                'email' => 'required|email|max:255',
                'mobile' => 'required|string|max:25',
            ]);

            if ($validator->fails()) {
                $this->failures[] = [
                    'row' => $rowNumber,
                    'errors' => $validator->errors()->all(),
                ];

                continue;
            }

            $data = [
                'first_name' => $firstName,
                'last_name' => $lastName,
                'country' => ! empty($country) ? $country : 'Australia',
                'mobile' => $mobile,
                'secondary_mobile' => ! empty($secondaryMobile) ? $secondaryMobile : null,
                'address' => ! empty($address) ? $address : null,
                'suburb' => ! empty($suburb) ? $suburb : null,
                'state' => ! empty($state) ? $state : null,
                'postcode' => ! empty($postcode) ? $postcode : null,
            ];

            $sender = Sender::where('email', $email)->first();

            if ($sender) {
                $sender->update(array_filter($data, fn ($val) => $val !== null));
                
                if ($sender->user) {
                    $sender->user->update([
                        'name' => $firstName . ' ' . $lastName,
                    ]);
                }
                
                $this->updatedCount++;
            } else {
                $data['email'] = $email;
                
                $user = \App\Models\User::where('email', $email)->first();
                if (!$user) {
                    $user = \App\Models\User::withoutEvents(function () use ($firstName, $lastName, $email) {
                        return \App\Models\User::create([
                            'name' => $firstName . ' ' . $lastName,
                            'email' => $email,
                            'password' => \Illuminate\Support\Facades\Hash::make(\Illuminate\Support\Str::random(16)),
                            'role' => \App\Enums\Role::Sender,
                            'email_verified_at' => now(),
                        ]);
                    });
                }
                $data['user_id'] = $user->id;
                
                Sender::updateOrCreate(
                    ['email' => $email],
                    $data
                );
                $this->createdCount++;
            }
        }
    }
}
