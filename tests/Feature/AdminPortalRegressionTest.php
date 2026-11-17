<?php

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Exports\BookingsExport;
use App\Models\Area;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxType;
use App\Models\Recipient;
use App\Models\Sender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminPortalRegressionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Notification::fake();
    }

    public function test_bulk_assign_to_batch_advances_pending_box_without_500_and_records_milestone(): void
    {
        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::SuperAdmin,
            'email_verified_at' => now(),
        ]);

        $sender = Sender::factory()->create();
        $area = Area::firstOrCreate(['name' => 'Metro Manila'], ['is_active' => true]);
        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'phone_number' => '+63 917 111 2222',
        ]);
        $boxType = BoxType::firstOrCreate(['name' => 'Jumbo'], ['dimensions' => '24x24x24', 'is_active' => true]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
            'declaration_form_status' => 'submitted_online',
        ]);

        $box = Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
            'status' => BoxStatus::Pending,
            'tracking_step_key' => null,
            'batch_id' => null,
        ]);

        $batch = Batch::create([
            'batch_number' => 'BATCH-REG-001',
            'status' => BatchStatus::Open,
            'capacity_boxes' => 100,
        ]);

        $response = $this->actingAs($admin)
            ->from('/admin/boxes')
            ->post('/admin/boxes/bulk-assign-to-batch', [
                'ids' => [$box->id],
                'batch_id' => $batch->id,
            ]);

        $response->assertRedirect('/admin/boxes');
        $response->assertSessionHas('success');

        $box->refresh();
        $this->assertSame($batch->id, $box->batch_id);
        $this->assertSame(BoxStatus::LoadedToContainer, $box->status);
        $this->assertSame('loading_container', $box->tracking_step_key);

        $this->assertDatabaseHas('box_updates', [
            'box_id' => $box->id,
            'status' => BoxStatus::LoadedToContainer->value,
            'tracking_step_key' => 'loading_container',
        ]);
    }

    public function test_bookings_export_includes_recipient_phone_number_and_snapshot_fallback(): void
    {
        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::SuperAdmin,
            'email_verified_at' => now(),
        ]);

        $sender = Sender::factory()->create();
        $area = Area::firstOrCreate(['name' => 'Cebu'], ['is_active' => true]);
        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'name' => 'Elena Reyes',
            'phone_number' => '+63 917 888 9999',
        ]);
        $trashedRecipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
            'name' => 'Marco Cruz',
            'phone_number' => '+63 918 777 6666',
        ]);
        $boxType = BoxType::firstOrCreate(['name' => 'Regular'], ['dimensions' => '20x20x20', 'is_active' => true]);

        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
            'reference_number' => 'BK-EXP-100',
        ]);

        Box::factory()->create([
            'booking_id' => $booking->id,
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
            'status' => BoxStatus::Pending,
        ]);

        $snapshotBooking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
            'reference_number' => 'BK-EXP-101',
        ]);

        Box::factory()->create([
            'booking_id' => $snapshotBooking->id,
            'recipient_id' => $trashedRecipient->id,
            'box_type_id' => $boxType->id,
            'status' => BoxStatus::Pending,
        ]);

        $trashedRecipient->delete();

        $bookings = Booking::with([
            'sender' => fn ($q) => $q->withTrashed(),
            'boxes.recipient' => fn ($q) => $q->withTrashed(),
            'boxes.boxType',
            'invoice',
        ])->whereIn('id', [$booking->id, $snapshotBooking->id])->get();

        $export = new BookingsExport($bookings, false, ['booking', 'recipient']);
        $headings = $export->headings();
        $phoneCol = array_search('Recipient Phone', $headings, true);
        $this->assertNotFalse($phoneCol);

        $row1 = $export->map($bookings->firstWhere('id', $booking->id));
        $row2 = $export->map($bookings->firstWhere('id', $snapshotBooking->id));

        $this->assertSame('+63 917 888 9999', $row1[$phoneCol]);
        $this->assertSame('+63 918 777 6666', $row2[$phoneCol]);

        $download = $this->actingAs($admin)->get('/admin/bookings/export-excel?format=csv&ids='.$booking->id);
        $download->assertOk();
    }

    public function test_admin_bookings_filters_segregate_rows_and_handle_trashed_senders(): void
    {
        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::SuperAdmin,
            'email_verified_at' => now(),
        ]);

        $activeSender = Sender::factory()->create(['user_id' => User::factory()->create()->id]);
        $guestSender = Sender::factory()->create(['user_id' => null]);
        $deletedSender = Sender::factory()->create(['user_id' => null]);

        Booking::factory()->create([
            'sender_id' => $activeSender->id,
            'reference_number' => 'BK-FLT-001',
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Paid,
            'declaration_form_status' => 'submitted_online',
        ]);

        $archivedBooking = Booking::factory()->create([
            'sender_id' => $deletedSender->id,
            'reference_number' => 'BK-FLT-002',
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Pending,
            'declaration_form_status' => 'missing',
        ]);
        $archivedBooking->delete();
        $deletedSender->delete();

        Booking::factory()->create([
            'sender_id' => $guestSender->id,
            'reference_number' => 'BK-FLT-003',
            'status' => BookingStatus::Cancelled,
            'payment_status' => PaymentStatus::Pending,
            'declaration_form_status' => 'missing',
        ]);

        $this->actingAs($admin)
            ->get('/admin/bookings?status=pending&payment_status=paid&declaration_form_status=submitted&customer_type=registered')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/bookings/index')
                ->has('bookings.data', 1)
                ->where('bookings.data.0.reference_number', 'BK-FLT-001')
            );

        $this->actingAs($admin)
            ->get('/admin/bookings?status=cancelled&customer_type=guest')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/bookings/index')
                ->has('bookings.data', 1)
                ->where('bookings.data.0.reference_number', 'BK-FLT-003')
            );

        $this->actingAs($admin)
            ->get('/admin/bookings?trashed=1')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('admin/bookings/index')
                ->has('bookings.data', 1)
                ->where('bookings.data.0.reference_number', 'BK-FLT-002')
                ->where('bookings.data.0.sender.first_name', $deletedSender->first_name)
            );
    }
}
