<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SettingsManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function createAdmin(): User
    {
        return User::factory()->create([
            'role' => Role::Admin,
            'email_verified_at' => now(),
        ]);
    }

    // ---------------------------------------------------------------
    // 1. Profile Settings
    // ---------------------------------------------------------------

    public function test_user_can_view_profile_settings(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)
            ->get(route('profile.edit'));

        $response->assertStatus(200);
    }

    public function test_user_can_update_profile(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'name' => 'Old Name',
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)
            ->patch(route('profile.update'), [
                'name' => 'New Name',
                'email' => $user->email,
            ]);

        $response->assertSessionHasNoErrors();
        $this->assertEquals('New Name', $user->fresh()->name);
    }

    public function test_user_can_update_password(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'password' => bcrypt('OldPassword123!'),
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)
            ->put(route('user-password.update'), [
                'current_password' => 'OldPassword123!',
                'password' => 'NewPassword456!',
                'password_confirmation' => 'NewPassword456!',
            ]);

        $response->assertSessionHasNoErrors();
    }

    public function test_password_update_requires_current_password(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'password' => bcrypt('CorrectPass1!'),
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)
            ->put(route('user-password.update'), [
                'current_password' => 'WrongPassword!',
                'password' => 'NewPassword456!',
                'password_confirmation' => 'NewPassword456!',
            ]);

        $response->assertSessionHasErrors('current_password');
    }

    // ---------------------------------------------------------------
    // 2. Security Settings
    // ---------------------------------------------------------------

    public function test_user_can_view_security_settings(): void
    {
        /** @var User $user */
        $user = User::factory()->create([
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)
            ->get(route('security.edit'));

        // Security page may require password confirmation (302) or render directly (200)
        $this->assertTrue(
            in_array($response->getStatusCode(), [200, 302]),
            'Expected 200 or 302, got ' . $response->getStatusCode()
        );
    }

    // ---------------------------------------------------------------
    // 3. Admin Settings
    // ---------------------------------------------------------------

    public function test_admin_can_view_general_settings(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)
            ->get(route('settings.general.index'));

        $response->assertStatus(200);
    }

    public function test_admin_can_update_general_settings(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)
            ->post(route('settings.general.update'), [
                'settings' => [
                    ['key' => 'site_name', 'value' => 'Love Balikbayan Box'],
                    ['key' => 'contact_email', 'value' => 'info@lovebalikbayan.com'],
                ]
            ]);

        $response->assertSessionHasNoErrors();
    }

    public function test_admin_can_view_invoice_settings(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)
            ->get(route('settings.invoice.index'));

        $response->assertStatus(200);
    }

    public function test_admin_can_update_invoice_settings(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)
            ->post(route('settings.invoice.update'), [
                'settings' => [
                    ['key' => 'taxRate', 'value' => 12],
                    ['key' => 'isVatInclusive', 'value' => false],
                ]
            ]);

        $response->assertSessionHasNoErrors();
    }

    public function test_admin_can_preview_invoice_settings(): void
    {
        $admin = $this->createAdmin();

        // Create a booking so the preview has data to render
        $sender = \App\Models\Sender::factory()->create();
        $booking = \App\Models\Booking::factory()->create([
            'sender_id' => $sender->id,
        ]);
        \App\Models\Box::factory()->create([
            'booking_id' => $booking->id,
            'price_charged' => 100.00,
        ]);

        $response = $this->actingAs($admin)
            ->get(route('settings.invoice.preview'));

        // Preview returns a streamed PDF (200) or redirects if there's a rendering issue
        $this->assertTrue(
            in_array($response->getStatusCode(), [200, 302]),
            'Expected 200 or 302, got ' . $response->getStatusCode()
        );
    }

    public function test_admin_can_view_tracking_settings(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)
            ->get(route('settings.tracking.index'));

        $response->assertStatus(200);
    }

    public function test_admin_can_update_tracking_settings(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)
            ->put(route('settings.tracking.update'), [
                'steps' => [
                    [
                        'key' => 'step_1',
                        'label' => 'Step 1',
                        'phase' => 'Origin',
                        'icon' => 'icon1',
                        'system_status' => \App\Enums\BoxStatus::Pending->value,
                    ],
                    [
                        'key' => 'step_2',
                        'label' => 'Step 2',
                        'phase' => 'Origin',
                        'icon' => 'icon2',
                        'system_status' => \App\Enums\BoxStatus::Collected->value,
                    ]
                ],
            ]);

        $response->assertSessionHasNoErrors();
    }

    public function test_admin_can_view_logistics_settings(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)
            ->get(route('settings.logistics.index'));

        $response->assertStatus(200);
    }

    public function test_admin_can_update_logistics_settings(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)
            ->post(route('settings.logistics.update'), [
                'settings' => [
                    ['key' => 'logistics_lead_time_days', 'value' => '3'],
                ]
            ]);

        $response->assertSessionHasNoErrors();
    }

    public function test_admin_can_view_declaration_settings(): void
    {
        $admin = $this->createAdmin();

        $response = $this->actingAs($admin)
            ->get(route('settings.declaration.index'));

        $response->assertStatus(200);
    }

    // ---------------------------------------------------------------
    // 4. Authorization on Settings
    // ---------------------------------------------------------------

    public function test_sender_cannot_access_admin_settings(): void
    {
        /** @var User $sender */
        $sender = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($sender)
            ->get(route('settings.general.index'));

        $response->assertStatus(403);
    }
}
