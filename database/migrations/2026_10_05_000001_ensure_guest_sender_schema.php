<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Self-healing guard for the guest booking schema.
 *
 * 2026_08_24_020859_make_user_id_not_nullable_on_senders_table was merged after
 * 2026_09_21_000001_allow_guest_senders had already run on some environments.
 * Laravel runs pending migrations regardless of filename order, so the older
 * migration re-applied NOT NULL to senders.user_id and broke guest checkout
 * ("Column 'user_id' cannot be null").
 *
 * This migration is idempotent: it inspects the live schema and only changes
 * what is missing, so it is safe on every environment (fresh, partially
 * migrated, or already correct).
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->ensureSenderUserIdIsNullable();

        if (! Schema::hasColumn('bookings', 'guest_token')) {
            Schema::table('bookings', function (Blueprint $table) {
                $table->string('guest_token', 64)->nullable()->unique()->after('reference_number');
            });
        }

        if (! Schema::hasColumn('bookings', 'is_guest')) {
            Schema::table('bookings', function (Blueprint $table) {
                $table->boolean('is_guest')->default(false)->index()->after('guest_token');
            });
        }
    }

    public function down(): void
    {
        // Intentionally empty: reverting would re-break guest bookings.
    }

    private function ensureSenderUserIdIsNullable(): void
    {
        $column = collect(Schema::getColumns('senders'))->firstWhere('name', 'user_id');

        if (! $column || $column['nullable']) {
            return;
        }

        $foreignKeys = collect(Schema::getForeignKeys('senders'))
            ->filter(fn (array $fk) => $fk['columns'] === ['user_id'])
            ->pluck('name');

        Schema::table('senders', function (Blueprint $table) use ($foreignKeys) {
            foreach ($foreignKeys as $name) {
                $table->dropForeign($name);
            }
        });

        Schema::table('senders', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->change();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
    }
};
