<?php

use App\Models\Setting;

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "invoice_terms: " . strlen(Setting::where('key', 'invoice_terms')->first()?->value ?? '') . "\n";

echo "\nDeclaration Group:\n";
foreach(Setting::where('group', 'declaration')->get() as $s) {
    echo $s->key . ': ' . strlen($s->value) . "\n";
}
