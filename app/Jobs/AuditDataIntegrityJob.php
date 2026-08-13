<?php

namespace App\Jobs;

use App\Services\DataIntegrityService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class AuditDataIntegrityJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of seconds the job can run before timing out.
     *
     * @var int
     */
    public $timeout = 120;

    /**
     * The number of seconds after which the job's unique lock will be released.
     *
     * @var int
     */
    public $uniqueFor = 60;

    /**
     * Get the unique ID for the job.
     */
    public function uniqueId(): string
    {
        return 'audit-data-integrity';
    }

    /**
     * Execute the job.
     */
    public function handle(DataIntegrityService $service): void
    {
        $service->cleanupResolvedWarnings();
        $service->performAudit();
    }
}
