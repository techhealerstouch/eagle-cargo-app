<?php

namespace Tests\Unit\Services;

use App\Models\Setting;
use App\Services\SettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

class SettingsServiceTest extends TestCase
{
    use RefreshDatabase;

    private SettingsService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new SettingsService;
    }

    public function test_it_can_get_a_setting_value()
    {
        Setting::create([
            'key' => 'test_key',
            'value' => 'test_value',
            'display_name' => 'Test Key',
            'type' => 'string',
            'group' => 'general',
        ]);

        $value = $this->service->get('test_key');

        $this->assertEquals('test_value', $value);
    }

    public function test_it_returns_default_if_setting_not_found()
    {
        $value = $this->service->get('non_existent', 'default_value');

        $this->assertEquals('default_value', $value);
    }

    public function test_it_caches_setting_value()
    {
        $setting = Setting::create([
            'key' => 'cache_key',
            'value' => 'initial_value',
            'display_name' => 'Cache Key',
            'type' => 'string',
        ]);

        // First call to populate cache
        $this->service->get('cache_key');
        $this->assertTrue(Cache::has('setting.cache_key'));

        // Update database directly
        $setting->update(['value' => 'updated_value']);

        // Service should still return cached value
        $this->assertEquals('initial_value', $this->service->get('cache_key'));
    }

    public function test_it_clears_cache_on_set()
    {
        Setting::create([
            'key' => 'update_key',
            'value' => 'old_value',
            'display_name' => 'Update Key',
            'type' => 'string',
            'group' => 'general',
        ]);

        $this->service->get('update_key');
        $this->service->getGroup('general');
        $this->assertTrue(Cache::has('setting.update_key'));
        $this->assertTrue(Cache::has('setting.group.general'));

        $this->service->set('update_key', 'new_value');

        $this->assertFalse(Cache::has('setting.update_key'));
        $this->assertFalse(Cache::has('setting.group.general'));
        $this->assertEquals('new_value', $this->service->get('update_key'));
    }

    public function test_it_caches_settings_by_group()
    {
        $setting = Setting::create([
            'key' => 'group_key',
            'value' => 'initial_value',
            'display_name' => 'Group Key',
            'type' => 'string',
            'group' => 'logistics',
        ]);

        $group = $this->service->getGroup('logistics');

        $this->assertEquals('initial_value', $group->get('group_key'));
        $this->assertTrue(Cache::has('setting.group.logistics'));

        $setting->update(['value' => 'updated_value']);

        $this->assertEquals('initial_value', $this->service->getGroup('logistics')->get('group_key'));
    }

    public function test_it_normalizes_app_logo_for_browser_use()
    {
        Setting::create([
            'key' => 'app_logo',
            'value' => 'LOVE Logo.png',
            'display_name' => 'Business Logo',
            'type' => 'string',
            'group' => 'general',
        ]);

        $settings = $this->service->getGeneralSettings();

        $this->assertStringEndsWith('/LOVE%20Logo.png', $settings['appLogo']);
    }

    public function test_it_preserves_public_storage_app_logo_paths()
    {
        Setting::create([
            'key' => 'app_logo',
            'value' => '/storage/logos/brand logo.png',
            'display_name' => 'Business Logo',
            'type' => 'string',
            'group' => 'general',
        ]);

        $settings = $this->service->getGeneralSettings();

        $this->assertStringEndsWith('/storage/logos/brand%20logo.png', $settings['appLogo']);
    }

    public function test_it_uses_default_app_logo_when_none_is_configured()
    {
        $settings = $this->service->getGeneralSettings();

        $this->assertStringEndsWith('/images/love-logo.png', $settings['appLogo']);
    }
}
