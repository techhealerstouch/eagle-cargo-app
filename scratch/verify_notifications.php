<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$notifications = DB::table('notifications')->select('type', 'data')->take(6)->get();
foreach ($notifications as $n) {
    $d = json_decode($n->data);
    $title = $d->title ?? 'NO TITLE';
    $message = $d->message ?? 'no msg';
    $type = $d->type ?? 'no type';
    echo "[{$type}] {$title} | {$message}\n";
}
