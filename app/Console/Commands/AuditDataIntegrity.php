<?php

namespace App\Console\Commands;

use App\Services\DataIntegrityService;
use Illuminate\Console\Command;

class AuditDataIntegrity extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:audit-data-integrity';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Audit the system for orphan records, missing declarations, and other system health issues.';

    /**
     * Execute the console command.
     */
    public function handle(DataIntegrityService $service)
    {
        $this->info('Starting system health audit...');

        $service->cleanupResolvedWarnings();
        $results = $service->performAudit();

        $this->table(['Check', 'Issues Found'], [
            ['Missing Declarations', $results['missing_declarations']],
            ['Orphan Boxes', $results['orphan_boxes']],
            ['Box Count Mismatches', $results['box_count_mismatches']],
            ['Stale Scans', $results['stale_scan']],
            ['Missed Pickups', $results['missed_pickup']],
            ['Partial Pickups', $results['partial_pickup']],
            ['Delayed Warehouse Receipts', $results['delayed_receipt']],
            ['Missing Warehouse Locations', $results['missing_warehouse_location']],
            ['Overdue Batch Loading', $results['overdue_loading']],
            ['Batch Capacity Overruns', $results['batch_capacity_overrun']],
            ['Batch Status Blocks', $results['batch_status_blocked']],
            ['Missed Batch ETAs', $results['missed_eta']],
            ['Held Boxes', $results['held_box']],
            ['Damaged Boxes', $results['damaged_box']],
            ['Unpaid Loading Blocks', $results['unpaid_loading_block']],
            ['Delivery Overdue', $results['delivery_overdue']],
            ['Partial Deliveries', $results['partial_delivery']],
            ['Missing Delivery Proof', $results['delivery_proof_missing']],
            ['Paid Without Payment Record', $results['paid_no_payment_record']],
            ['Payment Balance Mismatches', $results['payment_balance_mismatch']],
            ['Delivered Without Invoice', $results['delivered_no_invoice']],
        ]);

        $this->info('Audit complete.');
    }
}
