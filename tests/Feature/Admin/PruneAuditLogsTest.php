<?php

namespace Tests\Feature\Admin;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PruneAuditLogsTest extends TestCase
{
    use DatabaseTransactions;

    public function test_prunes_logs_older_than_retention_days(): void
    {
        $user = User::factory()->create();

        // 1. Old log (400 days old)
        $oldLogId = DB::table('activity_logs')->insertGetId([
            'user_id' => $user->id,
            'model_type' => User::class,
            'model_id' => $user->id,
            'action' => 'created',
            'description' => 'Old user created',
            'event_category' => 'user',
            'context' => 'web',
            'created_at' => Carbon::now()->subDays(400),
            'updated_at' => Carbon::now()->subDays(400),
        ]);

        // 2. Recent log (30 days old)
        $recentLogId = DB::table('activity_logs')->insertGetId([
            'user_id' => $user->id,
            'model_type' => User::class,
            'model_id' => $user->id,
            'action' => 'updated',
            'description' => 'Recent user updated',
            'event_category' => 'user',
            'context' => 'web',
            'created_at' => Carbon::now()->subDays(30),
            'updated_at' => Carbon::now()->subDays(30),
        ]);

        $this->artisan('audit:prune', ['--days' => 365])
            ->assertSuccessful();

        $this->assertDatabaseMissing('activity_logs', ['id' => $oldLogId]);
        $this->assertDatabaseHas('activity_logs', ['id' => $recentLogId]);
    }

    public function test_dry_run_does_not_delete_logs(): void
    {
        $user = User::factory()->create();

        $oldLogId = DB::table('activity_logs')->insertGetId([
            'user_id' => $user->id,
            'model_type' => User::class,
            'model_id' => $user->id,
            'action' => 'created',
            'description' => 'Old user created',
            'event_category' => 'user',
            'context' => 'web',
            'created_at' => Carbon::now()->subDays(400),
            'updated_at' => Carbon::now()->subDays(400),
        ]);

        $this->artisan('audit:prune', ['--days' => 365, '--dry-run' => true])
            ->expectsOutputToContain('[DRY RUN]')
            ->assertSuccessful();

        $this->assertDatabaseHas('activity_logs', ['id' => $oldLogId]);
    }

    public function test_archive_option_exports_csv_before_deletion(): void
    {
        Storage::fake('local');
        $user = User::factory()->create();

        DB::table('activity_logs')->insertGetId([
            'user_id' => $user->id,
            'model_type' => User::class,
            'model_id' => $user->id,
            'action' => 'created',
            'description' => 'Old user created for archive',
            'event_category' => 'user',
            'context' => 'web',
            'created_at' => Carbon::now()->subDays(400),
            'updated_at' => Carbon::now()->subDays(400),
        ]);

        $this->artisan('audit:prune', ['--days' => 365, '--archive' => true])
            ->assertSuccessful();

        $files = Storage::disk('local')->allFiles('audit-archives');
        $this->assertNotEmpty($files);
    }
}
