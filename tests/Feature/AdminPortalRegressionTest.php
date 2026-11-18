<?php

namespace Tests\Feature;

use App\Enums\BatchStatus;
use App\Enums\BookingStatus;
use App\Enums\BoxStatus;
use App\Enums\PaymentStatus;
use App\Enums\Role;
use App\Exports\BookingsExport;
use App\Http\Controllers\SenderDashboardController;
use App\Jobs\NotifyAdminOfNewBooking;
use App\Models\Area;
use App\Models\Batch;
use App\Models\Booking;
use App\Models\Box;
use App\Models\BoxPrice;
use App\Models\BoxType;
use App\Models\PickupZone;
use App\Models\Province;
use App\Models\Recipient;
use App\Models\Sender;
use App\Models\User;
use App\Notifications\NewOnlineBookingReceived;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class AdminPortalRegressionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
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

    public function test_new_online_booking_received_notification_broadcast_channels_and_payload(): void
    {
        $sender = Sender::factory()->create([
            'first_name' => 'Elena',
            'last_name' => 'Reyes',
            'user_id' => null,
        ]);
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'reference_number' => 'BK-NOTIF-001',
            'is_guest' => true,
        ]);

        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        $notification = new NewOnlineBookingReceived($booking);

        $channels = $notification->via($admin);
        $this->assertContains('database', $channels);
        $this->assertContains('broadcast', $channels);

        $this->assertSame('booking', $notification->broadcastType());

        $broadcastData = $notification->toBroadcast($admin)->data;
        $this->assertSame($booking->id, $broadcastData['booking_id']);
        $this->assertSame('BK-NOTIF-001', $broadcastData['reference']);
        $this->assertTrue($broadcastData['is_guest']);
        $this->assertSame('New Guest Booking', $broadcastData['title']);
        $this->assertStringContainsString('Elena Reyes', $broadcastData['message']);
        $this->assertSame('/admin/bookings/'.$booking->id, $broadcastData['url']);

        $emptyBoxBooking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'reference_number' => 'BK-EMPTY-001',
            'is_guest' => true,
            'empty_box_count' => 2,
            'empty_box_items' => [['box_type_id' => 1, 'name' => 'Medium', 'quantity' => 2]],
        ]);
        $emptyBoxData = (new NewOnlineBookingReceived($emptyBoxBooking))->toArray($admin);
        $this->assertStringContainsString('empty box order BK-EMPTY-001', $emptyBoxData['message']);
        $this->assertStringContainsString('Elena Reyes', $emptyBoxData['message']);
    }

    public function test_notify_admin_in_app_notification_creates_database_entry_and_purges_caches(): void
    {
        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        /** @var User $superAdmin */
        $superAdmin = User::factory()->create([
            'role' => Role::SuperAdmin,
        ]);

        /** @var User $customer */
        $customer = User::factory()->create([
            'role' => Role::Sender,
        ]);

        $sender = Sender::factory()->create([
            'first_name' => 'Marco',
            'last_name' => 'Cruz',
            'user_id' => null,
        ]);
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'reference_number' => 'BK-NOTIF-002',
            'is_guest' => true,
        ]);

        Cache::put("user.{$admin->id}.sidebar_counts", ['bookings' => 5], 600);
        Cache::put("user.{$admin->id}.unread_notifications", 5, 600);
        Cache::put(SenderDashboardController::DASHBOARD_CACHE_KEY, ['test' => true], 600);

        NotifyAdminOfNewBooking::sendInAppNotifications($booking);

        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $admin->id,
            'notifiable_type' => User::class,
            'type' => NewOnlineBookingReceived::class,
        ]);

        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $superAdmin->id,
            'notifiable_type' => User::class,
            'type' => NewOnlineBookingReceived::class,
        ]);

        $this->assertDatabaseMissing('notifications', [
            'notifiable_id' => $customer->id,
            'notifiable_type' => User::class,
            'type' => NewOnlineBookingReceived::class,
        ]);

        $this->assertFalse(Cache::has("user.{$admin->id}.sidebar_counts"));
        $this->assertFalse(Cache::has("user.{$admin->id}.unread_notifications"));
        $this->assertFalse(Cache::has(SenderDashboardController::DASHBOARD_CACHE_KEY));

        // Test deduplication: repeated execution should not create duplicate entries
        $initialCount = DatabaseNotification::count();
        NotifyAdminOfNewBooking::sendInAppNotifications($booking);
        $this->assertSame($initialCount, DatabaseNotification::count());
    }

    public function test_notify_admin_job_sends_in_app_notifications_when_mail_address_missing(): void
    {
        Mail::fake();
        config([
            'mail.admin_address' => null,
            'mail.from.address' => null,
        ]);

        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::Admin,
        ]);

        $sender = Sender::factory()->create([
            'first_name' => 'Carlo',
            'last_name' => 'Diaz',
            'user_id' => null,
        ]);
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'reference_number' => 'BK-NOTIF-003',
            'is_guest' => true,
        ]);

        (new NotifyAdminOfNewBooking($booking, true))->handle();

        Mail::assertNothingSent();
        $this->assertDatabaseHas('notifications', [
            'notifiable_id' => $admin->id,
            'notifiable_type' => User::class,
            'type' => NewOnlineBookingReceived::class,
        ]);
    }

    public function test_empty_box_order_and_guest_booking_dispatch_admin_notifications(): void
    {
        Queue::fake();

        $boxType = BoxType::firstOrCreate(['name' => 'Medium'], ['dimensions' => '18x18x18', 'is_active' => true]);

        $emptyBoxResponse = $this->post('/order-boxes', [
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'email' => 'maria.emptybox@example.com',
            'contact_number' => '0412345678',
            'address' => '123 George St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'delivery_date' => now()->addDays(2)->format('Y-m-d'),
            'delivery_notes' => 'Please ring the doorbell',
            'payment_method' => 'cash_on_pickup',
            'items' => [
                ['box_type_id' => $boxType->id, 'quantity' => 2],
            ],
        ]);

        $emptyBoxResponse->assertRedirect();
        $emptyBoxResponse->assertSessionHasNoErrors();

        $area = Area::firstOrCreate(['name' => 'Metro Manila'], ['is_active' => true]);
        $province = Province::firstOrCreate(['name' => 'Metro Manila'], ['area_id' => $area->id, 'is_active' => true]);
        $pickupZone = PickupZone::firstOrCreate([], ['name' => 'Zone 1', 'is_active' => true]);
        BoxPrice::updateOrCreate(
            ['area_id' => $area->id, 'box_type_id' => $boxType->id, 'pickup_zone_id' => $pickupZone->id],
            ['price' => 150.00]
        );

        $guestBookResponse = $this->post(route('guest.bookings.store'), [
            'first_name' => 'Liza',
            'last_name' => 'Bautista',
            'email' => 'liza.guestbook@example.com',
            'mobile' => '0412345678',
            'address' => '456 Pitt St',
            'suburb' => 'Sydney',
            'state' => 'NSW',
            'postcode' => '2000',
            'pickup_zone_id' => $pickupZone->id,
            'preferred_date' => now()->addDays(3)->format('Y-m-d'),
            'booking_type' => 'home_pickup',
            'payment_method' => 'cash_on_pickup',
            'notes' => 'Leave at front gate.',
            'boxes' => [
                [
                    'recipient_first_name' => 'Juan',
                    'recipient_last_name' => 'Dela Cruz',
                    'recipient_phone' => '09171234567',
                    'recipient_address' => '789 Rizal Ave',
                    'recipient_city' => 'Manila',
                    'recipient_province' => $province->name,
                    'area_id' => $area->id,
                    'box_type_id' => $boxType->id,
                    'is_custom_size' => false,
                ],
            ],
        ]);

        $guestBookResponse->assertRedirect();
        $guestBookResponse->assertSessionHasNoErrors();

        Queue::assertPushed(NotifyAdminOfNewBooking::class, 2);
    }

    public function test_booking_lifecycle_invalidates_admin_dashboard_cache(): void
    {
        $sender = Sender::factory()->create();

        // 1. Creation invalidates cache
        Cache::put(SenderDashboardController::DASHBOARD_CACHE_KEY, ['cached' => true], 600);
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
        ]);
        $this->assertFalse(Cache::has(SenderDashboardController::DASHBOARD_CACHE_KEY));

        // 2. Update invalidates cache
        Cache::put(SenderDashboardController::DASHBOARD_CACHE_KEY, ['cached' => true], 600);
        $booking->update(['status' => BookingStatus::Confirmed]);
        $this->assertFalse(Cache::has(SenderDashboardController::DASHBOARD_CACHE_KEY));

        // 3. Deletion invalidates cache
        Cache::put(SenderDashboardController::DASHBOARD_CACHE_KEY, ['cached' => true], 600);
        $booking->delete();
        $this->assertFalse(Cache::has(SenderDashboardController::DASHBOARD_CACHE_KEY));
    }

    public function test_admin_booking_filter_missing_declarations_matches_dashboard_criteria(): void
    {
        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::SuperAdmin,
            'email_verified_at' => now(),
        ]);

        $sender = Sender::factory()->create();
        $boxType = BoxType::firstOrCreate(['name' => 'Jumbo'], ['dimensions' => '24x24x24', 'is_active' => true]);
        $area = Area::firstOrCreate(['name' => 'Metro Manila'], ['is_active' => true]);
        $recipient = Recipient::factory()->create([
            'sender_id' => $sender->id,
            'area_id' => $area->id,
        ]);

        // Booking A: Has box, declaration is missing
        $bookingWithMissingDec = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
            'declaration_form_status' => 'missing',
            'declaration_form_path' => null,
            'declaration_data' => null,
            'empty_box_count' => 0,
        ]);
        Box::factory()->create([
            'booking_id' => $bookingWithMissingDec->id,
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
            'status' => BoxStatus::Pending,
        ]);

        // Booking B: Empty box only order (should NOT be flagged as missing declaration even if status column is missing)
        $emptyBoxOnlyBooking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
            'declaration_form_status' => 'missing',
            'declaration_form_path' => null,
            'declaration_data' => null,
            'empty_box_count' => 2,
        ]);

        // Booking C: Submitted declaration
        $submittedBooking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'declaration_form_status' => 'submitted_online',
            'declaration_form_path' => 'declarations/sample.pdf',
            'empty_box_count' => 0,
        ]);
        Box::factory()->create([
            'booking_id' => $submittedBooking->id,
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
            'status' => BoxStatus::Pending,
        ]);

        $response = $this->actingAs($admin)->get('/admin/bookings?declaration_form_status=missing');
        $response->assertOk();

        $response->assertInertia(fn (Assert $page) => $page
            ->component('admin/bookings/index')
            ->has('bookings.data', 1)
            ->where('bookings.data.0.id', $bookingWithMissingDec->id)
        );
    }

    public function test_admin_booking_show_not_found_redirects_gracefully_on_inertia_request(): void
    {
        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::SuperAdmin,
            'email_verified_at' => now(),
        ]);

        // Non-existent booking ID 999999 via Inertia request
        $response = $this->actingAs($admin)
            ->withHeaders(['X-Inertia' => 'true'])
            ->get('/admin/bookings/999999');

        $response->assertRedirect(route('admin.bookings.index'));
        $response->assertSessionHas('error', 'The requested booking could not be found or has been removed.');
    }

    public function test_declaration_form_terms_reflect_eagle_cargo_branding(): void
    {
        $settingsService = app(\App\Services\SettingsService::class);
        $declarationSettings = $settingsService->getDeclarationSettings();
        $this->assertSame('Eagle Cargo Logistics System', $declarationSettings['brandName']);

        $invoiceSettings = $settingsService->getInvoiceSettings();
        $this->assertStringContainsString('Eagle Cargo', $invoiceSettings['terms']);
        $this->assertStringNotContainsString('Orient Freight', $invoiceSettings['terms']);
    }

    public function test_boxes_index_filters_by_payment_declaration_and_batch_and_returns_filter_props(): void
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
        ]);
        $boxType = BoxType::firstOrCreate(['name' => 'Jumbo'], ['dimensions' => '24x24x24', 'is_active' => true]);

        $batch = Batch::create([
            'batch_number' => 'BATCH-TEST-FILTERS-EC',
            'status' => BatchStatus::Open,
            'capacity_boxes' => 100,
        ]);

        $paidBooking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
            'declaration_form_status' => 'submitted_online',
        ]);
        $boxPaid = Box::factory()->create([
            'booking_id' => $paidBooking->id,
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
            'status' => BoxStatus::Pending,
            'batch_id' => $batch->id,
        ]);

        $unpaidBooking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Pending,
            'declaration_form_status' => 'missing',
        ]);
        $boxUnpaid = Box::factory()->create([
            'booking_id' => $unpaidBooking->id,
            'recipient_id' => $recipient->id,
            'box_type_id' => $boxType->id,
            'status' => BoxStatus::Pending,
            'batch_id' => null,
        ]);

        // Filter by payment_status=paid
        $resPaid = $this->actingAs($admin)->get('/admin/boxes?payment_status=paid');
        $resPaid->assertOk();
        $resPaid->assertInertia(fn (Assert $page) => $page
            ->component('admin/boxes/index')
            ->has('boxes.data', 1)
            ->where('boxes.data.0.id', $boxPaid->id)
            ->where('filters.payment_status', 'paid')
        );

        // Filter by payment_status=pending
        $resPending = $this->actingAs($admin)->get('/admin/boxes?payment_status=pending');
        $resPending->assertOk();
        $resPending->assertInertia(fn (Assert $page) => $page
            ->component('admin/boxes/index')
            ->has('boxes.data', 1)
            ->where('boxes.data.0.id', $boxUnpaid->id)
            ->where('filters.payment_status', 'pending')
        );

        // Filter by declaration_form_status=missing
        $resMissing = $this->actingAs($admin)->get('/admin/boxes?declaration_form_status=missing');
        $resMissing->assertOk();
        $resMissing->assertInertia(fn (Assert $page) => $page
            ->component('admin/boxes/index')
            ->has('boxes.data', 1)
            ->where('boxes.data.0.id', $boxUnpaid->id)
            ->where('filters.declaration_form_status', 'missing')
        );

        // Filter by batch_id=unassigned
        $resUnassigned = $this->actingAs($admin)->get('/admin/boxes?batch_id=unassigned');
        $resUnassigned->assertOk();
        $resUnassigned->assertInertia(fn (Assert $page) => $page
            ->component('admin/boxes/index')
            ->has('boxes.data', 1)
            ->where('boxes.data.0.id', $boxUnpaid->id)
            ->where('filters.batch_id', 'unassigned')
        );

        // Filter by batch_id=$batch->id
        $resBatch = $this->actingAs($admin)->get('/admin/boxes?batch_id=' . $batch->id);
        $resBatch->assertOk();
        $resBatch->assertInertia(fn (Assert $page) => $page
            ->component('admin/boxes/index')
            ->has('boxes.data', 1)
            ->where('boxes.data.0.id', $boxPaid->id)
            ->where('filters.batch_id', (string) $batch->id)
        );
    }

    public function test_payments_index_filters_by_payment_method_and_sorts(): void
    {
        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::SuperAdmin,
            'email_verified_at' => now(),
        ]);

        $sender = Sender::factory()->create();
        $booking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
        ]);

        $invoice = \App\Models\Invoice::create([
            'booking_id' => $booking->id,
            'invoice_number' => 'INV-TEST-EC-001',
            'amount' => 150.00,
            'subtotal' => 150.00,
            'total_amount' => 150.00,
            'status' => \App\Enums\InvoiceStatus::Paid,
        ]);

        $cashPayment = \App\Models\Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 50.00,
            'payment_method' => 'cash',
            'paid_at' => now()->subDay(),
            'confirmed_at' => now()->subDay(),
        ]);

        $stripePayment = \App\Models\Payment::create([
            'invoice_id' => $invoice->id,
            'amount' => 100.00,
            'payment_method' => 'stripe_card',
            'paid_at' => now(),
            'confirmed_at' => now(),
        ]);

        // Unfiltered returns both records with no method filter key
        $resAll = $this->actingAs($admin)->get('/admin/payments');
        $resAll->assertOk();
        $resAll->assertInertia(fn (Assert $page) => $page
            ->component('admin/payments/index')
            ->has('payments.data', 2)
            ->missing('filters.payment_method')
            ->missing('filters.method')
        );

        // Filter with payment_method=cash
        $resCash = $this->actingAs($admin)->get('/admin/payments?payment_method=cash');
        $resCash->assertOk();
        $resCash->assertInertia(fn (Assert $page) => $page
            ->component('admin/payments/index')
            ->has('payments.data', 1)
            ->where('payments.data.0.id', $cashPayment->id)
            ->where('filters.payment_method', 'cash')
            ->missing('filters.method')
        );

        // Filter with method=stripe_card
        $resStripe = $this->actingAs($admin)->get('/admin/payments?method=stripe_card');
        $resStripe->assertOk();
        $resStripe->assertInertia(fn (Assert $page) => $page
            ->component('admin/payments/index')
            ->has('payments.data', 1)
            ->where('payments.data.0.id', $stripePayment->id)
            ->where('filters.payment_method', 'stripe_card')
            ->missing('filters.method')
        );

        // Sort by amount asc
        $resSort = $this->actingAs($admin)->get('/admin/payments?sort=amount&direction=asc');
        $resSort->assertOk();
        $resSort->assertInertia(fn (Assert $page) => $page
            ->component('admin/payments/index')
            ->has('payments.data', 2)
            ->where('payments.data.0.id', $cashPayment->id)
            ->where('payments.data.1.id', $stripePayment->id)
        );
    }

    public function test_admin_booking_filter_unpaid_and_pending_payment(): void
    {
        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::SuperAdmin,
            'email_verified_at' => now(),
        ]);

        $sender = Sender::factory()->create();

        $pendingBooking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Pending,
            'payment_status' => PaymentStatus::Pending,
        ]);

        $partialBooking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::PartiallyPaid,
        ]);

        $paidBooking = Booking::factory()->create([
            'sender_id' => $sender->id,
            'status' => BookingStatus::Confirmed,
            'payment_status' => PaymentStatus::Paid,
        ]);

        // Filter by payment_status=unpaid (should match Pending + PartiallyPaid)
        $resUnpaid = $this->actingAs($admin)->get('/admin/bookings?payment_status=unpaid');
        $resUnpaid->assertOk();
        $resUnpaid->assertInertia(fn (Assert $page) => $page
            ->component('admin/bookings/index')
            ->has('bookings.data', 2)
        );

        // Filter by payment_status=pending (should match ONLY Pending)
        $resPending = $this->actingAs($admin)->get('/admin/bookings?payment_status=pending');
        $resPending->assertOk();
        $resPending->assertInertia(fn (Assert $page) => $page
            ->component('admin/bookings/index')
            ->has('bookings.data', 1)
            ->where('bookings.data.0.id', $pendingBooking->id)
        );

        // Filter by status=pending
        $resStatusPending = $this->actingAs($admin)->get('/admin/bookings?status=pending');
        $resStatusPending->assertOk();
        $resStatusPending->assertInertia(fn (Assert $page) => $page
            ->component('admin/bookings/index')
            ->has('bookings.data', 1)
            ->where('bookings.data.0.id', $pendingBooking->id)
        );
    }

    public function test_admin_booking_missing_404_redirects_for_inertia(): void
    {
        /** @var User $admin */
        $admin = User::factory()->create([
            'role' => Role::SuperAdmin,
            'email_verified_at' => now(),
        ]);

        $response = $this->actingAs($admin)
            ->withHeaders(['X-Inertia' => 'true'])
            ->get('/admin/bookings/999999');

        $response->assertRedirect(route('admin.bookings.index'));
        $response->assertSessionHas('error');
    }
}
