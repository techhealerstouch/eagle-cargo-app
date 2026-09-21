<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class UserValidationTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
    }

    public function test_api_check_email_returns_available_for_new_email(): void
    {
        $response = $this->getJson('/api/users/check-email?email=brandnew.unique.user@example.com');

        $response->assertStatus(200)
            ->assertJson([
                'available' => true,
                'email' => 'brandnew.unique.user@example.com',
                'message' => 'Email address is available.',
            ]);
    }

    public function test_api_check_email_post_returns_unavailable_for_existing_email(): void
    {
        $user = User::factory()->create([
            'email' => 'existing.user@example.com',
        ]);

        $response = $this->postJson('/api/users/check-email', [
            'email' => 'existing.user@example.com',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'available' => false,
                'email' => 'existing.user@example.com',
                'message' => 'This email address is already registered.',
            ]);
    }

    public function test_api_check_email_is_case_insensitive(): void
    {
        User::factory()->create([
            'email' => 'lowercase.user@example.com',
        ]);

        $response = $this->getJson('/api/users/check-email?email=LOWERCASE.USER@EXAMPLE.COM');

        $response->assertStatus(200)
            ->assertJson([
                'available' => false,
                'email' => 'lowercase.user@example.com',
                'message' => 'This email address is already registered.',
            ]);
    }

    public function test_api_check_email_detects_soft_deleted_users(): void
    {
        $user = User::factory()->create([
            'email' => 'deleted.user@example.com',
        ]);
        $user->delete();

        $this->assertSoftDeleted('users', [
            'id' => $user->id,
            'email' => 'deleted.user@example.com',
        ]);

        $response = $this->getJson('/api/users/check-email?email=deleted.user@example.com');

        $response->assertStatus(200)
            ->assertJson([
                'available' => false,
                'email' => 'deleted.user@example.com',
                'message' => 'This email address is already registered.',
            ]);
    }

    public function test_api_check_email_respects_ignore_id(): void
    {
        $user = User::factory()->create([
            'email' => 'editing.user@example.com',
        ]);

        $response = $this->getJson("/api/users/check-email?email=editing.user@example.com&ignore_id={$user->id}");

        $response->assertStatus(200)
            ->assertJson([
                'available' => true,
                'email' => 'editing.user@example.com',
                'message' => 'Email address is available.',
            ]);
    }

    public function test_api_check_email_validates_email_format(): void
    {
        $response = $this->getJson('/api/users/check-email?email=invalid-email-format');

        $response->assertStatus(422)
            ->assertJson([
                'available' => false,
            ]);
    }

    public function test_admin_check_email_route_accessible_by_admin(): void
    {
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        $response = $this->actingAs($admin)->getJson('/admin/users/check-email?email=some.admin.check@example.com');

        $response->assertStatus(200)
            ->assertJson([
                'available' => true,
                'email' => 'some.admin.check@example.com',
            ]);
    }

    public function test_admin_check_email_route_rejects_unauthenticated(): void
    {
        $response = $this->getJson('/admin/users/check-email?email=test@example.com');

        // Unauthenticated JSON request receives 401
        $response->assertStatus(401);
    }
}
