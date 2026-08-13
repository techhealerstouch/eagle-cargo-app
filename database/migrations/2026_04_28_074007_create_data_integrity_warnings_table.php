<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('data_integrity_warnings', function (Blueprint $table) {
            $table->id();
            $table->string('type'); // e.g., missing_declaration, orphan_box, duplicate_booking
            $table->string('severity')->default('medium'); // low, medium, high
            $table->nullableMorphs('record'); // model_type and model_id
            $table->string('message');
            $table->boolean('is_resolved')->default(false);
            $table->timestamp('resolved_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['type', 'is_resolved']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('data_integrity_warnings');
    }
};
