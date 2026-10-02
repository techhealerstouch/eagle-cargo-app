<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminSenderCreationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    public function test_admin_sender_creation_creates_exactly_one_sender_without_placeholder_duplicates(): void
    {
        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::Admin,
            'email_verified_at' => now(),
        ]);

        $senderData = [
            'first_name' => 'Ryan',
            'last_name' => 'Reganan',
            'email' => 'ryan.test@example.com',
            'mobile' => '+61483333333',
            'address' => 'Don Apolinar Velez Street',
            'suburb' => 'Cagayan de Oro',
            'state' => 'Misamis Oriental',
            'postcode' => '9000',
        ];

        $response = $this->actingAs($admin)
            ->post(route('admin.senders.store'), $senderData);

        $response->assertRedirect(route('admin.senders.index'));
        $response->assertSessionHas('success');

        // Verify exactly one User exists for this email
        $this->assertEquals(1, User::where('email', 'ryan.test@example.com')->count());

        // Verify exactly one Sender exists for this email
        $this->assertEquals(1, Sender::where('email', 'ryan.test@example.com')->count());

        // Verify no placeholder sender was created
        $this->assertDatabaseMissing('senders', [
            'email' => 'ryan.test@example.com',
            'mobile' => '0000000000',
        ]);
        $this->assertDatabaseMissing('senders', [
            'email' => 'ryan.test@example.com',
            'address' => 'Update Address',
        ]);

        // Verify the created sender has the exact submitted information and correct user_id
        $user = User::where('email', 'ryan.test@example.com')->first();
        $sender = Sender::where('email', 'ryan.test@example.com')->first();

        $this->assertNotNull($user);
        $this->assertNotNull($sender);
        $this->assertEquals($user->id, $sender->user_id);
        $this->assertEquals('+61483333333', $sender->mobile);
        $this->assertEquals('Don Apolinar Velez Street', $sender->address);
    }

    public function test_cleanup_duplicate_senders_command_removes_placeholder_and_keeps_real_sender(): void
    {
        // User::factory()->create automatically triggers UserObserver which generates the placeholder sender
        /** @var User $user */
        $user = User::factory()->create([
            'name' => 'Ryan Reganan',
            'email' => 'ryan.duplicate@example.com',
            'role' => Role::Sender,
        ]);

        // Create the real sender with actual contact info (simulating the duplicate state)
        $realSender = Sender::create([
            'user_id' => $user->id,
            'first_name' => 'Ryan',
            'last_name' => 'Reganan',
            'email' => 'ryan.duplicate@example.com',
            'mobile' => '+61483333333',
            'address' => 'Don Apolinar Velez Street',
        ]);

        // There are now 2 senders for this email (1 placeholder auto-created by UserObserver, 1 real)
        $this->assertEquals(2, Sender::where('email', 'ryan.duplicate@example.com')->count());

        // Run cleanup command
        $this->artisan('app:cleanup-duplicate-senders')
            ->assertSuccessful();

        // Verify only one sender remains
        $this->assertEquals(1, Sender::where('email', 'ryan.duplicate@example.com')->count());

        // Verify the remaining sender is the real one
        $remainingSender = Sender::where('email', 'ryan.duplicate@example.com')->first();
        $this->assertEquals($realSender->id, $remainingSender->id);
        $this->assertEquals('+61483333333', $remainingSender->mobile);
        $this->assertEquals('Don Apolinar Velez Street', $remainingSender->address);
    }
}
