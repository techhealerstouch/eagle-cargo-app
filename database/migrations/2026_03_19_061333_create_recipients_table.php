<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sender_id')->constrained()->cascadeOnDelete();
            $table->foreignId('area_id')->constrained();
            $table->string('name');
            $table->string('phone_number')->nullable();
            $table->text('address');
            $table->string('city');
            $table->string('province');
            $table->string('zip_code');
            $table->text('landmarks')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('recipients');
    }
};
