<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('settings')
            ->where('key', 'declaration_terms')
            ->where(function ($query) {
                $query->where('value', 'like', '%Love Balikbayan%')
                    ->orWhere('value', 'like', '%Orient Freight%');
            })
            ->update(['value' => 'Eagle Cargo Terms and Conditions are displayed on the declaration form.']);

        DB::table('settings')
            ->where('key', 'declaration_brand_name')
            ->where('value', 'like', '%Love Balikbayan%')
            ->update(['value' => 'Eagle Cargo Logistics System']);
    }

    public function down(): void
    {
        // The replaced legacy wording cannot be safely reconstructed.
    }
};
