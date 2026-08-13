<?php

namespace App\Console\Commands;

use App\Services\ZohoService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class TestZohoConnection extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'zoho:test';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Test the Zoho Books API connection and OAuth token refresh.';

    /**
     * Execute the console command.
     */
    public function handle(ZohoService $zohoService)
    {
        $this->info('Testing Zoho Connection...');

        $clientId = config('zoho.client_id');
        $orgId = config('zoho.org_id');

        if (! $clientId || ! $orgId) {
            $this->error('Zoho credentials not found in .env file.');

            return 1;
        }

        $this->comment('Attempting to refresh access token...');

        // We use reflection or just call the syncContact with a dummy to trigger refresh
        // but better to just test the endpoint directly.

        $response = Http::asForm()->post('https://accounts.zoho.com/oauth/v2/token', [
            'refresh_token' => config('zoho.refresh_token'),
            'client_id' => config('zoho.client_id'),
            'client_secret' => config('zoho.client_secret'),
            'grant_type' => 'refresh_token',
        ]);

        if ($response->successful()) {
            $this->info('Successfully refreshed access token!');
            $accessToken = $response->json('access_token');

            $this->comment('Attempting to fetch organization details...');
            $orgResponse = Http::withToken($accessToken)
                ->get(config('zoho.base_url').'/organizations/'.$orgId);

            if ($orgResponse->successful()) {
                $this->info('Connection Successful!');
                $this->line('Organization Name: '.$orgResponse->json('organization.name'));
            } else {
                $this->error('Failed to fetch organization details.');
                $this->error($orgResponse->body());
            }
        } else {
            $this->error('Failed to refresh access token. Please check your ZOHO_REFRESH_TOKEN, CLIENT_ID, and CLIENT_SECRET.');
            $this->error($response->body());
        }

        return 0;
    }
}
