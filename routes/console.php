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

Schedule::command('audit:prune')
    ->dailyAt('03:30')
    ->withoutOverlapping();

// Prune search tracking analytics older than 90 days to prevent disk bloat
Schedule::call(function () {
    \App\Models\TrackingLog::where('created_at', '<', now()->subDays(90))->delete();
})->name('prune-tracking-logs')
    ->dailyAt('03:45')
    ->withoutOverlapping();

// Clear expired password reset and auth tokens
Schedule::command('auth:clear-resets')
    ->dailyAt('04:00')
    ->withoutOverlapping();

Schedule::command('sanctum:prune-expired --hours=48')
    ->dailyAt('04:15')
    ->withoutOverlapping();

// Keep local Telescope tables compact during development
if (app()->environment('local') && class_exists(\Laravel\Telescope\TelescopeServiceProvider::class)) {
    Schedule::command('telescope:prune --hours=48')
        ->dailyAt('04:30')
        ->withoutOverlapping();
}

// Run queued jobs in environments where long-running supervisor daemons are not available (e.g. Hostinger).
if (config('queue.run_in_scheduler', (bool) env('QUEUE_RUN_IN_SCHEDULER', false))) {
    Schedule::command('queue:work --stop-when-empty --max-time=50 --tries=3')
        ->everyMinute()
        ->withoutOverlapping();
}
