<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PruneAuditLogs extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'audit:prune
                            {--days= : The number of days of audit logs to retain (default: from env or 365)}
                            {--dry-run : Simulate the pruning process without actually deleting records}
                            {--archive : Export pruned logs to a compressed CSV archive before deleting}
                            {--chunk=1000 : Chunk size for batch deletions to prevent database table locks}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Prune old activity and audit logs according to the data retention policy.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $days = (int) ($this->option('days') ?: config('audit.retention_days', env('AUDIT_LOG_RETENTION_DAYS', 365)));
        $isDryRun = (bool) $this->option('dry-run');
        $shouldArchive = (bool) $this->option('archive');
        $chunkSize = max(100, (int) $this->option('chunk'));

        $cutoffDate = Carbon::now()->subDays($days);

        $this->info("Audit log retention policy: {$days} days.");
        $this->info("Cutoff date: {$cutoffDate->toDateTimeString()}");

        $query = ActivityLog::where('created_at', '<', $cutoffDate);
        $totalCount = $query->count();

        if ($totalCount === 0) {
            $this->info('No audit logs older than the retention period found. Everything is clean!');

            return Command::SUCCESS;
        }

        if ($isDryRun) {
            $this->warn("[DRY RUN] {$totalCount} audit log records would be pruned.");

            return Command::SUCCESS;
        }

        if ($shouldArchive) {
            $this->archiveRecords($cutoffDate);
        }

        $this->info("Deleting {$totalCount} expired audit logs in chunks of {$chunkSize}...");

        $deletedCount = 0;
        $bar = $this->output->createProgressBar($totalCount);
        $bar->start();

        do {
            // Delete by ID chunks to prevent long-running table locks on Hostinger MySQL
            $ids = ActivityLog::where('created_at', '<', $cutoffDate)
                ->limit($chunkSize)
                ->pluck('id');

            if ($ids->isEmpty()) {
                break;
            }

            $deleted = ActivityLog::whereIn('id', $ids)->delete();
            $deletedCount += $deleted;
            $bar->advance($deleted);
        } while ($deleted > 0);

        $bar->finish();
        $this->newLine();
        $this->info("Successfully pruned {$deletedCount} audit log records.");

        return Command::SUCCESS;
    }

    /**
     * Export expired records to storage archive.
     */
    protected function archiveRecords(Carbon $cutoffDate): void
    {
        $filename = 'audit-archives/audit_archive_'.now()->format('Y_m_d_His').'.csv';
        $this->info("Archiving records to: storage/app/{$filename}...");

        $stream = fopen('php://temp', 'r+');
        fputcsv($stream, [
            'ID',
            'Request ID',
            'Timestamp',
            'User ID',
            'Category',
            'Action',
            'Description',
            'Model Type',
            'Model ID',
            'IP Address',
            'Context',
            'Changes JSON',
        ]);

        ActivityLog::where('created_at', '<', $cutoffDate)
            ->chunk(500, function ($logs) use ($stream) {
                foreach ($logs as $log) {
                    fputcsv($stream, [
                        $log->id,
                        $log->request_id,
                        $log->created_at?->toIso8601String(),
                        $log->user_id,
                        $log->event_category,
                        $log->action,
                        $log->description,
                        $log->model_type,
                        $log->model_id,
                        $log->ip_address,
                        $log->context,
                        json_encode($log->changes),
                    ]);
                }
            });

        rewind($stream);
        Storage::disk('local')->put($filename, stream_get_contents($stream));
        fclose($stream);

        $this->info('Archive saved successfully.');
    }
}
