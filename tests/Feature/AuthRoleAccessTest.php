<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthRoleAccessTest extends TestCase
{
    use RefreshDatabase;

    // ---------------------------------------------------------------
    // 1. Authentication Flows
    // ---------------------------------------------------------------

    public function test_login_page_is_accessible(): void
    {
        $response = $this->get('/login');

        $response->assertStatus(200);
    }

    public function test_register_page_is_accessible(): void
    {
        $response = $this->get('/register');

        $response->assertStatus(200);
    }

    public function test_user_can_login_with_valid_credentials(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'email' => 'test@example.com',
            'password' => bcrypt('Password123!'),
            'email_verified_at' => now(),
        ]);

        $response = $this->post('/login', [
            'email' => 'test@example.com',
            'password' => 'Password123!',
        ]);

        $response->assertRedirect('/dashboard');
        $this->assertAuthenticatedAs($user);
    }

    public function test_user_cannot_login_with_invalid_credentials(): void
    {
        User::factory()->create([
            'email' => 'test@example.com',
            'password' => bcrypt('Password123!'),
        ]);

        $response = $this->post('/login', [
            'email' => 'test@example.com',
            'password' => 'WrongPassword!',
        ]);

        $response->assertSessionHasErrors();
        $this->assertGuest();
    }

    public function test_unauthenticated_user_is_redirected_to_login(): void
    {
        $response = $this->get('/dashboard');

        $response->assertRedirect('/login');
    }

    public function test_unverified_user_can_access_dashboard_if_verification_disabled(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'email_verified_at' => null,
        ]);

        $response = $this->actingAs($user)->get('/dashboard');

        // User model does not implement MustVerifyEmail, so they can access verified routes
        $response->assertStatus(200);
    }

    // ---------------------------------------------------------------
    // 2. Role-Based Access: Sender
    // ---------------------------------------------------------------

    public function test_sender_can_access_sender_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $routes = [
            '/dashboard',
            '/book',
            '/bookings',
        ];

        foreach ($routes as $route) {
            $response = $this->actingAs($user)->get($route);
            $this->assertNotEquals(403, $response->getStatusCode(), "Sender should access: {$route}");
        }
    }

    public function test_sender_cannot_access_admin_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $adminRoutes = [
            '/admin/bookings',
            '/admin/boxes',
            '/admin/runsheets',
            '/admin/batches',
            '/admin/invoices',
            '/admin/payments',
            '/admin/senders',
            '/admin/users',
            '/admin/enquiries',
            '/admin/shipping-updates',
            '/admin/recipients',
            '/admin/reports/financial',
        ];

        foreach ($adminRoutes as $route) {
            $response = $this->actingAs($user)->get($route);
            $this->assertEquals(403, $response->getStatusCode(), "Sender should NOT access: {$route}");
        }
    }

    public function test_sender_cannot_access_courier_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)->get('/courier/dashboard');
        $response->assertStatus(403);
    }

    public function test_sender_cannot_access_picker_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)->get('/picker/dashboard');
        $response->assertStatus(403);
    }

    // ---------------------------------------------------------------
    // 3. Role-Based Access: Courier
    // ---------------------------------------------------------------

    public function test_courier_can_access_courier_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Courier,
            'email_verified_at' => now(),
        ]);

        $routes = [
            '/courier/dashboard',
            '/courier/runsheets',
            '/courier/scan',
        ];

        foreach ($routes as $route) {
            $response = $this->actingAs($user)->get($route);
            $this->assertNotEquals(403, $response->getStatusCode(), "Courier should access: {$route}");
        }
    }

    public function test_courier_cannot_access_admin_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Courier,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)->get('/admin/bookings');
        $response->assertStatus(403);
    }

    public function test_courier_cannot_access_picker_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Courier,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)->get('/picker/dashboard');
        $response->assertStatus(403);
    }

    // ---------------------------------------------------------------
    // 4. Role-Based Access: Picker
    // ---------------------------------------------------------------

    public function test_picker_can_access_picker_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Picker,
            'email_verified_at' => now(),
        ]);

        $routes = [
            '/picker/dashboard',
            '/picker/runsheets',
            '/picker/scan',
        ];

        foreach ($routes as $route) {
            $response = $this->actingAs($user)->get($route);
            $this->assertNotEquals(403, $response->getStatusCode(), "Picker should access: {$route}");
        }
    }

    public function test_picker_cannot_access_admin_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Picker,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)->get('/admin/bookings');
        $response->assertStatus(403);
    }

    // ---------------------------------------------------------------
    // 5. Role-Based Access: Warehouse
    // ---------------------------------------------------------------

    public function test_warehouse_can_access_shared_admin_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Warehouse,
            'email_verified_at' => now(),
        ]);

        // Warehouse shares admin routes for boxes, runsheets, batches
        $sharedRoutes = [
            '/admin/boxes',
            '/admin/runsheets',
            '/admin/batches',
        ];

        foreach ($sharedRoutes as $route) {
            $response = $this->actingAs($user)->get($route);
            $this->assertNotEquals(403, $response->getStatusCode(), "Warehouse should access: {$route}");
        }
    }

    public function test_warehouse_cannot_access_admin_only_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Warehouse,
            'email_verified_at' => now(),
        ]);

        // These are admin/super_admin only (not warehouse)
        $adminOnlyRoutes = [
            '/admin/bookings',
            '/admin/invoices',
            '/admin/payments',
            '/admin/users',
            '/admin/senders',
        ];

        foreach ($adminOnlyRoutes as $route) {
            $response = $this->actingAs($user)->get($route);
            $this->assertEquals(403, $response->getStatusCode(), "Warehouse should NOT access: {$route}");
        }
    }

    // ---------------------------------------------------------------
    // 6. Role-Based Access: Admin
    // ---------------------------------------------------------------

    public function test_admin_can_access_all_admin_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Admin,
            'email_verified_at' => now(),
        ]);

        $adminRoutes = [
            '/admin/bookings',
            '/admin/boxes',
            '/admin/runsheets',
            '/admin/batches',
            '/admin/invoices',
            '/admin/payments',
            '/admin/senders',
            '/admin/users',
            '/admin/enquiries',
            '/admin/recipients',
            '/admin/shipping-updates',
            '/admin/reports/financial',
        ];

        foreach ($adminRoutes as $route) {
            $response = $this->actingAs($user)->get($route);
            $this->assertNotEquals(403, $response->getStatusCode(), "Admin should access: {$route}");
        }
    }

    public function test_admin_cannot_access_super_admin_only_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Admin,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)->get('/admin/data-integrity');
        $response->assertStatus(403);
    }

    public function test_fix_storage_route_requires_super_admin(): void
    {
        $this->get('/fix-storage')->assertRedirect('/login');

        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::Admin,
            'email_verified_at' => now(),
        ]);

        $this->actingAs($admin)->get('/fix-storage')->assertStatus(403);
    }

    public function test_run_tests_route_is_not_registered_outside_local_environment(): void
    {
        $this->get('/run-tests')->assertNotFound();
    }

    // ---------------------------------------------------------------
    // 7. Role-Based Access: Super Admin
    // ---------------------------------------------------------------

    public function test_super_admin_can_access_data_integrity_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::SuperAdmin,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)->get('/admin/data-integrity');
        $response->assertStatus(200);
    }

    // ---------------------------------------------------------------
    // 8. Role-Based Access: Recipient
    // ---------------------------------------------------------------

    public function test_recipient_can_access_recipient_dashboard(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Recipient,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)->get('/recipient/dashboard');
        $response->assertStatus(200);
    }

    public function test_recipient_cannot_access_admin_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Recipient,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)->get('/admin/bookings');
        $response->assertStatus(403);
    }

    // ---------------------------------------------------------------
    // 9. Settings Access
    // ---------------------------------------------------------------

    public function test_admin_can_access_settings_routes(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Admin,
            'email_verified_at' => now(),
        ]);

        $settingsRoutes = [
            '/settings/general',
            '/settings/invoice',
            '/settings/tracking',
            '/settings/logistics',
            '/settings/declaration',
        ];

        foreach ($settingsRoutes as $route) {
            $response = $this->actingAs($user)->get($route);
            $this->assertNotEquals(403, $response->getStatusCode(), "Admin should access settings: {$route}");
        }
    }

    public function test_sender_cannot_access_admin_settings(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)->get('/settings/general');
        $response->assertStatus(403);
    }

    // ---------------------------------------------------------------
    // 10. Policy Enforcement
    // ---------------------------------------------------------------

    public function test_booking_policy_prevents_cross_sender_access(): void
    {
        /** @var User $senderA */
        $senderA = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);
        $senderAProfile = Sender::factory()->create(['user_id' => $senderA->id]);

        /** @var User $senderB */
        $senderB = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);
        $senderBProfile = Sender::factory()->create(['user_id' => $senderB->id]);

        // Create booking owned by Sender A with Pending status (editable)
        $booking = Booking::factory()->create([
            'sender_id' => $senderAProfile->id,
            'status' => BookingStatus::Pending,
        ]);

        // Sender B tries to edit Sender A's booking
        // The controller redirects with error, doesn't abort 403
        $response = $this->actingAs($senderB)
            ->get(route('bookings.edit', $booking));

        // Controller redirects away with error message
        $response->assertRedirect(route('sender.bookings'));
        $response->assertSessionHas('error');
    }

    public function test_admin_can_access_any_booking(): void
    {
        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::Admin,
            'email_verified_at' => now(),
        ]);

        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
        ]);

        $response = $this->actingAs($admin)
            ->get(route('admin.bookings.show', $booking));

        $response->assertStatus(200);
    }
}
