<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Models\PickupZone;
use App\Models\User;
use App\Notifications\AccountCreatedByAdmin;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PickerAccountCreationFlowTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_admin_creating_picker_sends_notification_with_credentials_and_portal_instructions(): void
    {
        Notification::fake();

        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        $pickupZone = PickupZone::factory()->create();

        $pickerData = [
            'name' => 'QA Picker Agent',
            'email' => 'qa.picker.auto@example.com',
            'role' => Role::Picker->value,
            'mobile' => '+61 412 345 678',
            'address' => '456 Test Street',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'pickup_zone_id' => $pickupZone->id,
            'commission_type' => 'flat',
            'commission_rates' => ['amount' => 5.00],
        ];

        // 1. Admin creates the picker
        $response = $this->actingAs($admin)->post(route('admin.users.store'), $pickerData);
        $response->assertRedirect(route('admin.users.index'));

        // 2. Verify User and Picker models are created
        $this->assertDatabaseHas('users', [
            'name' => 'QA Picker Agent',
            'email' => 'qa.picker.auto@example.com',
            'role' => Role::Picker->value,
        ]);

        $pickerUser = User::where('email', 'qa.picker.auto@example.com')->first();
        $this->assertNotNull($pickerUser);
        $this->assertDatabaseHas('pickers', [
            'user_id' => $pickerUser->id,
            'pickup_zone_id' => $pickupZone->id,
        ]);

        // 3. Capture the plain password from the sent notification & verify portal instructions
        $capturedPassword = null;
        Notification::assertSentTo(
            $pickerUser,
            AccountCreatedByAdmin::class,
            function (AccountCreatedByAdmin $notification) use (&$capturedPassword, $pickerUser) {
                $reflection = new \ReflectionClass($notification);
                $passwordProp = $reflection->getProperty('plainPassword');
                $passwordProp->setAccessible(true);
                $capturedPassword = $passwordProp->getValue($notification);

                $mail = $notification->toMail($pickerUser);
                $renderedLines = implode(' ', $mail->introLines);

                // Verify the mail contains email, password, and portal instructions
                $this->assertStringContainsString($pickerUser->email, $renderedLines);
                $this->assertStringContainsString($capturedPassword, $renderedLines);
                $this->assertStringContainsString('Picker Portal', $renderedLines);
                $this->assertStringContainsString('Instructions on how to access the Picker Portal', $renderedLines);
                $this->assertEquals('Log In to Picker Portal', $mail->actionText);
                $this->assertStringContainsString('login', strtolower($mail->actionUrl));

                return true;
            }
        );

        $this->assertNotNull($capturedPassword, 'Captured password from notification should not be null.');

        // 4. Test logging in as the picker using the captured default credentials
        $this->post('/logout');

        $loginResponse = $this->post('/login', [
            'email' => 'qa.picker.auto@example.com',
            'password' => $capturedPassword,
        ]);

        // Fortify redirects to home (/dashboard) which redirects picker to /picker/dashboard
        $loginResponse->assertRedirect('/dashboard');
        $this->assertAuthenticatedAs($pickerUser);

        // 5. Following redirect lands on picker dashboard
        $dashboardResponse = $this->actingAs($pickerUser)->get('/dashboard');
        $dashboardResponse->assertRedirect(route('picker.dashboard'));

        $pickerDashboardResponse = $this->actingAs($pickerUser)->get(route('picker.dashboard'));
        $pickerDashboardResponse->assertStatus(200);
    }

    public function test_admin_can_create_picker_with_explicit_default_password(): void
    {
        Notification::fake();

        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        $pickupZone = PickupZone::factory()->create();

        $manualPassword = 'DefaultPassword2026!';
        $pickerData = [
            'name' => 'QA Manual Picker',
            'email' => 'qa.picker.manual@example.com',
            'role' => Role::Picker->value,
            'mobile' => '+61 412 888 999',
            'address' => '789 Custom Street',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'pickup_zone_id' => $pickupZone->id,
            'commission_type' => 'flat',
            'commission_rates' => ['amount' => 5.00],
            'password' => $manualPassword,
            'password_confirmation' => $manualPassword,
            'send_welcome_email' => true,
        ];

        // 1. Admin creates the picker with explicit default password
        $response = $this->actingAs($admin)->post(route('admin.users.store'), $pickerData);
        $response->assertRedirect(route('admin.users.index'));

        $pickerUser = User::where('email', 'qa.picker.manual@example.com')->first();
        $this->assertNotNull($pickerUser);

        // 2. Notification must contain the explicit default password
        Notification::assertSentTo(
            $pickerUser,
            AccountCreatedByAdmin::class,
            function (AccountCreatedByAdmin $notification) use ($manualPassword, $pickerUser) {
                $mail = $notification->toMail($pickerUser);
                $renderedLines = implode(' ', $mail->introLines);

                $this->assertStringContainsString($manualPassword, $renderedLines);
                $this->assertStringContainsString('Picker Portal', $renderedLines);
                return true;
            }
        );

        // 3. Picker can log in with that manual default password
        $this->post('/logout');

        $loginResponse = $this->post('/login', [
            'email' => 'qa.picker.manual@example.com',
            'password' => $manualPassword,
        ]);

        $loginResponse->assertRedirect('/dashboard');
        $this->assertAuthenticatedAs($pickerUser);
    }
}
