<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Keep queue metadata tables healthy and small.
Schedule::command('queue:prune-failed --hours=168')
    ->dailyAt('02:00')
    ->withoutOverlapping();

Schedule::command('queue:prune-batches --hours=168')
    ->dailyAt('02:15')
    ->withoutOverlapping();

Schedule::command('queue:prune-batches --unfinished=72')
    ->dailyAt('02:30')
    ->withoutOverlapping();

Schedule::command('app:audit-data-integrity')
    ->dailyAt('03:00')
    ->withoutOverlapping();

Schedule::command('runsheets:cleanup-stale')
    ->dailyAt('23:55') // Run slightly before midnight to catch today's runsheets
    ->withoutOverlapping();

// Run queued jobs in environments where long-running supervisor daemons are not available (e.g. Hostinger).
if (config('queue.run_in_scheduler', (bool) env('QUEUE_RUN_IN_SCHEDULER', false))) {
    Schedule::command('queue:work --stop-when-empty --max-time=50 --tries=3')
        ->everyMinute()
        ->withoutOverlapping();
}
