<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->enum('type', ['fixed_discount', 'percentage_discount', 'per_box_discount', 'waive_empty_box_fee']);
            $table->decimal('value', 10, 2);
            $table->integer('min_box_count')->default(1);
            $table->decimal('min_spend', 10, 2)->nullable();
            $table->decimal('max_discount', 10, 2)->nullable();
            $table->integer('max_uses')->nullable();
            $table->integer('uses_count')->default(0);
            $table->integer('max_uses_per_user')->default(1);
            $table->json('applicable_pickup_zones')->nullable();
            $table->json('applicable_box_types')->nullable();
            $table->boolean('first_time_sender_only')->default(false);
            $table->dateTime('valid_from')->nullable();
            $table->dateTime('valid_to')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('promotion_redemptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('promotion_id')->constrained('promotions')->onDelete('cascade');
            $table->foreignId('booking_id')->constrained('bookings')->onDelete('cascade');
            $table->foreignId('sender_id')->constrained('senders')->onDelete('cascade');
            $table->decimal('discount_amount', 10, 2);
            $table->dateTime('redeemed_at');
            $table->timestamps();
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->foreignId('promotion_id')->nullable()->constrained('promotions')->onDelete('set null');
            $table->string('promo_code')->nullable();
            $table->decimal('discount_amount', 10, 2)->default(0.00);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->decimal('discount_amount', 10, 2)->default(0.00);
            $table->json('promotion_snapshot')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropColumn(['discount_amount', 'promotion_snapshot']);
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign(['promotion_id']);
            $table->dropColumn(['promotion_id', 'promo_code', 'discount_amount']);
        });

        Schema::dropIfExists('promotion_redemptions');
        Schema::dropIfExists('promotions');
    }
};
