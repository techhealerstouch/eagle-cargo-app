<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\FeatureFlag;
use App\Models\User;
use App\Services\DeveloperAccess;
use App\Services\FeatureAccess;
use Database\Seeders\FeatureFlagSeeder;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class DeveloperFeatureAccessTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_verified_developer_role_can_access_hidden_features(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);

        $this->assertTrue(app(DeveloperAccess::class)->isDeveloper($user));
        $this->assertTrue(app(FeatureAccess::class)->canAccess($user, 'sample_preview_feature'));
    }

    public function test_unverified_soft_deleted_and_non_developer_users_are_not_developers(): void
    {
        $service = app(DeveloperAccess::class);

        /** @var User $unverified */
        $unverified = User::factory()->create(['role' => Role::Developer, 'email_verified_at' => null]);
        /** @var User $deleted */
        $deleted = User::factory()->create(['role' => Role::Developer]);
        $deleted->delete();
        /** @var User $unlisted */
        $unlisted = User::factory()->create(['role' => Role::Admin]);

        $this->assertFalse($service->isDeveloper($unverified));
        $this->assertFalse($service->isDeveloper($deleted));
        $this->assertFalse($service->isDeveloper($unlisted));
    }

    public function test_more_than_two_active_developers_fail_closed(): void
    {
        $devs = User::factory()->count(3)->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);

        /** @var User|null $firstUser */
        $firstUser = $devs->first();
        $this->assertFalse(app(DeveloperAccess::class)->isDeveloper($firstUser));
    }

    public function test_normal_users_need_a_released_known_feature(): void
    {
        /** @var User $user */
        $user = User::factory()->create(['role' => Role::Sender]);
        $access = app(FeatureAccess::class);

        $this->assertFalse($access->canAccess($user, 'sample_preview_feature'));
        FeatureFlag::create(['feature_key' => 'sample_preview_feature', 'enabled' => true]);
        $this->assertTrue($access->canAccess($user, 'sample_preview_feature'));
    }

    public function test_developer_console_index_accessible_only_by_verified_developer(): void
    {
        /** @var User $developer */
        $developer = User::factory()->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);
        /** @var User $superAdmin */
        $superAdmin = User::factory()->create(['role' => Role::SuperAdmin]);
        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin]);
        /** @var User $sender */
        $sender = User::factory()->create(['role' => Role::Sender]);

        // Developer can view empty console cleanly
        $response = $this->actingAs($developer)->get(route('developer.features.index'));
        $response->assertOk();

        // Non-developers receive 404 (hidden console)
        $this->actingAs($superAdmin)->get(route('developer.features.index'))->assertNotFound();
        $this->actingAs($admin)->get(route('developer.features.index'))->assertNotFound();
        $this->actingAs($sender)->get(route('developer.features.index'))->assertNotFound();

        Auth::logout();
        $this->get(route('developer.features.index'))->assertNotFound();
    }

    public function test_unregistered_features_cannot_be_mutated(): void
    {
        /** @var User $developer */
        $developer = User::factory()->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);

        // Unregistered feature returns 404
        $this->actingAs($developer)
            ->patch(route('developer.features.update', ['feature' => 'unregistered_feature']))
            ->assertNotFound();
    }

    public function test_non_developers_cannot_mutate_developer_features(): void
    {
        /** @var User $superAdmin */
        $superAdmin = User::factory()->create(['role' => Role::SuperAdmin]);
        /** @var User $sender */
        $sender = User::factory()->create(['role' => Role::Sender]);

        $this->actingAs($superAdmin)
            ->patch(route('developer.features.update', ['feature' => 'unregistered_feature']))
            ->assertNotFound();

        $this->actingAs($sender)
            ->patch(route('developer.features.update', ['feature' => 'unregistered_feature']))
            ->assertNotFound();

        Auth::logout();
        $this->patch(route('developer.features.update', ['feature' => 'unregistered_feature']))
            ->assertNotFound();
    }

    public function test_feature_middleware_fails_closed_for_unregistered_features(): void
    {
        Route::middleware(['web', 'feature:unregistered_feature'])->get('/_test/unregistered-feature', function () {
            return response('should-not-pass');
        });

        /** @var User $developer */
        $developer = User::factory()->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);
        /** @var User $sender */
        $sender = User::factory()->create(['role' => Role::Sender]);

        // 1. Unauthenticated guest receives 404
        $this->get('/_test/unregistered-feature')->assertNotFound();

        // 2. Normal user receives 404
        $this->actingAs($sender)->get('/_test/unregistered-feature')->assertNotFound();

        // 3. Developer also fails closed on unregistered features
        $this->actingAs($developer)->get('/_test/unregistered-feature')->assertNotFound();
    }

    public function test_developer_bypasses_role_middleware_and_gate_policies(): void
    {
        Route::middleware(['web', 'auth', 'role:admin'])->get('/_test/admin-role-route', function () {
            return response('role-granted');
        });

        /** @var User $developer */
        $developer = User::factory()->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);
        /** @var User $sender */
        $sender = User::factory()->create(['role' => Role::Sender]);

        // Normal sender cannot access admin role route
        $this->actingAs($sender)->get('/_test/admin-role-route')->assertForbidden();

        // Developer passes role middleware
        $this->actingAs($developer)->get('/_test/admin-role-route')->assertOk()->assertSee('role-granted');

        // Gate policies pass for developer
        $this->assertTrue(Gate::forUser($developer)->check('access-admin'));
        $this->assertTrue(Gate::forUser($developer)->check('viewPulse'));
        $this->assertFalse(Gate::forUser($sender)->check('access-admin'));
    }

    public function test_developer_has_administrative_authorization_powers(): void
    {
        $service = app(DeveloperAccess::class);
        /** @var User $developer */
        $developer = User::factory()->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);
        /** @var User $superAdmin */
        $superAdmin = User::factory()->create(['role' => Role::SuperAdmin]);
        /** @var User $sender */
        $sender = User::factory()->create(['role' => Role::Sender]);

        $this->assertTrue($service->isDeveloperOrSuperAdmin($developer));
        $this->assertTrue($service->isDeveloperOrSuperAdmin($superAdmin));
        $this->assertFalse($service->isDeveloperOrSuperAdmin($sender));

        $this->assertTrue($service->isDeveloperOrAdmin($developer));
        $this->assertTrue($service->isDeveloperOrAdmin($superAdmin));
        $this->assertFalse($service->isDeveloperOrAdmin($sender));
    }

    public function test_local_impersonation_authorization(): void
    {
        /** @var User $developer */
        $developer = User::factory()->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);
        /** @var User $superAdmin */
        $superAdmin = User::factory()->create(['role' => Role::SuperAdmin]);
        /** @var User $targetSender */
        $targetSender = User::factory()->create(['role' => Role::Sender]);
        /** @var User $otherSender */
        $otherSender = User::factory()->create(['role' => Role::Sender]);

        // Regular sender cannot impersonate
        $this->actingAs($otherSender)->get('/impersonate/' . $targetSender->id)->assertForbidden();

        // SuperAdmin can impersonate
        $this->actingAs($superAdmin)->get('/impersonate/' . $targetSender->id)->assertRedirect(route('dashboard'));

        // Developer can impersonate
        $this->actingAs($developer)->get('/impersonate/' . $targetSender->id)->assertRedirect(route('dashboard'));
    }

    public function test_developer_impersonating_target_role_inherits_feature_preview(): void
    {
        /** @var User $developer */
        $developer = User::factory()->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);
        /** @var User $targetSender */
        $targetSender = User::factory()->create(['role' => Role::Sender]);

        // Initially, hidden feature is not accessible to normal sender
        $this->assertFalse(app(FeatureAccess::class)->canAccess($targetSender, 'sample_preview_feature'));

        // Developer impersonates target sender
        $response = $this->actingAs($developer)->get('/impersonate/'.$targetSender->id);
        $response->assertRedirect(route('dashboard'));
        $this->assertTrue(session()->get('impersonated_by_developer'));
        $this->assertTrue(session()->get('developer_preview_mode'));

        // Now, through developer preview inheritance, sender can access hidden feature!
        $this->assertTrue(app(FeatureAccess::class)->canAccess($targetSender, 'sample_preview_feature'));
    }

    public function test_developer_can_toggle_preview_mode_in_session(): void
    {
        /** @var User $developer */
        $developer = User::factory()->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);
        /** @var User $targetSender */
        $targetSender = User::factory()->create(['role' => Role::Sender]);

        $this->actingAs($developer)->get('/impersonate/'.$targetSender->id);
        $this->assertTrue(app(FeatureAccess::class)->canAccess($targetSender, 'sample_preview_feature'));

        // Toggle preview OFF
        $this->post('/developer/toggle-preview');
        $this->assertFalse(session()->get('developer_preview_mode'));
        $this->assertFalse(app(FeatureAccess::class)->canAccess($targetSender, 'sample_preview_feature'));

        // Toggle preview back ON
        $this->post('/developer/toggle-preview');
        $this->assertTrue(session()->get('developer_preview_mode'));
        $this->assertTrue(app(FeatureAccess::class)->canAccess($targetSender, 'sample_preview_feature'));
    }

    public function test_persona_switcher_rapidly_switches_all_roles_for_developers(): void
    {
        /** @var User $developer */
        $developer = User::factory()->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);
        /** @var User $unauthorizedSender */
        $unauthorizedSender = User::factory()->create(['role' => Role::Sender]);

        // Non-developer/non-authorized forbidden from persona switcher
        $this->actingAs($unauthorizedSender)->get('/developer/persona/picker')->assertForbidden();

        // 1. Switch to Picker
        $this->actingAs($developer)->get('/developer/persona/picker')->assertRedirect(route('dashboard'));
        $this->assertEquals(Role::Picker, Auth::user()?->role);
        $this->assertTrue(session()->get('impersonated_by_developer'));
        $this->assertEquals($developer->id, session()->get('impersonator_id'));

        // 2. Switch to Warehouse
        $this->get('/developer/persona/warehouse')->assertRedirect(route('dashboard'));
        $this->assertEquals(Role::Warehouse, Auth::user()?->role);

        // 3. Switch to Courier
        $this->get('/developer/persona/courier')->assertRedirect(route('dashboard'));
        $this->assertEquals(Role::Courier, Auth::user()?->role);

        // 4. Switch to Admin
        $this->get('/developer/persona/admin')->assertRedirect(route('dashboard'));
        $this->assertEquals(Role::Admin, Auth::user()?->role);

        // 5. Switch to Super Admin
        $this->get('/developer/persona/super_admin')->assertRedirect(route('dashboard'));
        $this->assertEquals(Role::SuperAdmin, Auth::user()?->role);

        // 6. Switch to Sender (and verify Sender profile created)
        $this->get('/developer/persona/sender')->assertRedirect(route('dashboard'));
        $this->assertEquals(Role::Sender, Auth::user()?->role);
        $this->assertNotNull(Auth::user()?->sender);

        // 7. Switch to Recipient (and verify Recipient profile created)
        $this->get('/developer/persona/recipient')->assertRedirect(route('dashboard'));
        $this->assertEquals(Role::Recipient, Auth::user()?->role);
        $this->assertNotNull(Auth::user()?->recipient);

        // 8. Restore developer account via persona switcher
        $this->get('/developer/persona/developer')->assertRedirect(route('dashboard'));
        $this->assertEquals($developer->id, Auth::id());
        $this->assertFalse(session()->has('impersonated_by_developer'));
        $this->assertNull(session()->get('impersonator_id'));
    }

    public function test_super_admin_can_use_persona_switcher_and_restore_account(): void
    {
        /** @var User $superAdmin */
        $superAdmin = User::factory()->create([
            'role' => Role::SuperAdmin,
            'email_verified_at' => now(),
        ]);

        // SuperAdmin switches to picker
        $this->actingAs($superAdmin)->get('/developer/persona/picker')->assertRedirect(route('dashboard'));
        $this->assertEquals(Role::Picker, Auth::user()?->role);
        $this->assertTrue(session()->get('impersonated_by_developer'));
        $this->assertEquals($superAdmin->id, session()->get('impersonator_id'));

        // SuperAdmin can continue switching while impersonating
        $this->get('/developer/persona/warehouse')->assertRedirect(route('dashboard'));
        $this->assertEquals(Role::Warehouse, Auth::user()?->role);

        // Returning to SuperAdmin restores the original SuperAdmin user
        $this->get('/developer/persona/super_admin')->assertRedirect(route('dashboard'));
        $this->assertEquals($superAdmin->id, Auth::id());
        $this->assertEquals(Role::SuperAdmin, Auth::user()?->role);
        $this->assertFalse(session()->has('impersonated_by_developer'));
    }

    public function test_stop_impersonating_safely_returns_without_route_exceptions(): void
    {
        /** @var User $developer */
        $developer = User::factory()->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);

        $this->actingAs($developer)->get('/developer/persona/picker');
        $this->assertEquals(Role::Picker, Auth::user()?->role);

        // Calling /stop-impersonating returns to developer and redirects to dashboard
        $response = $this->get('/stop-impersonating');
        $response->assertRedirect(route('dashboard'));
        $this->assertEquals($developer->id, Auth::id());
        $this->assertFalse(session()->has('impersonated_by_developer'));
    }

    public function test_feature_flag_seeder_preserves_custom_flags(): void
    {
        FeatureFlag::create([
            'feature_key' => 'custom_dynamic_flag',
            'name' => 'Custom Flag',
            'status' => 'released',
            'enabled' => true,
            'is_system' => false,
        ]);
        $this->assertDatabaseHas('feature_flags', ['feature_key' => 'custom_dynamic_flag']);

        $this->seed(FeatureFlagSeeder::class);

        $this->assertDatabaseHas('feature_flags', ['feature_key' => 'custom_dynamic_flag']);
    }

    public function test_verified_developer_can_create_custom_feature_flag(): void
    {
        /** @var User $developer */
        $developer = User::factory()->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($developer)->post(route('developer.features.store'), [
            'name' => 'Mobile Barcode Scanner',
            'feature_key' => 'mobile_barcode_scanner',
            'description' => 'Enables laser barcode scanner UI',
            'status' => 'released',
            'audiences' => ['warehouse', 'courier'],
            'maintenance_message' => null,
        ]);

        $response->assertRedirect(route('developer.features.index'));
        $this->assertDatabaseHas('feature_flags', [
            'feature_key' => 'mobile_barcode_scanner',
            'name' => 'Mobile Barcode Scanner',
            'status' => 'released',
            'enabled' => true,
            'is_system' => false,
        ]);

        $flag = FeatureFlag::where('feature_key', 'mobile_barcode_scanner')->first();
        $this->assertEquals(['warehouse', 'courier'], $flag->audiences);
    }

    public function test_verified_developer_can_update_feature_flag_details(): void
    {
        /** @var User $developer */
        $developer = User::factory()->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);

        $flag = FeatureFlag::create([
            'feature_key' => 'custom_module',
            'name' => 'Custom Module',
            'status' => 'hidden',
            'audiences' => ['admin'],
            'is_system' => false,
        ]);

        $response = $this->actingAs($developer)->put(route('developer.features.update', ['feature' => 'custom_module']), [
            'name' => 'Updated Custom Module',
            'status' => 'maintenance',
            'audiences' => ['admin', 'warehouse'],
            'maintenance_message' => 'Under scheduled upgrade until 5 PM.',
        ]);

        $response->assertRedirect(route('developer.features.index'));
        $flag->refresh();
        $this->assertEquals('Updated Custom Module', $flag->name);
        $this->assertEquals('maintenance', $flag->status);
        $this->assertFalse($flag->enabled);
        $this->assertEquals(['admin', 'warehouse'], $flag->audiences);
        $this->assertEquals('Under scheduled upgrade until 5 PM.', $flag->maintenance_message);
    }

    public function test_cannot_delete_system_feature_flag_but_can_delete_custom(): void
    {
        /** @var User $developer */
        $developer = User::factory()->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);

        $systemFlag = FeatureFlag::create([
            'feature_key' => 'sys_flag',
            'name' => 'System Flag',
            'status' => 'released',
            'is_system' => true,
        ]);

        $customFlag = FeatureFlag::create([
            'feature_key' => 'cust_flag',
            'name' => 'Custom Flag',
            'status' => 'released',
            'is_system' => false,
        ]);

        // Attempt deleting system flag
        $this->actingAs($developer)
            ->delete(route('developer.features.destroy', ['feature' => 'sys_flag']))
            ->assertSessionHas('error');
        $this->assertDatabaseHas('feature_flags', ['feature_key' => 'sys_flag']);

        // Delete custom flag
        $this->actingAs($developer)
            ->delete(route('developer.features.destroy', ['feature' => 'cust_flag']))
            ->assertSessionHas('success');
        $this->assertDatabaseMissing('feature_flags', ['feature_key' => 'cust_flag']);
    }

    public function test_audience_role_filtering(): void
    {
        Route::middleware(['web', 'feature:warehouse_tools'])->get('/_test/warehouse-feature', function () {
            return response('warehouse-access-granted');
        });

        FeatureFlag::create([
            'feature_key' => 'warehouse_tools',
            'name' => 'Warehouse Tools',
            'status' => 'released',
            'audiences' => ['warehouse', 'super_admin'],
        ]);

        /** @var User $warehouseUser */
        $warehouseUser = User::factory()->create(['role' => Role::Warehouse]);
        /** @var User $senderUser */
        $senderUser = User::factory()->create(['role' => Role::Sender]);

        // Warehouse user is allowed
        $this->actingAs($warehouseUser)->get('/_test/warehouse-feature')
            ->assertOk()
            ->assertSee('warehouse-access-granted');

        // Sender user is denied (404)
        $this->actingAs($senderUser)->get('/_test/warehouse-feature')
            ->assertNotFound();
    }

    public function test_under_maintenance_returns_503_for_normal_users_and_bypassed_by_developers(): void
    {
        Route::middleware(['web', 'feature:maint_feature'])->get('/_test/maint-feature', function () {
            return response('feature-content');
        });

        FeatureFlag::create([
            'feature_key' => 'maint_feature',
            'name' => 'Maintenance Feature',
            'status' => 'maintenance',
            'audiences' => ['admin', 'sender'],
            'maintenance_message' => 'Performing urgent maintenance.',
        ]);

        /** @var User $sender */
        $sender = User::factory()->create(['role' => Role::Sender]);
        /** @var User $developer */
        $developer = User::factory()->create([
            'role' => Role::Developer,
            'email_verified_at' => now(),
        ]);

        // Regular sender receives 503 maintenance status
        $this->actingAs($sender)->get('/_test/maint-feature')
            ->assertStatus(503);

        // Developer bypasses maintenance and sees content
        $this->actingAs($developer)->get('/_test/maint-feature')
            ->assertOk()
            ->assertSee('feature-content');
    }
}
