<?php

namespace Tests\Feature;

use App\Models\DataIntegrityWarning;
use App\Models\User;
use App\Rules\SecureFile;
use App\Services\DataIntegrityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class SecurityHealthMonitoringTest extends TestCase
{
    use RefreshDatabase;

    public function test_detects_privileged_accounts_without_confirmed_two_factor_authentication(): void
    {
        $unprotectedAdmin = User::factory()->admin()->create();
        User::factory()->superAdmin()->withTwoFactor()->create();

        $count = app(DataIntegrityService::class)->checkPrivilegedUsersWithoutTwoFactor();

        $this->assertSame(1, $count);
        $this->assertDatabaseHas('data_integrity_warnings', [
            'type' => 'privileged_user_without_2fa',
            'record_type' => User::class,
            'record_id' => $unprotectedAdmin->id,
            'severity' => 'high',
            'is_resolved' => false,
        ]);
    }

    public function test_detects_debug_mode_when_enabled_for_production(): void
    {
        config([
            'app.env' => 'production',
            'app.debug' => true,
        ]);

        $count = app(DataIntegrityService::class)->checkProductionDebugMode();

        $this->assertSame(1, $count);
        $this->assertDatabaseHas('data_integrity_warnings', [
            'type' => 'debug_mode_enabled',
            'severity' => 'high',
            'is_resolved' => false,
        ]);
    }

    public function test_records_a_security_incident_when_a_suspicious_upload_is_blocked(): void
    {
        $file = UploadedFile::fake()->create('statement.pdf.exe', 24, 'application/pdf');

        $validator = Validator::make(
            ['document' => $file],
            ['document' => [new SecureFile]],
        );

        $this->assertTrue($validator->fails());
        $this->assertDatabaseHas('data_integrity_warnings', [
            'type' => 'suspicious_file_upload',
            'severity' => 'high',
            'is_resolved' => false,
        ]);
    }

    public function test_system_health_exposes_and_filters_security_incidents(): void
    {
        $admin = User::factory()->superAdmin()->withTwoFactor()->create();
        $warning = DataIntegrityWarning::create([
            'type' => 'suspicious_file_upload',
            'severity' => 'high',
            'message' => 'Blocked suspicious upload.',
            'metadata' => [
                'filename' => 'statement.pdf.exe',
                'signal' => 'multiple_extensions',
            ],
        ]);

        $response = $this->actingAs($admin)->get(route('admin.data-integrity.index', [
            'category' => 'security',
        ]));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('admin/DataIntegrity/Index')
            ->where('filters.category', 'security')
            ->where('filterOptions.categories.security', 1)
            ->where('metrics.telemetry.security.active_incidents', 1)
            ->where('warnings.data.0.id', $warning->id)
            ->where('warnings.data.0.type', 'suspicious_file_upload'));
    }
}
