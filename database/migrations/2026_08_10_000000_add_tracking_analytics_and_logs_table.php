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


        Schema::create('tracking_logs', function (Blueprint $table) {
            $table->id();
            $table->morphs('trackable');
            $table->string('search_query');
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->string('source')->default('web'); // 'web' or 'api'
            $table->timestamps();

            $table->index(['trackable_type', 'trackable_id', 'created_at']);
            $table->index(['ip_address', 'search_query', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tracking_logs');


    }
};
