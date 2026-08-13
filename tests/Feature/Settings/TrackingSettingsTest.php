<?php

namespace Tests\Feature\Settings;

use App\Enums\Role;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TrackingSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_tracking_settings_update_persists_allowed_roles_and_system_status()
    {
        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::Admin->value,
        ]);

        $steps = [
            [
                'key' => 'picked_up',
                'label' => 'Picked Up from Sender',
                'phase' => 'Origin',
                'icon' => 'package-check',
                'allowed_roles' => ['picker', 'admin'],
                'system_status' => 'collected',
            ],
            [
                'key' => 'received_at_warehouse',
                'label' => 'Received at Warehouse',
                'phase' => 'Destination',
                'icon' => 'warehouse',
                'allowed_roles' => ['warehouse', 'super_admin'],
                'system_status' => 'received_by_branch',
            ],
        ];

        $response = $this->actingAs($admin)
            ->put(route('settings.tracking.update'), [
                'steps' => $steps,
            ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        $setting = Setting::where('key', 'tracking_steps')->firstOrFail();
        $savedSteps = $setting->value;

        $this->assertSame(['picker', 'admin'], $savedSteps[0]['allowed_roles']);
        $this->assertSame('collected', $savedSteps[0]['system_status']);
        $this->assertSame(['warehouse', 'super_admin'], $savedSteps[1]['allowed_roles']);
        $this->assertSame('received_by_branch', $savedSteps[1]['system_status']);
    }
}
