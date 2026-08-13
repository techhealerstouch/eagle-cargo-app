<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProfileUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_profile_page_is_displayed()
    {
        /** @var User $user */
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->get(route('profile.edit'));

        $response->assertOk();
    }

    public function test_profile_information_can_be_updated()
    {
        /** @var User $user */
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->patch(route('profile.update'), [
                'name' => 'Test User',
                'email' => 'test@example.com',
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('profile.edit'));

        $user->refresh();

        $this->assertSame('Test User', $user->name);
        $this->assertSame('test@example.com', $user->email);
        $this->assertNull($user->email_verified_at);
    }

    public function test_profile_update_creates_and_updates_sender_record_for_sender_users()
    {
        /** @var User $user */
        $user = User::factory()->create([
            'name' => 'Original Name',
            'email' => 'original@example.com',
            'role' => 'sender',
        ]);

        $this->assertDatabaseHas('senders', ['user_id' => $user->id]);
        $user->sender()->forceDelete();
        $this->assertDatabaseMissing('senders', ['user_id' => $user->id]);

        $response = $this
            ->actingAs($user)
            ->patch(route('profile.update'), [
                'name' => 'Sender Updated',
                'email' => 'updated@example.com',
                'country' => 'Australia',
                'mobile' => '0412345678',
                'address' => '123 Test St',
                'suburb' => 'Sydney',
                'state' => 'NSW',
                'postcode' => '2000',
                'latitude' => -33.8688,
                'longitude' => 151.2093,
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('profile.edit'));

        $this->assertDatabaseHas('senders', [
            'user_id' => $user->id,
            'first_name' => 'Sender',
            'last_name' => 'Updated',
            'email' => 'updated@example.com',
            'country' => 'Australia',
            'mobile' => '0412345678',
            'address' => '123 Test St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'latitude' => -33.8688,
            'longitude' => 151.2093,
        ]);
    }

    public function test_email_verification_status_is_unchanged_when_the_email_address_is_unchanged()
    {
        /** @var User $user */
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->patch(route('profile.update'), [
                'name' => 'Test User',
                'email' => $user->email,
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect(route('profile.edit'));

        $this->assertNotNull($user->refresh()->email_verified_at);
    }

    public function test_user_can_delete_their_account()
    {
        /** @var User $user */
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->delete(route('profile.destroy'), [
                'password' => 'password',
            ]);

        $response
            ->assertSessionHasNoErrors()
            ->assertRedirect('/');

        $this->assertGuest();
        $this->assertSoftDeleted($user);
    }

    public function test_correct_password_must_be_provided_to_delete_account()
    {
        /** @var User $user */
        $user = User::factory()->create();

        $response = $this
            ->actingAs($user)
            ->from(route('profile.edit'))
            ->delete(route('profile.destroy'), [
                'password' => 'wrong-password',
            ]);

        $response
            ->assertSessionHasErrors('password')
            ->assertRedirect(route('profile.edit'));

        $this->assertNotNull($user->fresh());
    }
}
