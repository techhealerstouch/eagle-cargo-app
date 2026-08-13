<?php

namespace App\Jobs;

use App\Models\Invoice;
use App\Services\ZohoService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SyncInvoiceToZoho implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $invoice;

    /**
     * The number of times the job may be attempted.
     *
     * @var int
     */
    public $tries = 3;

    /**
     * Create a new job instance.
     */
    public function __construct(Invoice $invoice)
    {
        $this->invoice = $invoice;
    }

    /**
     * Execute the job.
     */
    public function handle(ZohoService $zohoService): void
    {
        Log::info('Syncing invoice to Zoho', ['invoice_id' => $this->invoice->id]);

        $result = $zohoService->syncInvoice($this->invoice);

        if ($result) {
            Log::info('Invoice synced successfully to Zoho', ['invoice_id' => $this->invoice->id, 'zoho_id' => $result]);
        } else {
            Log::error('Invoice sync to Zoho failed', ['invoice_id' => $this->invoice->id]);
            $this->release(60); // Retry after 60 seconds
        }
    }
}
