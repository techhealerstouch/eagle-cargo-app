<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('generated_reports', function (Blueprint $row) {
            $row->id();
            $row->string('type'); // e.g., 'financial'
            $row->string('filename');
            $row->json('parameters'); // e.g., ['start_date' => '...', 'end_date' => '...']
            $row->foreignId('user_id')->constrained()->onDelete('cascade');
            $row->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('generated_reports');
    }
};
