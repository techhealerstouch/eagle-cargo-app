<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    $startTime = microtime(true);
    $pdf = Barryvdh\DomPDF\Facade\Pdf::loadView('declaration-blank')->setPaper('a4', 'portrait');
    file_put_contents('scratch/declaration-blank-after.pdf', $pdf->output());
    $endTime = microtime(true);
    echo "PDF generated successfully at scratch/declaration-blank-after.pdf in " . ($endTime - $startTime) . " seconds\n";
} catch (\Exception $e) {
    echo "Error generating PDF: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString() . "\n";
}
