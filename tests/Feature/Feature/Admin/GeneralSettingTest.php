<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class GeneralSettingTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => Role::Admin]);
    }

    public function test_only_admins_can_access_general_settings()
    {
        $nonAdmin = User::factory()->create(['role' => Role::Sender]);

        $this->actingAs($nonAdmin)
            ->get('/settings/general')
            ->assertStatus(403);

        $this->actingAs($this->admin)
            ->get('/settings/general')
            ->assertStatus(200);
    }

public function test_it_displays_general_settings()
    {
        $this->actingAs($this->admin)
            ->get('/settings/general')
            ->assertInertia(fn (Assert $page) => $page
                ->component('settings/general')
                ->has('settingsList', 9)
                ->where('settingsList.0.key', 'app_name')
                ->where('settingsList.0.display_name', 'Business Name')
            );
    }

public function test_it_updates_settings()
    {
        // Create an initial setting to update
        Setting::create([
            'key' => 'app_name',
            'value' => 'Old Name',
            'display_name' => 'Business Name',
            'group' => 'general',
            'type' => 'string',
        ]);

        $response = $this->actingAs($this->admin)
            ->post('/settings/general', [
                'settings' => [
                    ['key' => 'app_name', 'value' => 'New Name'],
                ],
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('settings', [
            'key' => 'app_name',
            'value' => 'New Name',
        ]);
    }
}
