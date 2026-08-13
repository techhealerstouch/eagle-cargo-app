<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Fortify\Features;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->skipUnlessFortifyFeature(Features::registration());
    }

    public function test_registration_screen_can_be_rendered()
    {
        $response = $this->get(route('register'));

        $response->assertOk();
    }

    public function test_new_users_can_register()
    {
        $response = $this->post(route('register.store'), [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'role' => 'sender',
            'mobile' => '+61400000000',
            'address' => '123 Test Street',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));
    }

    public function test_registration_creates_a_sender_profile_for_sender_users()
    {
        $this->post(route('register.store'), [
            'name' => 'Sender User',
            'email' => 'sender@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'role' => 'sender',
            'mobile' => '+61400000001',
            'address' => '456 Test Avenue',
        ])->assertRedirect(route('dashboard', absolute: false));

        $user = User::where('email', 'sender@example.com')->firstOrFail();

        $this->assertEquals(1, \App\Models\Sender::where('user_id', $user->id)->count());

        $this->assertDatabaseHas('senders', [
            'user_id' => $user->id,
            'first_name' => 'Sender',
            'last_name' => 'User',
            'email' => 'sender@example.com',
            'mobile' => '+61400000001',
            'address' => '456 Test Avenue',
        ]);
    }
}
