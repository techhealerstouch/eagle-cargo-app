<?php

namespace App\Console\Commands;

use App\Models\Sender;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class GeocodeSenderAddresses extends Command
{
    protected $signature = 'senders:geocode {--force : Geocode all senders, even those with existing coordinates}';

    protected $description = 'Geocode sender addresses using Nominatim (OpenStreetMap) API';

    public function handle(): int
    {
        $force = $this->option('force');

        $query = Sender::query();

        if (!$force) {
            $query->where(function ($q) {
                $q->whereNull('latitude')
                    ->orWhereNull('longitude');
            });
        }

        $senders = $query->get();

        if ($senders->isEmpty()) {
            $this->info('No senders need geocoding.');
            return self::SUCCESS;
        }

        $this->info("Found {$senders->count()} sender(s) to geocode.");

        $bar = $this->output->createProgressBar($senders->count());
        $bar->start();

        $successCount = 0;
        $failCount = 0;

        foreach ($senders as $sender) {
            $address = $this->buildAddressString($sender);

            if (empty($address)) {
                $this->newLine();
                $this->warn("Skipping Sender #{$sender->id}: No address available");
                $failCount++;
                $bar->advance();
                continue;
            }

            $coordinates = $this->geocodeAddress($address);

            if ($coordinates) {
                $sender->update([
                    'latitude' => $coordinates['lat'],
                    'longitude' => $coordinates['lng'],
                ]);
                $successCount++;
            } else {
                $this->newLine();
                $this->warn("Failed to geocode Sender #{$sender->id}: {$address}");
                $failCount++;
            }

            $bar->advance();

            // Rate limiting: Nominatim requires max 1 request per second
            sleep(1);
        }

        $bar->finish();
        $this->newLine(2);

        $this->info("Geocoding complete!");
        $this->info("✓ Success: {$successCount}");
        if ($failCount > 0) {
            $this->warn("✗ Failed: {$failCount}");
        }

        return self::SUCCESS;
    }

    private function buildAddressString(Sender $sender): string
    {
        $parts = array_filter([
            $sender->address,
            $sender->suburb,
            $sender->state,
            $sender->postcode,
            $sender->country,
        ]);

        return implode(', ', $parts);
    }

    private function geocodeAddress(string $address): ?array
    {
        try {
            $response = Http::timeout(10)
                ->withHeaders([
                    'User-Agent' => 'LoveBalikbayanApp/1.0',
                ])
                ->get('https://nominatim.openstreetmap.org/search', [
                    'q' => $address,
                    'format' => 'json',
                    'limit' => 1,
                    'addressdetails' => 1,
                ]);

            if (!$response->successful()) {
                return null;
            }

            $data = $response->json();

            if (empty($data)) {
                return null;
            }

            $result = $data[0];

            return [
                'lat' => (float) $result['lat'],
                'lng' => (float) $result['lon'],
            ];
        } catch (\Exception $e) {
            return null;
        }
    }
}
