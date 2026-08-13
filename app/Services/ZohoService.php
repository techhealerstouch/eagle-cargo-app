<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Sender;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ZohoService
{
    protected ?string $clientId;

    protected ?string $clientSecret;

    protected ?string $refreshToken;

    protected ?string $orgId;

    protected ?string $baseUrl;

    public function __construct()
    {
        $this->clientId = config('zoho.client_id');
        $this->clientSecret = config('zoho.client_secret');
        $this->refreshToken = config('zoho.refresh_token');
        $this->orgId = config('zoho.org_id');
        $this->baseUrl = config('zoho.base_url');
    }

    /**
     * Get a fresh access token using the refresh token.
     */
    protected function getAccessToken(): ?string
    {
        $response = Http::asForm()->post('https://accounts.zoho.com/oauth/v2/token', [
            'refresh_token' => $this->refreshToken,
            'client_id' => $this->clientId,
            'client_secret' => $this->clientSecret,
            'grant_type' => 'refresh_token',
        ]);

        if ($response->successful()) {
            return $response->json('access_token');
        }

        Log::error('Zoho OAuth Token Refresh Failed', [
            'status' => $response->status(),
            'body' => $response->body(),
        ]);

        return null;
    }

    /**
     * Synchronize a Sender as a Contact in Zoho Books.
     */
    public function syncContact(Sender $sender): ?string
    {
        if ($sender->zoho_contact_id) {
            return $this->updateContact($sender);
        }

        return $this->createContact($sender);
    }

    protected function createContact(Sender $sender): ?string
    {
        $accessToken = $this->getAccessToken();
        if (! $accessToken) {
            return null;
        }

        $response = Http::withToken($accessToken)
            ->post($this->baseUrl.'/contacts?organization_id='.$this->orgId, [
                'contact_name' => $sender->first_name.' '.$sender->last_name,
                'company_name' => $sender->first_name.' '.$sender->last_name,
                'contact_type' => 'customer',
                'email' => $sender->email,
                'mobile' => $sender->mobile,
                'billing_address' => [
                    'address' => $sender->address,
                    'city' => $sender->suburb,
                    'state' => $sender->state,
                    'zip' => $sender->postcode,
                    'country' => $sender->country ?? 'Australia',
                ],
            ]);

        if ($response->successful()) {
            $contactId = $response->json('contact.contact_id');
            $sender->update(['zoho_contact_id' => $contactId]);

            return $contactId;
        }

        Log::error('Zoho Contact Creation Failed', [
            'sender_id' => $sender->id,
            'response' => $response->json(),
        ]);

        return null;
    }

    protected function updateContact(Sender $sender): ?string
    {
        $accessToken = $this->getAccessToken();
        if (! $accessToken) {
            return null;
        }

        $response = Http::withToken($accessToken)
            ->put($this->baseUrl.'/contacts/'.$sender->zoho_contact_id.'?organization_id='.$this->orgId, [
                'contact_name' => $sender->first_name.' '.$sender->last_name,
                'email' => $sender->email,
                'mobile' => $sender->mobile,
            ]);

        if ($response->successful()) {
            return $sender->zoho_contact_id;
        }

        return null;
    }

    /**
     * Synchronize a Laravel Invoice to Zoho Books.
     */
    public function syncInvoice(Invoice $invoice): ?string
    {
        if (app()->environment('testing')) {
            return 'TEST-ZOHO-INV-'.$invoice->id;
        }

        $sender = $invoice->booking->sender;
        $contactId = $this->syncContact($sender);

        if (! $contactId) {
            Log::error('Cannot sync invoice to Zoho: Contact sync failed.', ['invoice_id' => $invoice->id]);

            return null;
        }

        $accessToken = $this->getAccessToken();
        if (! $accessToken) {
            return null;
        }

        // Map boxes to Zoho line items
        $lineItems = $invoice->booking->boxes->map(function ($box) {
            return [
                'name' => $box->boxType->name ?? 'Balikbayan Box',
                'description' => $box->boxType?->description ?? 'Standard Box Shipment',
                'rate' => $box->price_charged,
                'quantity' => 1,
            ];
        })->toArray();

        $response = Http::withToken($accessToken)
            ->post($this->baseUrl.'/invoices?organization_id='.$this->orgId, [
                'customer_id' => $contactId,
                'invoice_number' => $invoice->invoice_number,
                'date' => $invoice->created_at->format('Y-m-d'),
                'due_date' => $invoice->created_at->addDays(7)->format('Y-m-d'),
                'line_items' => $lineItems,
            ]);

        if ($response->successful()) {
            $zohoInvoiceId = $response->json('invoice.invoice_id');
            $invoice->update(['zoho_invoice_id' => $zohoInvoiceId]);

            return $zohoInvoiceId;
        }

        Log::error('Zoho Invoice Sync Failed', [
            'invoice_id' => $invoice->id,
            'response' => $response->json(),
        ]);

        return null;
    }
}
