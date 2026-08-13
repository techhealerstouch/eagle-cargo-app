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
        \Illuminate\Support\Facades\DB::table('settings')->updateOrInsert(
            ['key' => 'invoice_tax_label'],
            [
                'value' => 'GST',
                'type' => 'string',
                'group' => 'invoice',
                'display_name' => 'Tax Label (e.g. GST, VAT, Tax)',
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        \Illuminate\Support\Facades\DB::table('settings')
            ->where('key', 'invoice_tax_rate')
            ->where('value', '0.12')
            ->update([
                'value' => '0.10',
                'updated_at' => now(),
            ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        \Illuminate\Support\Facades\DB::table('settings')->where('key', 'invoice_tax_label')->delete();

        \Illuminate\Support\Facades\DB::table('settings')
            ->where('key', 'invoice_tax_rate')
            ->where('value', '0.10')
            ->update([
                'value' => '0.12',
                'updated_at' => now(),
            ]);
    }
};
