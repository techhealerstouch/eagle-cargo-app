<?php

namespace App\Console\Commands;

use App\Models\Invoice;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillInvoiceSnapshots extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'invoices:backfill-snapshots {--force : Force the backfill even if snapshots already exist}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Generate historical snapshots for invoices that are missing them';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $query = Invoice::with(['booking.sender', 'booking.boxes.boxType']);

        if (! $this->option('force')) {
            $query->whereNull('sender_snapshot')
                ->orWhereNull('booking_snapshot')
                ->orWhereNull('line_items_snapshot');
        }

        $invoices = $query->get();

        if ($invoices->isEmpty()) {
            $this->info('No invoices found that need backfilling.');

            return;
        }

        $this->info("Found {$invoices->count()} invoices to process.");
        $bar = $this->output->createProgressBar($invoices->count());

        foreach ($invoices as $invoice) {
            DB::transaction(function () use ($invoice) {
                // We use resolve...Snapshot because it has the logic to build from live data
                // then we manually assign them to the snapshot fields to persist them.

                $invoice->update([
                    'sender_snapshot' => $invoice->resolveSenderSnapshot(),
                    'booking_snapshot' => $invoice->resolveBookingSnapshot(),
                    'line_items_snapshot' => $invoice->resolveLineItemsSnapshot(),
                    'admin_team_snapshot' => $invoice->resolveAdminTeamSnapshot(),
                    'snapshot_taken_at' => $invoice->snapshot_taken_at ?? now(),
                ]);
            });

            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info('Successfully backfilled snapshots for all invoices.');
    }
}
