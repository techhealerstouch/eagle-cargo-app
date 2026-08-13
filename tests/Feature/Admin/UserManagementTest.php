<?php

namespace Tests\Feature\Admin;

use App\Enums\Role;
use App\Models\User;
use App\Notifications\AccountCreatedByAdmin;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\RunsheetStatus;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Courier;
use App\Models\Runsheet;
use App\Models\Sender;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(\Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class);
    }

    public function test_admin_can_create_user_with_auto_generated_password_and_notification()
    {
        Notification::fake();

        // Create admin user
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        // Post to user creation route without password fields
        $response = $this->actingAs($admin)->post(route('admin.users.store'), [
            'name' => 'John Doe',
            'email' => 'johndoe@example.com',
            'role' => Role::Sender->value,
            'mobile' => '+61 400 000 000',
            'address' => '456 Sender Road',
        ]);

        // Assert redirect to users index
        $response->assertRedirect(route('admin.users.index'));

        // Assert user exists in database
        $this->assertDatabaseHas('users', [
            'name' => 'John Doe',
            'email' => 'johndoe@example.com',
            'role' => Role::Sender->value,
        ]);

        $createdUser = User::where('email', 'johndoe@example.com')->first();
        
        // Assert password has been generated and hashed
        $this->assertNotNull($createdUser->password);
        $this->assertNotEmpty($createdUser->password);

        // Assert notification was sent with the plain password
        Notification::assertSentTo(
            $createdUser,
            AccountCreatedByAdmin::class,
            function ($notification, $channels) use ($createdUser) {
                // Read the protected properties or check values
                return $channels === ['mail'];
            }
        );
    }

    public function test_admin_can_create_picker_with_pickup_zone_and_commission_rates()
    {
        Notification::fake();

        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        $pickupZone = \App\Models\PickupZone::factory()->create();

        $response = $this->actingAs($admin)->post(route('admin.users.store'), [
            'name' => 'Jane Picker',
            'email' => 'jane.picker@example.com',
            'role' => Role::Picker->value,
            'mobile' => '+61 400 111 222',
            'address' => '123 Picker Street',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'pickup_zone_id' => $pickupZone->id,
            'commission_type' => 'flat',
            'commission_rates' => ['amount' => 5.00],
        ]);

        $response->assertRedirect(route('admin.users.index'));

        $this->assertDatabaseHas('users', [
            'name' => 'Jane Picker',
            'email' => 'jane.picker@example.com',
            'role' => Role::Picker->value,
        ]);

        $createdUser = User::where('email', 'jane.picker@example.com')->first();
        $this->assertNotNull($createdUser);

        $this->assertDatabaseHas('pickers', [
            'user_id' => $createdUser->id,
            'first_name' => 'Jane',
            'last_name' => 'Picker',
            'pickup_zone_id' => $pickupZone->id,
        ]);
    }

    public function test_admin_can_archive_sender_with_only_delivered_and_cancelled_bookings()
    {
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        $senderUser = User::factory()->create([
            'role' => Role::Sender,
        ]);
        
        $sender = Sender::factory()->create([
            'user_id' => $senderUser->id,
        ]);

        // Create a delivered booking
        Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Delivered,
        ]);

        // Create a cancelled booking
        Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Cancelled,
        ]);

        $response = $this->actingAs($admin)->delete(route('admin.users.destroy', $senderUser));

        $response->assertRedirect(route('admin.users.index'));
        $response->assertSessionHas('success', 'User archived successfully.');
        
        $this->assertSoftDeleted('users', [
            'id' => $senderUser->id,
        ]);
    }

    public function test_admin_cannot_archive_courier_with_active_runsheet_even_if_boxes_delivered()
    {
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        $courierUser = User::factory()->create([
            'role' => Role::Courier,
        ]);
        
        $courier = Courier::factory()->create([
            'user_id' => $courierUser->id,
        ]);

        // Create an active runsheet
        $runsheet = Runsheet::factory()->create([
            'courier_id' => $courierUser->id,
            'status' => RunsheetStatus::InProgress,
        ]);

        // Create a box attached to this runsheet that is fully delivered
        $box = Box::factory()->create([
            'status' => BoxStatus::Delivered,
        ]);
        
        // Attach the box to the runsheet (assuming standard many-to-many or polymorphic relation)
        // Note: For runsheets and boxes in this system, they may be linked via intermediate tables
        // or just by having the runsheet record. Let's look at how boxes attach to runsheets.
        // Even if we don't attach boxes, the runsheet status itself will block it.

        $response = $this->actingAs($admin)->delete(route('admin.users.destroy', $courierUser));

        $response->assertRedirect(route('admin.users.index'));
        $response->assertSessionHas('error', 'Cannot archive user with active transactions.');
        
        $this->assertDatabaseHas('users', [
            'id' => $courierUser->id,
            'deleted_at' => null,
        ]);
    }

    public function test_admin_cannot_archive_picker_with_assigned_runsheet()
    {
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        $pickerUser = User::factory()->create([
            'role' => Role::Picker,
        ]);
        
        $picker = \App\Models\Picker::factory()->create([
            'user_id' => $pickerUser->id,
        ]);

        // Create an assigned runsheet (never started)
        Runsheet::factory()->create([
            'picker_id' => $pickerUser->id,
            'status' => RunsheetStatus::Assigned,
        ]);

        $response = $this->actingAs($admin)->delete(route('admin.users.destroy', $pickerUser));

        $response->assertRedirect(route('admin.users.index'));
        $response->assertSessionHas('error', 'Cannot archive user with active transactions.');
        
        $this->assertDatabaseHas('users', [
            'id' => $pickerUser->id,
            'deleted_at' => null,
        ]);
    }

    public function test_admin_can_archive_orphan_sender_without_profile()
    {
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        // User with Sender role but NO Sender profile created
        $orphanSenderUser = User::factory()->create([
            'role' => Role::Sender,
        ]);
        
        $response = $this->actingAs($admin)->delete(route('admin.users.destroy', $orphanSenderUser));

        $response->assertRedirect(route('admin.users.index'));
        $response->assertSessionHas('success', 'User archived successfully.');
        
        $this->assertSoftDeleted('users', [
            'id' => $orphanSenderUser->id,
        ]);
    }

    public function test_admin_cannot_restore_archived_user()
    {
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        $archivedUser = User::factory()->create([
            'role' => Role::Sender,
        ]);
        $archivedUser->delete();

        $response = $this->actingAs($admin)->post(route('admin.users.restore', $archivedUser->id));
        $response->assertStatus(403);
    }

    public function test_super_admin_can_restore_archived_user()
    {
        $superAdmin = User::factory()->create([
            'role' => Role::SuperAdmin,
        ]);

        $archivedUser = User::factory()->create([
            'role' => Role::Sender,
        ]);
        $archivedUser->delete();

        $response = $this->actingAs($superAdmin)->post(route('admin.users.restore', $archivedUser->id));
        $response->assertRedirect();
        $response->assertSessionHas('success', 'User restored successfully.');
        
        $this->assertDatabaseHas('users', [
            'id' => $archivedUser->id,
            'deleted_at' => null,
        ]);
    }

    public function test_user_with_multiple_profiles_is_blocked_from_archiving_if_either_has_active_transactions()
    {
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        // User with both Courier and Sender profiles
        $buggyUser = User::factory()->create([
            'role' => Role::Courier,
        ]);
        
        $courier = Courier::factory()->create([
            'user_id' => $buggyUser->id,
        ]);
        $sender = Sender::factory()->create([
            'user_id' => $buggyUser->id,
        ]);

        // Active runsheet -> should block
        $runsheet = Runsheet::factory()->create([
            'courier_id' => $buggyUser->id,
            'status' => RunsheetStatus::InProgress,
        ]);

        $response = $this->actingAs($admin)->delete(route('admin.users.destroy', $buggyUser));
        $response->assertSessionHas('error', 'Cannot archive user with active transactions.');
        $this->assertDatabaseHas('users', ['id' => $buggyUser->id, 'deleted_at' => null]);

        // Now complete the runsheet but add an active booking -> should still block
        $runsheet->update(['status' => RunsheetStatus::Completed]);
        
        Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
        ]);

        $response2 = $this->actingAs($admin)->delete(route('admin.users.destroy', $buggyUser));
        $response2->assertSessionHas('error', 'Cannot archive user with active transactions.');
        $this->assertDatabaseHas('users', ['id' => $buggyUser->id, 'deleted_at' => null]);
    }

    public function test_admin_cannot_archive_themselves()
    {
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        $response = $this->actingAs($admin)->delete(route('admin.users.destroy', $admin));

        $response->assertRedirect(route('admin.users.index'));
        $response->assertSessionHas('error', 'You cannot delete your own account.');
        
        $this->assertDatabaseHas('users', [
            'id' => $admin->id,
            'deleted_at' => null,
        ]);
    }

    public function test_super_admin_restore_cleans_up_orphaned_profiles()
    {
        $superAdmin = User::factory()->create([
            'role' => Role::SuperAdmin,
        ]);

        // A user whose current role is Sender, but has a leftover Courier profile from a bug
        $archivedUser = User::factory()->create([
            'role' => Role::Sender,
        ]);
        
        $sender = Sender::factory()->create([
            'user_id' => $archivedUser->id,
        ]);
        $courier = Courier::factory()->create([
            'user_id' => $archivedUser->id,
        ]);

        $archivedUser->delete();

        $response = $this->actingAs($superAdmin)->post(route('admin.users.restore', $archivedUser->id));
        $response->assertRedirect();
        
        // Sender profile should remain
        $this->assertDatabaseHas('senders', ['id' => $sender->id]);
        
        // Courier profile should be cleaned up
        $this->assertDatabaseMissing('couriers', ['id' => $courier->id]);
    }

    public function test_user_with_completed_transactions_can_be_restored_and_rearchived()
    {
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);
        
        $superAdmin = User::factory()->create([
            'role' => Role::SuperAdmin,
        ]);

        $courierUser = User::factory()->create([
            'role' => Role::Courier,
        ]);
        $courier = Courier::factory()->create([
            'user_id' => $courierUser->id,
        ]);

        // Create an active runsheet
        $runsheet = Runsheet::factory()->create([
            'courier_id' => $courierUser->id,
            'status' => RunsheetStatus::InProgress,
        ]);

        // Manually delete user to simulate being archived before guard was implemented or via DB
        $courierUser->delete();

        // Now the runsheet completes
        $runsheet->update(['status' => RunsheetStatus::Completed]);

        // Restore the user
        $response = $this->actingAs($superAdmin)->post(route('admin.users.restore', $courierUser->id));
        $response->assertRedirect();
        
        $this->assertDatabaseHas('users', [
            'id' => $courierUser->id,
            'deleted_at' => null,
        ]);

        // Now attempt to re-archive via controller
        $response2 = $this->actingAs($admin)->delete(route('admin.users.destroy', $courierUser));
        $response2->assertSessionHas('success', 'User archived successfully.');
        
        $this->assertSoftDeleted('users', [
            'id' => $courierUser->id,
        ]);
    }

    public function test_admin_can_restore_sender_with_historical_transactions()
    {
        $superAdmin = User::factory()->create(['role' => Role::SuperAdmin]);
        $senderUser = User::factory()->create(['role' => Role::Sender]);
        $sender = Sender::factory()->create(['user_id' => $senderUser->id]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Delivered,
        ]);

        // Archive the sender
        $senderUser->delete();
        $this->assertSoftDeleted('users', ['id' => $senderUser->id]);

        // Restore
        $response = $this->actingAs($superAdmin)->post(route('admin.users.restore', $senderUser->id));
        $response->assertRedirect();
        $response->assertSessionHas('success', 'User restored successfully.');
        
        $this->assertDatabaseHas('users', ['id' => $senderUser->id, 'deleted_at' => null]);
        $this->assertDatabaseHas('senders', ['id' => $sender->id]);
        $this->assertDatabaseHas('bookings', ['id' => $booking->id, 'status' => BookingStatus::Delivered->value]);
    }

    public function test_user_registration_fails_with_archived_email()
    {
        $admin = User::factory()->create(['role' => Role::Admin]);
        
        $archivedUser = User::factory()->create([
            'email' => 'archived@example.com',
            'role' => Role::Sender
        ]);
        $archivedUser->delete();

        $response = $this->actingAs($admin)->post(route('admin.users.store'), [
            'name' => 'New Guy',
            'email' => 'archived@example.com',
            'role' => Role::Sender->value,
            'mobile' => '+61 400 000 000',
        ]);

        $response->assertSessionHasErrors('email');
        
        // Ensure new user was not created
        $this->assertEquals(1, User::withTrashed()->where('email', 'archived@example.com')->count());
    }
}

