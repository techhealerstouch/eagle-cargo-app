<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Change the area_id foreign key on recipients to use RESTRICT on delete
     * instead of the implicit NO ACTION, so that an Area cannot be deleted
     * while recipients are still linked to it.
     */
    public function up(): void
    {
        Schema::table('recipients', function (Blueprint $table) {
            $table->dropForeign(['area_id']);
            $table->foreign('area_id')->references('id')->on('areas')->restrictOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('recipients', function (Blueprint $table) {
            $table->dropForeign(['area_id']);
            $table->foreign('area_id')->references('id')->on('areas');
        });
    }
};
