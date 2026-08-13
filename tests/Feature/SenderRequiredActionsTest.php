<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\Role;
use App\Models\Booking;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class SenderRequiredActionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_sender_dashboard_shows_bookings_requiring_declaration()
    {
        // 1. Setup User (UserObserver will auto-create the sender)
        $user = User::factory()->create(['role' => Role::Sender]);
        $sender = $user->sender;

        // 2. Create a booking that needs declaration
        $bookingNeedsAction = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => \App\Enums\PaymentStatus::Paid,
            'declaration_data' => null,
            'declaration_form_path' => null,
            'reference_number' => 'NEED-DECL',
        ]);

        // 3. Create a booking that does NOT need declaration
        $bookingFinished = Booking::factory()->create([
            'sender_id' => $sender->id,
            'payment_status' => \App\Enums\PaymentStatus::Paid,
            'declaration_data' => ['items' => []],
            'reference_number' => 'DONE-DECL',
        ]);

        // 4. Visit Dashboard
        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('sender/Dashboard')
                ->has('bookingsRequiringAction', 1)
                ->where('bookingsRequiringAction.0.reference_number', 'NEED-DECL')
                ->where('bookingsRequiringAction.0.reason', 'Missing Declaration Form')
            );
    }

    public function test_sender_dashboard_excludes_draft_bookings()
    {
        $user = User::factory()->create(['role' => Role::Sender]);
        $sender = $user->sender;

        Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Draft,
            'reference_number' => 'DRAFT-BK',
        ]);

        $this->actingAs($user)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('sender/Dashboard')
                ->has('bookingsRequiringAction', 0)
            );
    }

    public function test_admin_cannot_see_draft_bookings_in_index()
    {
        $admin = User::factory()->create(['role' => Role::Admin]);

        Booking::factory()->create([
            'status' => BookingStatus::Draft,
            'reference_number' => 'SENDER-DRAFT',
        ]);

        $this->actingAs($admin)
            ->get(route('admin.bookings.index'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/bookings/index')
                ->has('bookings.data', 0)
            );
    }

    public function test_sender_cannot_see_others_bookings_in_required_actions()
    {
        // 1. Setup User and Sender A (UserObserver auto-creates the sender)
        $userA = User::factory()->create(['role' => Role::Sender]);

        // 2. Setup Sender B and their booking that needs action
        $senderB = Sender::factory()->create();
        Booking::factory()->create([
            'sender_id' => $senderB->id,
            'declaration_data' => null,
            'declaration_form_path' => null,
        ]);

        // 3. Visit Dashboard as User A
        $this->actingAs($userA)
            ->get(route('dashboard'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('sender/Dashboard')
                ->has('bookingsRequiringAction', 0)
            );
    }
}
