<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BlankDeclarationTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_download_blank_declaration_pdf()
    {
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($user)
            ->get(route('declaration.blank'));

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'application/pdf');
        $response->assertHeader('Content-Disposition', 'attachment; filename=declaration-form-blank.pdf');
    }

    public function test_unauthenticated_user_cannot_download_blank_declaration_pdf()
    {
        $response = $this->get(route('declaration.blank'));

        $response->assertRedirect(route('login'));
    }
}
