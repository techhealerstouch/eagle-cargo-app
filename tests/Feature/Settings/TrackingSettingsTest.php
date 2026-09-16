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

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
    }

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
                'step_type' => 'checkpoint',
            ],
            [
                'key' => 'received_at_warehouse',
                'label' => 'Received at Warehouse',
                'phase' => 'Destination',
                'icon' => 'warehouse',
                'allowed_roles' => ['warehouse', 'super_admin'],
                'system_status' => 'received_by_branch',
                'step_type' => 'checkpoint',
            ],
            [
                'key' => 'delivered',
                'label' => 'Delivered',
                'phase' => 'Destination',
                'icon' => 'home',
                'allowed_roles' => ['courier', 'admin', 'super_admin'],
                'system_status' => 'delivered',
                'step_type' => 'checkpoint',
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
        $this->assertSame('checkpoint', $savedSteps[0]['step_type']);
        $this->assertSame(['warehouse', 'super_admin'], $savedSteps[1]['allowed_roles']);
        $this->assertSame('received_by_branch', $savedSteps[1]['system_status']);
        $this->assertSame('checkpoint', $savedSteps[1]['step_type']);
    }

    public function test_tracking_settings_rejects_journey_without_final_delivered_step()
    {
        /** @var User $admin */
        $admin = User::factory()->create(['role' => Role::Admin->value]);

        $steps = [
            [
                'key' => 'picked_up',
                'label' => 'Picked Up',
                'phase' => 'Origin',
                'icon' => 'package-check',
                'system_status' => 'collected',
                'step_type' => 'checkpoint',
            ],
            [
                'key' => 'in_transit_sea',
                'label' => 'In Transit',
                'phase' => 'International Transit',
                'icon' => 'ship',
                'system_status' => 'in_transit',
                'step_type' => 'ongoing',
            ],
        ];

        $response = $this->actingAs($admin)
            ->put(route('settings.tracking.update'), [
                'steps' => $steps,
            ]);

        $response->assertSessionHasErrors('steps');
    }

    public function test_legacy_settings_without_step_type_derive_semantic_types_on_read()
    {
        // Simulate legacy JSON stored in settings table without step_type
        Setting::create([
            'key' => 'tracking_steps',
            'value' => json_encode([
                [
                    'key' => 'picked_up',
                    'label' => 'Picked Up',
                    'phase' => 'Origin',
                    'order' => 1,
                    'icon' => 'package-check',
                    'system_status' => 'collected',
                ],
                [
                    'key' => 'in_transit_sea',
                    'label' => 'Shipping',
                    'phase' => 'International Transit',
                    'order' => 2,
                    'icon' => 'ship',
                    'system_status' => 'in_transit',
                ],
                [
                    'key' => 'delivered',
                    'label' => 'Delivered',
                    'phase' => 'Destination',
                    'order' => 3,
                    'icon' => 'home',
                    'system_status' => 'delivered',
                ],
            ]),
            'type' => 'json',
            'group' => 'tracking',
            'display_name' => 'Tracking Journey Steps',
        ]);

        $stepService = app(\App\Services\TrackingStepService::class);
        $steps = $stepService->getSteps();

        $this->assertEquals('checkpoint', $steps[0]['step_type']);
        $this->assertEquals('ongoing', $steps[1]['step_type']);
        $this->assertEquals('checkpoint', $steps[2]['step_type']);
    }
}
