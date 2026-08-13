<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('batches')
            ->where('status', 'manifested')
            ->update(['status' => 'ready_to_close']);
    }

    public function down(): void
    {
        DB::table('batches')
            ->where('status', 'ready_to_close')
            ->update(['status' => 'manifested']);
    }
};
