<?php

namespace App\Imports;

use App\Models\Recipient;
use App\Models\Sender;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class RecipientsImport implements ToCollection, WithHeadingRow
{
    public int $createdCount = 0;

    public int $updatedCount = 0;

    public array $failures = [];

    public function collection(Collection $rows): void
    {
        foreach ($rows as $index => $row) {
            $rowNumber = $index + 2;

            $senderEmail = strtolower(trim((string) ($row['sender_email'] ?? '')));
            $firstName = trim((string) ($row['first_name'] ?? ''));
            $lastName = trim((string) ($row['last_name'] ?? ''));
            $fullName = trim((string) ($row['full_name'] ?? $row['name'] ?? ''));
            if (empty($fullName) && (! empty($firstName) || ! empty($lastName))) {
                $fullName = trim("{$firstName} {$lastName}");
            }
            $email = strtolower(trim((string) ($row['email'] ?? '')));
            $phone = trim((string) ($row['phone_number'] ?? $row['phone'] ?? ''));
            $secondaryPhone = trim((string) ($row['secondary_phone'] ?? $row['secondary_phone_number'] ?? ''));
            $address = trim((string) ($row['address'] ?? ''));
            $city = trim((string) ($row['city'] ?? ''));
            $province = trim((string) ($row['province'] ?? ''));
            $zipCode = trim((string) ($row['zip_code'] ?? ''));
            $landmarks = trim((string) ($row['landmarks'] ?? ''));

            // Skip empty rows
            if (empty($senderEmail) && empty($fullName) && empty($phone)) {
                continue;
            }

            $validator = Validator::make([
                'sender_email' => $senderEmail,
                'name' => $fullName,
                'phone_number' => $phone,
                'address' => $address,
                'city' => $city,
                'province' => $province,
            ], [
                'sender_email' => 'required|email',
                'name' => 'required|string|max:255',
                'phone_number' => 'required|string|max:25',
                'address' => 'required|string|max:500',
                'city' => 'required|string|max:100',
                'province' => 'required|string|max:100',
            ]);

            if ($validator->fails()) {
                $this->failures[] = [
                    'row' => $rowNumber,
                    'errors' => $validator->errors()->all(),
                ];

                continue;
            }

            $sender = Sender::where('email', $senderEmail)->first();
            if (! $sender) {
                $this->failures[] = [
                    'row' => $rowNumber,
                    'errors' => ["Sender with email '{$senderEmail}' not found. Please import or create the sender first."],
                ];

                continue;
            }

            $data = [
                'sender_id' => $sender->id,
                'name' => $fullName,
                'first_name' => ! empty($firstName) ? $firstName : null,
                'last_name' => ! empty($lastName) ? $lastName : null,
                'email' => ! empty($email) ? $email : null,
                'phone_number' => $phone,
                'secondary_phone_number' => ! empty($secondaryPhone) ? $secondaryPhone : null,
                'address' => $address,
                'city' => $city,
                'province' => $province,
                'zip_code' => ! empty($zipCode) ? $zipCode : null,
                'landmarks' => ! empty($landmarks) ? $landmarks : null,
            ];

            $recipient = Recipient::where('sender_id', $sender->id)
                ->where('phone_number', $phone)
                ->first();

            if ($recipient) {
                $recipient->update(array_filter($data, fn ($val) => $val !== null));
                $this->updatedCount++;
            } else {
                Recipient::create($data);
                $this->createdCount++;
            }
        }
    }
}
