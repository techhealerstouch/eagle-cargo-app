<?php

use App\Models\Sender;
use App\Models\User;
use App\Enums\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Backfill any senders that do not have a user_id
        $sendersWithoutUsers = Sender::whereNull('user_id')->get();

        foreach ($sendersWithoutUsers as $sender) {
            // We use withoutEvents to prevent the UserObserver from trying to auto-create a duplicate sender profile
            $user = User::withoutEvents(function () use ($sender) {
                // Ensure unique email (in case the sender's email is somehow duplicate or already exists)
                $email = $sender->email;
                $counter = 1;
                while (User::where('email', $email)->exists()) {
                    $email = 'sender.' . $sender->id . '_' . $counter . '@example.com';
                    $counter++;
                }

                $prefix = 'SD';
                do {
                    $customId = $prefix . '-' . strtoupper(Str::random(6));
                } while (User::where('custom_id', $customId)->exists());

                return User::create([
                    'custom_id' => $customId,
                    'name' => trim($sender->first_name . ' ' . $sender->last_name),
                    'email' => $email,
                    'password' => Hash::make(Str::random(12)),
                    'role' => Role::Sender->value,
                ]);
            });

            // Associate the sender with this new user
            $sender->update(['user_id' => $user->id]);
        }

        // 2. Now that all senders have a user_id, drop the old FK, make the column non-nullable, and add the new FK
        Schema::table('senders', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
        });

        Schema::table('senders', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable(false)->change();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('senders', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
        });

        Schema::table('senders', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->change();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }
};
