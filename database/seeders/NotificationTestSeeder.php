<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\Box;
use App\Models\Runsheet;
use App\Models\User;
use App\Notifications\BoxExceptionReported;
use App\Notifications\DeclarationFormSubmittedNotification;
use App\Notifications\NewOnlineBookingReceived;
use App\Notifications\RunsheetCompletedNotification;
use Illuminate\Database\Seeder;

class NotificationTestSeeder extends Seeder
{
    public function run(): void
    {
        $admins = User::whereIn('role', ['super_admin', 'admin'])->get();

        if ($admins->isEmpty()) {
            $this->command->error('No SuperAdmin/Admin users found.');

            return;
        }

        $booking = Booking::latest()->first();
        $runsheet = Runsheet::latest()->first();
        $box = Box::latest()->first();

        foreach ($admins as $admin) {
            if ($booking) {
                $admin->notify(new NewOnlineBookingReceived($booking));
                $admin->notify(new DeclarationFormSubmittedNotification($booking));
            }
            if ($runsheet) {
                $admin->notify(new RunsheetCompletedNotification($runsheet));
            }
            if ($box) {
                $admin->notify(new BoxExceptionReported($box));
            }
        }

        $this->command->info('Successfully seeded test notifications for '.$admins->count().' admin user(s)!');
    }
}
