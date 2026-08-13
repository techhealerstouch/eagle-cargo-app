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
        Schema::create('box_runsheet', function (Blueprint $table) {
            $table->id();
            $table->foreignId('box_id')->constrained()->cascadeOnDelete();
            $table->foreignId('runsheet_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('sequence')->nullable();
            $table->timestamps();

            $table->unique(['box_id', 'runsheet_id']);
        });
        
        // Data Migration: Port existing delivery runsheets from booking_runsheet to box_runsheet
        \Illuminate\Support\Facades\DB::statement("
            INSERT INTO box_runsheet (box_id, runsheet_id, sequence, created_at, updated_at)
            SELECT bx.id as box_id, br.runsheet_id, br.sequence, br.created_at, br.updated_at
            FROM booking_runsheet br
            JOIN runsheets r ON r.id = br.runsheet_id
            JOIN boxes bx ON bx.booking_id = br.booking_id
            WHERE r.type = 'delivery'
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('box_runsheet');
    }
};
