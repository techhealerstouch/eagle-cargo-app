<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('areas', function (Blueprint $table) {
            // CBM rate (AUD per cubic metre) used to price custom-sized boxes.
            // e.g. 350.00 means $350 per CBM shipped to this area.
            $table->decimal('cbm_rate', 10, 2)->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('areas', function (Blueprint $table) {
            $table->dropColumn('cbm_rate');
        });
    }
};
