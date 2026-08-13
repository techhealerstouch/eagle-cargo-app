<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Models\Area;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\Recipient;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class RecipientEmailOnBookingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake(); // Prevent actual jobs from running
    }

    public function test_recipient_email_is_saved_to_recipient_table_upon_booking()
    {
        // Setup Areas
        $manila = Area::create(['name' => 'Metro Manila', 'is_active' => true]);

        // Setup Box Types
        $jumbo = BoxType::create(['name' => 'Jumbo', 'dimensions' => '24x24x24', 'is_active' => true]);

        // Setup Box Prices
        BoxPrice::create(['area_id' => $manila->id, 'box_type_id' => $jumbo->id, 'price' => 100.00]);

        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $recipientEmail = 'jane.manila@example.com';

        $payload = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john.doe@example.com',
            'mobile' => '+61412345678',
            'address' => '123 Test Street',
            'suburb' => 'Test Suburb',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->format('Y-m-d H:i:s'),
            'payment_method' => 'stripe',
            'boxes' => [
                [
                    'area_id' => $manila->id,
                    'box_type_id' => $jumbo->id,
                    'recipient_first_name' => 'Jane',
                    'recipient_last_name' => 'Doe Manila',
                    'recipient_email' => $recipientEmail,
                    'recipient_address' => '456 Manila Ave',
                    'recipient_city' => 'Manila',
                    'recipient_province' => 'Metro Manila',
                    'recipient_zip_code' => '1000',
                    'recipient_phone' => '+639123456789',
                ],
            ],
        ];

        $response = $this->actingAs($user)->post(route('bookings.store'), $payload);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        // Assert recipient was created with the email field populated
        $this->assertDatabaseHas('recipients', [
            'email' => $recipientEmail,
            'name' => 'Jane Doe Manila',
        ]);

        // Verify the email is actually stored in the recipients table
        $recipient = Recipient::where('email', $recipientEmail)->first();
        $this->assertNotNull($recipient, 'Recipient should have email saved in the database');
        $this->assertEquals($recipientEmail, $recipient->email);
    }

    public function test_recipient_email_is_saved_when_using_existing_recipient()
    {
        // Setup Areas
        $manila = Area::create(['name' => 'Metro Manila', 'is_active' => true]);

        // Setup Box Types
        $jumbo = BoxType::create(['name' => 'Jumbo', 'dimensions' => '24x24x24', 'is_active' => true]);

        // Setup Box Prices
        BoxPrice::create(['area_id' => $manila->id, 'box_type_id' => $jumbo->id, 'price' => 100.00]);

        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $sender = $user->sender;

        // Create an existing recipient with email
        $existingRecipient = Recipient::create([
            'sender_id' => $sender->id,
            'area_id' => $manila->id,
            'name' => 'Existing Recipient',
            'email' => 'existing@example.com',
            'address' => '123 Existing St',
            'city' => 'Manila',
            'province' => 'Metro Manila',
            'zip_code' => '1000',
        ]);

        $payload = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john.doe@example.com',
            'mobile' => '+61412345678',
            'address' => '123 Test Street',
            'suburb' => 'Test Suburb',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->format('Y-m-d H:i:s'),
            'payment_method' => 'stripe',
            'boxes' => [
                [
                    'area_id' => $manila->id,
                    'box_type_id' => $jumbo->id,
                    'recipient_id' => $existingRecipient->id,
                ],
            ],
        ];

        $response = $this->actingAs($user)->post(route('bookings.store'), $payload);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        // Verify the existing recipient email is still intact
        $this->assertDatabaseHas('recipients', [
            'id' => $existingRecipient->id,
            'email' => 'existing@example.com',
        ]);
    }

    public function test_cannot_modify_existing_recipient_when_selected()
    {
        // Setup Areas
        $manila = Area::create(['name' => 'Metro Manila', 'is_active' => true]);

        // Setup Box Types
        $jumbo = BoxType::create(['name' => 'Jumbo', 'dimensions' => '24x24x24', 'is_active' => true]);

        // Setup Box Prices
        BoxPrice::create(['area_id' => $manila->id, 'box_type_id' => $jumbo->id, 'price' => 100.00]);

        /** @var User $user */
        $user = User::factory()->create([
            'role' => Role::Sender,
            'email_verified_at' => now(),
        ]);

        $sender = $user->sender;

        // Create an existing recipient with known data
        $existingRecipient = Recipient::create([
            'sender_id' => $sender->id,
            'area_id' => $manila->id,
            'name' => 'Original Name',
            'email' => 'original@example.com',
            'address' => '123 Original St',
            'city' => 'Manila',
            'province' => 'Metro Manila',
            'zip_code' => '1000',
            'phone_number' => '+639123456789',
        ]);

        // Try to book with recipient_id but provide DIFFERENT recipient data
        // The backend should IGNORE the modified data and use the existing recipient
        $payload = [
            'first_name' => 'John',
            'last_name' => 'Doe',
            'email' => 'john.doe@example.com',
            'mobile' => '+61412345678',
            'address' => '123 Test Street',
            'suburb' => 'Test Suburb',
            'state' => 'NSW',
            'postcode' => '2000',
            'preferred_date' => now()->addDays(3)->format('Y-m-d H:i:s'),
            'payment_method' => 'stripe',
            'boxes' => [
                [
                    'area_id' => $manila->id,
                    'box_type_id' => $jumbo->id,
                    'recipient_id' => $existingRecipient->id,
                    // THESE FIELDS SHOULD BE IGNORED - the existing recipient data should be used
                    'recipient_first_name' => 'Modified',
                    'recipient_last_name' => 'Name',
                    'recipient_email' => 'modified@example.com',
                    'recipient_address' => '999 Modified St',
                    'recipient_city' => 'Cebu',
                    'recipient_province' => 'Cebu Province',
                    'recipient_zip_code' => '6000',
                    'recipient_phone' => '+639999999999',
                ],
            ],
        ];

        $response = $this->actingAs($user)->post(route('bookings.store'), $payload);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect();

        // Refresh the existing recipient from database
        $existingRecipient->refresh();

        // Verify the existing recipient data was NOT modified
        $this->assertEquals('Original Name', $existingRecipient->name);
        $this->assertEquals('original@example.com', $existingRecipient->email);
        $this->assertEquals('123 Original St', $existingRecipient->address);
        $this->assertEquals('Manila', $existingRecipient->city);
        $this->assertEquals('+639123456789', $existingRecipient->phone_number);

        // Verify that a new recipient was NOT created with the modified data
        $this->assertNull(
            Recipient::where('email', 'modified@example.com')->first(),
            'A new recipient should not have been created with modified email'
        );
    }
}
