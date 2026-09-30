<?php

namespace App\Console\Commands;

use App\Models\Sender;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanupDuplicateSenders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:cleanup-duplicate-senders {--dry-run : Run without making actual changes}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean up duplicate placeholder senders (with "Update Address" or "0000000000") and merge them into real sender profiles.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $isDryRun = (bool) $this->option('dry-run');

        $this->info($isDryRun ? 'Scanning for duplicate senders (DRY RUN)...' : 'Cleaning up duplicate senders...');

        // Find emails that appear more than once among non-deleted senders
        $duplicateEmails = Sender::query()
            ->select('email')
            ->groupBy('email')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('email');

        // Also check for user_ids that appear more than once among non-deleted senders
        $duplicateUserIds = Sender::query()
            ->whereNotNull('user_id')
            ->select('user_id')
            ->groupBy('user_id')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('user_id');

        $affectedCount = 0;
        $deletedCount = 0;
        $handledDuplicateIds = [];

        // Process by email duplicates
        foreach ($duplicateEmails as $email) {
            $senders = Sender::where('email', $email)->orderBy('id')->get();
            $senders = $senders->reject(fn ($s) => in_array($s->id, $handledDuplicateIds, true));
            if ($senders->count() <= 1) {
                continue;
            }

            $this->processDuplicates($senders, "Email: {$email}", $isDryRun, $deletedCount, $handledDuplicateIds);
            $affectedCount++;
        }

        // Process by user_id duplicates (if not already handled)
        foreach ($duplicateUserIds as $userId) {
            $senders = Sender::where('user_id', $userId)->orderBy('id')->get();
            $senders = $senders->reject(fn ($s) => in_array($s->id, $handledDuplicateIds, true));
            if ($senders->count() <= 1) {
                continue;
            }

            $this->processDuplicates($senders, "User ID: {$userId}", $isDryRun, $deletedCount, $handledDuplicateIds);
            $affectedCount++;
        }

        if ($deletedCount === 0) {
            $this->info('No duplicate senders found.');
        } else {
            $this->info($isDryRun
                ? "Dry run complete: {$deletedCount} duplicate placeholder sender(s) identified for deletion across {$affectedCount} account(s)."
                : "Successfully cleaned up {$deletedCount} duplicate placeholder sender(s) across {$affectedCount} account(s)."
            );
        }

        return self::SUCCESS;
    }

    /**
     * @param \Illuminate\Database\Eloquent\Collection<int, Sender> $senders
     */
    protected function processDuplicates($senders, string $label, bool $isDryRun, int &$deletedCount, array &$handledDuplicateIds): void
    {
        // Identify placeholder senders vs real senders
        $placeholders = $senders->filter(function (Sender $s) {
            $isPlaceholderMobile = in_array(preg_replace('/[^0-9]/', '', $s->mobile), ['0000000000', '0', ''], true);
            $isPlaceholderAddress = strcasecmp(trim($s->address), 'Update Address') === 0;
            return $isPlaceholderMobile || $isPlaceholderAddress;
        });

        $realSenders = $senders->diff($placeholders);

        // If all are placeholders or none are, pick the one with most information or highest ID
        if ($realSenders->isEmpty()) {
            $primary = $senders->last();
            $duplicatesToDelete = $senders->filter(fn ($s) => $s->id !== $primary->id);
        } else {
            $primary = $realSenders->first();
            $duplicatesToDelete = $placeholders->count() > 0 ? $placeholders : $senders->filter(fn ($s) => $s->id !== $primary->id);
        }

        if ($duplicatesToDelete->isEmpty()) {
            return;
        }

        $handledDuplicateIds[] = $primary->id;

        $this->line("Processing {$label} (Keeping Sender ID: {$primary->id} - {$primary->first_name} {$primary->last_name})");

        foreach ($duplicatesToDelete as $duplicate) {
            $handledDuplicateIds[] = $duplicate->id;
            $this->line("  -> Duplicate ID: {$duplicate->id} (Mobile: {$duplicate->mobile}, Address: {$duplicate->address})");

            if (!$isDryRun) {
                DB::transaction(function () use ($primary, $duplicate) {
                    // Reassign bookings if any exist on duplicate
                    $duplicate->bookings()->update(['sender_id' => $primary->id]);

                    // Reassign recipients if any exist on duplicate
                    $duplicate->recipients()->update(['sender_id' => $primary->id]);

                    // If primary is missing user_id and duplicate had it, copy it over
                    if (!$primary->user_id && $duplicate->user_id) {
                        $primary->update(['user_id' => $duplicate->user_id]);
                    }

                    // Remove the duplicate record
                    $duplicate->forceDelete();
                });
            }

            $deletedCount++;
        }
    }
}
