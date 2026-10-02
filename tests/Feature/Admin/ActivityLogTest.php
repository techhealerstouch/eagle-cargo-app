<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Models\ActivityLog;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Auth\Events\Logout;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_super_admin_and_admin_can_access_activity_logs_index(): void
    {
        $superAdmin = User::factory()->create(['role' => Role::SuperAdmin->value]);
        $admin = User::factory()->create(['role' => Role::Admin->value]);

        ActivityLog::create([
            'user_id' => $superAdmin->id,
            'model_type' => User::class,
            'model_id' => $admin->id,
            'action' => 'created',
            'description' => 'Created Admin User',
            'event_category' => 'user',
            'context' => 'web',
            'ip_address' => '127.0.0.1',
        ]);

        $responseSuper = $this->actingAs($superAdmin)->get(route('admin.activity-logs.index'));
        $responseSuper->assertOk();
        $responseSuper->assertInertia(fn ($page) => $page->component('admin/activity-logs/index')->has('logs.data'));

        $responseAdmin = $this->actingAs($admin)->get(route('admin.activity-logs.index'));
        $responseAdmin->assertOk();
    }

    public function test_non_admin_users_cannot_access_activity_logs_index(): void
    {
        $sender = User::factory()->create(['role' => Role::Sender->value]);
        $courier = User::factory()->create(['role' => Role::Courier->value]);

        $this->actingAs($sender)->get(route('admin.activity-logs.index'))->assertForbidden();
        $this->actingAs($courier)->get(route('admin.activity-logs.index'))->assertForbidden();
    }

    public function test_model_mutations_automatically_create_activity_logs(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin->value]);

        $this->actingAs($admin);

        // 1. Create a Setting
        $setting = Setting::create([
            'key' => 'test_feature_flag',
            'value' => 'false',
            'type' => 'bool',
            'group' => 'general',
            'display_name' => 'Test Feature Flag',
        ]);

        $this->assertDatabaseHas('activity_logs', [
            'model_type' => Setting::class,
            'model_id' => $setting->id,
            'action' => 'created',
            'event_category' => 'settings',
        ]);

        // 2. Update the Setting
        $setting->update(['value' => 'true']);

        $latestLog = ActivityLog::where('model_type', Setting::class)
            ->where('model_id', $setting->id)
            ->where('action', 'updated')
            ->first();

        $this->assertNotNull($latestLog);
        $this->assertArrayHasKey('value', $latestLog->changes);
        $this->assertEquals(false, $latestLog->changes['value']['old']);
        $this->assertEquals(true, $latestLog->changes['value']['new']);
    }

    public function test_filter_by_category_and_search_query(): void
    {
        $admin = User::factory()->create(['role' => Role::Admin->value]);

        ActivityLog::create([
            'user_id' => $admin->id,
            'model_type' => 'App\Models\Invoice',
            'model_id' => 101,
            'action' => 'updated',
            'description' => 'Updated invoice tax calculation for INV-2026-001',
            'event_category' => 'financial',
            'context' => 'web',
            'ip_address' => '192.168.1.50',
        ]);

        ActivityLog::create([
            'user_id' => $admin->id,
            'model_type' => 'App\Models\Box',
            'model_id' => 202,
            'action' => 'created',
            'description' => 'Created Box TRK-2026-001-002',
            'event_category' => 'logistics',
            'context' => 'web',
            'ip_address' => '192.168.1.51',
        ]);

        // Filter by category=financial
        $responseCategory = $this->actingAs($admin)->get(route('admin.activity-logs.index', ['category' => 'financial']));
        $responseCategory->assertOk();
        $responseCategory->assertInertia(fn ($page) => $page->has('logs.data')
            ->where('logs.data.0.event_category', 'financial'));

        // Search by keyword
        $responseSearch = $this->actingAs($admin)->get(route('admin.activity-logs.index', ['search' => 'tax calculation for INV-2026-001']));
        $responseSearch->assertOk();
        $responseSearch->assertInertia(fn ($page) => $page->has('logs.data'));
    }

    public function test_activity_logs_csv_export(): void
    {
        $superAdmin = User::factory()->create(['role' => Role::SuperAdmin->value]);

        ActivityLog::create([
            'user_id' => $superAdmin->id,
            'model_type' => User::class,
            'model_id' => $superAdmin->id,
            'action' => 'created',
            'description' => 'System bootstrap initialized',
            'event_category' => 'general',
            'context' => 'cli',
            'ip_address' => '127.0.0.1',
        ]);

        $response = $this->actingAs($superAdmin)->get(route('admin.activity-logs.export'));

        $response->assertOk();
        $this->assertEquals('text/csv; charset=UTF-8', $response->headers->get('content-type'));

        // Verify export itself was logged
        $this->assertDatabaseHas('activity_logs', [
            'event_category' => 'compliance',
            'action' => 'exported',
        ]);
    }

    public function test_auth_events_produce_security_audit_logs(): void
    {
        $user = User::factory()->create(['name' => 'Juan Dela Cruz', 'email' => 'juan@example.com']);

        // Dispatch Login Event
        event(new Login('web', $user, false));

        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $user->id,
            'event_category' => 'security',
            'action' => 'login',
        ]);

        // Dispatch Logout Event
        event(new Logout('web', $user));

        $this->assertDatabaseHas('activity_logs', [
            'user_id' => $user->id,
            'event_category' => 'security',
            'action' => 'logout',
        ]);

        // Dispatch Failed Login Event
        event(new Failed('web', null, ['email' => 'hacker@example.com']));

        $this->assertDatabaseHas('activity_logs', [
            'event_category' => 'security',
            'action' => 'failed_login',
        ]);
    }
}
