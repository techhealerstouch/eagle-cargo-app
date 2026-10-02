<?php

namespace Database\Seeders;

use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Enums\SerialNumberStatus;
use App\Models\Area;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxType;
use App\Models\Picker;
use App\Models\Recipient;
use App\Models\Runsheet;
use App\Models\Sender;
use App\Models\SerialNumber;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class PickerRunsheetSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Ensure picker user exists
        $pickerUser = User::updateOrCreate(
            ['email' => 'picker@example.com'],
            [
                'name' => 'Test Picker',
                'role' => Role::Picker,
                'password' => 'password',
                'email_verified_at' => now(),
            ]
        );

        $picker = Picker::firstOrCreate(
            ['user_id' => $pickerUser->id],
            [
                'email' => $pickerUser->email,
                'first_name' => 'Test',
                'last_name' => 'Picker',
                'mobile' => '+61 400 111 222',
                'is_active' => true,
                'latitude' => -33.8688,
                'longitude' => 151.2093,
            ]
        );

        // 2. Ensure Serial Numbers exist in pool
        for ($i = 1; $i <= 50; $i++) {
            $sn = 'SR-'.str_pad((string) $i, 5, '0', STR_PAD_LEFT);
            SerialNumber::firstOrCreate(
                ['serial_number' => $sn],
                ['status' => SerialNumberStatus::Available]
            );
        }

        // 3. Ensure Box Types exist
        $jumbo = BoxType::firstOrCreate(['name' => 'Jumbo'], ['dimensions' => '24x24x24', 'is_active' => true]);
        $large = BoxType::firstOrCreate(['name' => 'Large'], ['dimensions' => '20x20x20', 'is_active' => true]);
        $medium = BoxType::firstOrCreate(['name' => 'Medium'], ['dimensions' => '18x18x18', 'is_active' => true]);

        // 4. Ensure Area exists
        $area = Area::firstOrCreate(['name' => 'Metro Manila'], ['is_active' => true]);

        // 5. Create or update active pickup runsheet assigned to picker
        $runsheet = Runsheet::updateOrCreate(
            [
                'picker_id' => $pickerUser->id,
                'scheduled_date' => today(),
                'type' => RunsheetType::Pickup,
            ],
            [
                'timeslot' => 'Morning (08:00 - 12:00)',
                'area_description' => 'Sydney Metro Central & East Route',
                'status' => RunsheetStatus::InProgress,
            ]
        );

        // 6. Define stops data with realistic locations around Sydney and destinations in PH
        $stopsData = [
            [
                'sender' => [
                    'first_name' => 'Maria',
                    'last_name' => 'Santos',
                    'email' => 'maria.santos@example.com',
                    'mobile' => '+61 412 345 678',
                    'address' => '120 George St, The Rocks',
                    'suburb' => 'Sydney',
                    'state' => 'NSW',
                    'postcode' => '2000',
                    'latitude' => -33.8599,
                    'longitude' => 151.2090,
                ],
                'recipient' => [
                    'name' => 'Jose Santos',
                    'phone_number' => '+63 917 123 4567',
                    'address' => 'Block 5 Lot 12 Sampaguita St, Barangay San Antonio',
                    'city' => 'Quezon City',
                    'province' => 'Metro Manila',
                    'zip_code' => '1105',
                ],
                'payment_status' => PaymentStatus::CashOnPickup,
                'declaration_form_status' => 'submitted_online',
                'boxes' => [
                    ['box_type' => $jumbo, 'price' => 120.00],
                    ['box_type' => $large, 'price' => 95.00],
                ],
            ],
            [
                'sender' => [
                    'first_name' => 'Reynaldo',
                    'last_name' => 'Dela Cruz',
                    'email' => 'reynaldo.delacruz@example.com',
                    'mobile' => '+61 423 456 789',
                    'address' => '45 Oxford St, Darlinghurst',
                    'suburb' => 'Darlinghurst',
                    'state' => 'NSW',
                    'postcode' => '2010',
                    'latitude' => -33.8785,
                    'longitude' => 151.2165,
                ],
                'recipient' => [
                    'name' => 'Corazon Dela Cruz',
                    'phone_number' => '+63 918 234 5678',
                    'address' => '78 Rizal Avenue, Poblacion',
                    'city' => 'Makati City',
                    'province' => 'Metro Manila',
                    'zip_code' => '1200',
                ],
                'payment_status' => PaymentStatus::Paid,
                'declaration_form_status' => 'missing',
                'boxes' => [
                    ['box_type' => $jumbo, 'price' => 120.00],
                ],
            ],
            [
                'sender' => [
                    'first_name' => 'Grace',
                    'last_name' => 'Mendoza',
                    'email' => 'grace.mendoza@example.com',
                    'mobile' => '+61 434 567 890',
                    'address' => '88 King St, Newtown',
                    'suburb' => 'Newtown',
                    'state' => 'NSW',
                    'postcode' => '2042',
                    'latitude' => -33.8962,
                    'longitude' => 151.1799,
                ],
                'recipient' => [
                    'name' => 'Eduardo Mendoza',
                    'phone_number' => '+63 919 345 6789',
                    'address' => '14 Mabini Extension',
                    'city' => 'Pasig City',
                    'province' => 'Metro Manila',
                    'zip_code' => '1600',
                ],
                'payment_status' => PaymentStatus::CashCollected,
                'declaration_form_status' => 'submitted_online',
                'boxes' => [
                    ['box_type' => $jumbo, 'price' => 120.00],
                    ['box_type' => $medium, 'price' => 75.00],
                    ['box_type' => $large, 'price' => 95.00],
                ],
            ],
            [
                'sender' => [
                    'first_name' => 'Arnel',
                    'last_name' => 'Bautista',
                    'email' => 'arnel.bautista@example.com',
                    'mobile' => '+61 445 678 901',
                    'address' => '15 Victoria Ave, Chatswood',
                    'suburb' => 'Chatswood',
                    'state' => 'NSW',
                    'postcode' => '2067',
                    'latitude' => -33.7961,
                    'longitude' => 151.1804,
                ],
                'recipient' => [
                    'name' => 'Lourdes Bautista',
                    'phone_number' => '+63 920 456 7890',
                    'address' => '22 MacArthur Highway',
                    'city' => 'Taguig City',
                    'province' => 'Metro Manila',
                    'zip_code' => '1630',
                ],
                'payment_status' => PaymentStatus::Pending,
                'declaration_form_status' => 'physical_copy_received',
                'boxes' => [
                    ['box_type' => $jumbo, 'price' => 120.00],
                ],
            ],
        ];

        $syncData = [];
        $serialCounter = 1;

        foreach ($stopsData as $index => $data) {
            $sender = Sender::updateOrCreate(
                ['email' => $data['sender']['email']],
                $data['sender']
            );

            $recipient = Recipient::updateOrCreate(
                [
                    'sender_id' => $sender->id,
                    'name' => $data['recipient']['name'],
                ],
                array_merge($data['recipient'], [
                    'sender_id' => $sender->id,
                    'area_id' => $area->id,
                ])
            );

            $booking = Booking::updateOrCreate(
                [
                    'sender_id' => $sender->id,
                    'preferred_date' => today(),
                ],
                [
                    'status' => BookingStatus::Confirmed,
                    'service_type' => 'Balikbayan Box',
                    'payment_status' => $data['payment_status'],
                    'declaration_form_status' => $data['declaration_form_status'],
                    'confirmed_at' => now(),
                    'notes' => 'Pickup stop #'.($index + 1),
                ]
            );

            // Create boxes for this booking
            foreach ($data['boxes'] as $bIndex => $boxInfo) {
                $trackingNumber = sprintf('LB-%s-%03d', now()->format('Ymd'), $serialCounter);
                $serialNumber = sprintf('SR-%05d', $serialCounter);

                $box = Box::updateOrCreate(
                    [
                        'booking_id' => $booking->id,
                        'tracking_number' => $trackingNumber,
                    ],
                    [
                        'recipient_id' => $recipient->id,
                        'box_type_id' => $boxInfo['box_type']->id,
                        'price_charged' => $boxInfo['price'],
                        'serial_number' => $serialNumber,
                        'status' => BoxStatus::Pending,
                    ]
                );

                // Mark serial number as assigned
                SerialNumber::where('serial_number', $serialNumber)->update([
                    'status' => SerialNumberStatus::Assigned,
                    'box_id' => $box->id,
                    'allocated_at' => now(),
                ]);

                $serialCounter++;
            }

            $syncData[$booking->id] = ['sequence' => $index + 1];
        }

        // Attach all bookings in sequential order
        $runsheet->bookings()->sync($syncData);
    }
}
