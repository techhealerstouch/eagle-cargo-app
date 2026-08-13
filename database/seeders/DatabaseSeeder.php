<?php

namespace Database\Seeders;

use App\Enums\Role;
use App\Models\Picker;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            ConfigSeeder::class,
            BoxPriceSeeder::class,
            ProvinceSeeder::class,
            SettingSeeder::class,
            TrackingStepSeeder::class,
            SuburbSeeder::class,
        ]);

        // Seed some senders so bookings can be linked to real people.
        Sender::factory()->count(2)->create();

        // Seed Super Admin for all environments, including production.
        // Password is "password" by default (hashed via the model cast).
        User::updateOrCreate(
            ['email' => 'superadmin@example.com'],
            [
                'name' => 'Super Admin',
                'role' => Role::SuperAdmin,
                'password' => 'password',
                'email_verified_at' => now(),
            ]
        );

        if (app()->environment('local', 'testing', 'staging')) {
            // Seed some default users for local/dev/staging environments.
            User::updateOrCreate(
                ['email' => 'admin@example.com'],
                [
                    'name' => 'Admin User',
                    'role' => Role::Admin,
                    'password' => 'password',
                    'email_verified_at' => now(),
                ]
            );

            $pickerUser = User::updateOrCreate(
                ['email' => 'picker@example.com'],
                [
                    'name' => 'Test Picker',
                    'role' => Role::Picker,
                    'password' => 'password',
                    'email_verified_at' => now(),
                ]
            );

            if (! Picker::where('user_id', $pickerUser->id)->exists()) {
                Picker::factory()->create([
                    'user_id' => $pickerUser->id,
                    'email' => $pickerUser->email,
                    'first_name' => 'Test',
                    'last_name' => 'Picker',
                ]);
            }
        }
    }
}
