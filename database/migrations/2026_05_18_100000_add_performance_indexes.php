<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->index(['group'], 'idx_settings_group');
        });

        Schema::table('areas', function (Blueprint $table) {
            $table->index(['is_active', 'name'], 'idx_areas_active_name');
            $table->index(['deleted_at', 'name'], 'idx_areas_deleted_name');
        });

        Schema::table('area_milestones', function (Blueprint $table) {
            $table->index(['area_id', 'sequence_order'], 'idx_area_milestones_area_sequence');
        });

        Schema::table('box_types', function (Blueprint $table) {
            $table->index(['is_active', 'name'], 'idx_box_types_active_name');
            $table->index(['deleted_at', 'name'], 'idx_box_types_deleted_name');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->index(['sender_id', 'status', 'created_at'], 'idx_bookings_sender_status_created');
            $table->index(['status', 'created_at'], 'idx_bookings_status_created');
            $table->index(['payment_status', 'status'], 'idx_bookings_payment_status');
            $table->index(['preferred_date', 'status'], 'idx_bookings_preferred_status');
            $table->index(['deleted_at', 'created_at'], 'idx_bookings_deleted_created');
        });

        Schema::table('boxes', function (Blueprint $table) {
            $table->index(['booking_id', 'status'], 'idx_boxes_booking_status');
            $table->index(['batch_id', 'status'], 'idx_boxes_batch_status');
            $table->index(['status', 'created_at'], 'idx_boxes_status_created');
            $table->index(['recipient_id', 'status'], 'idx_boxes_recipient_status');
            $table->index(['box_type_id', 'status'], 'idx_boxes_type_status');
            $table->index(['deleted_at', 'created_at'], 'idx_boxes_deleted_created');
        });

        Schema::table('box_updates', function (Blueprint $table) {
            $table->index(['box_id', 'created_at'], 'idx_box_updates_box_created');
            $table->index(['box_id', 'tracking_phase', 'created_at'], 'idx_box_updates_box_phase_created');
            $table->index(['tracking_phase', 'created_at'], 'idx_box_updates_phase_created');
        });

        Schema::table('runsheets', function (Blueprint $table) {
            $table->index(['type', 'status', 'scheduled_date'], 'idx_runsheets_type_status_date');
            $table->index(['courier_id', 'status', 'scheduled_date'], 'idx_runsheets_courier_status_date');
            $table->index(['picker_id', 'status', 'scheduled_date'], 'idx_runsheets_picker_status_date');
            $table->index(['scheduled_date', 'status'], 'idx_runsheets_date_status');
            $table->index(['deleted_at', 'scheduled_date'], 'idx_runsheets_deleted_date');
        });

        Schema::table('booking_runsheet', function (Blueprint $table) {
            $table->index(['runsheet_id', 'booking_id'], 'idx_booking_runsheet_runsheet_booking');
        });

        Schema::table('batches', function (Blueprint $table) {
            $table->index(['status', 'created_at'], 'idx_batches_status_created');
            $table->index(['origin_port', 'destination_port', 'container_size', 'shipping_line'], 'idx_batches_route_template');
        });

        Schema::table('senders', function (Blueprint $table) {
            $table->index(['user_id'], 'idx_senders_user');
            $table->index(['first_name', 'last_name'], 'idx_senders_name');
            $table->index(['deleted_at', 'created_at'], 'idx_senders_deleted_created');
        });

        Schema::table('recipients', function (Blueprint $table) {
            $table->index(['sender_id', 'created_at'], 'idx_recipients_sender_created');
            $table->index(['area_id', 'name'], 'idx_recipients_area_name');
            $table->index(['user_id'], 'idx_recipients_user');
            $table->index(['deleted_at', 'created_at'], 'idx_recipients_deleted_created');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->index(['role', 'name'], 'idx_users_role_name');
            $table->index(['deleted_at', 'created_at'], 'idx_users_deleted_created');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->index(['booking_id', 'created_at'], 'idx_invoices_booking_created');
            $table->index(['status', 'created_at'], 'idx_invoices_status_created');
            $table->index(['deleted_at', 'created_at'], 'idx_invoices_deleted_created');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->index(['invoice_id', 'created_at'], 'idx_payments_invoice_created');
            $table->index(['stripe_status', 'created_at'], 'idx_payments_stripe_status_created');
            $table->index(['paid_at'], 'idx_payments_paid_at');
            $table->index(['deleted_at', 'created_at'], 'idx_payments_deleted_created');
        });

        Schema::table('shipping_updates', function (Blueprint $table) {
            $table->index(['is_published', 'published_at'], 'idx_shipping_updates_published_at');
            $table->index(['type', 'is_published'], 'idx_shipping_updates_type_published');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->index(['notifiable_type', 'notifiable_id', 'read_at', 'created_at'], 'idx_notifications_notifiable_read_created');
        });

        Schema::table('enquiries', function (Blueprint $table) {
            $table->index(['is_read', 'created_at'], 'idx_enquiries_read_created');
            $table->index(['deleted_at', 'created_at'], 'idx_enquiries_deleted_created');
        });

        Schema::table('data_integrity_warnings', function (Blueprint $table) {
            $table->index(['is_resolved', 'created_at'], 'idx_integrity_resolved_created');
        });
    }

    public function down(): void
    {
        Schema::table('data_integrity_warnings', function (Blueprint $table) {
            $table->dropIndex('idx_integrity_resolved_created');
        });

        Schema::table('enquiries', function (Blueprint $table) {
            $table->dropIndex('idx_enquiries_read_created');
            $table->dropIndex('idx_enquiries_deleted_created');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex('idx_notifications_notifiable_read_created');
        });

        Schema::table('shipping_updates', function (Blueprint $table) {
            $table->dropIndex('idx_shipping_updates_published_at');
            $table->dropIndex('idx_shipping_updates_type_published');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('idx_payments_invoice_created');
            $table->dropIndex('idx_payments_stripe_status_created');
            $table->dropIndex('idx_payments_paid_at');
            $table->dropIndex('idx_payments_deleted_created');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex('idx_invoices_booking_created');
            $table->dropIndex('idx_invoices_status_created');
            $table->dropIndex('idx_invoices_deleted_created');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('idx_users_role_name');
            $table->dropIndex('idx_users_deleted_created');
        });

        Schema::table('recipients', function (Blueprint $table) {
            $table->dropIndex('idx_recipients_sender_created');
            $table->dropIndex('idx_recipients_area_name');
            $table->dropIndex('idx_recipients_user');
            $table->dropIndex('idx_recipients_deleted_created');
        });

        Schema::table('senders', function (Blueprint $table) {
            $table->dropIndex('idx_senders_user');
            $table->dropIndex('idx_senders_name');
            $table->dropIndex('idx_senders_deleted_created');
        });

        Schema::table('batches', function (Blueprint $table) {
            $table->dropIndex('idx_batches_status_created');
            $table->dropIndex('idx_batches_route_template');
        });

        Schema::table('booking_runsheet', function (Blueprint $table) {
            $table->dropIndex('idx_booking_runsheet_runsheet_booking');
        });

        Schema::table('runsheets', function (Blueprint $table) {
            $table->dropIndex('idx_runsheets_type_status_date');
            $table->dropIndex('idx_runsheets_courier_status_date');
            $table->dropIndex('idx_runsheets_picker_status_date');
            $table->dropIndex('idx_runsheets_date_status');
            $table->dropIndex('idx_runsheets_deleted_date');
        });

        Schema::table('box_updates', function (Blueprint $table) {
            $table->dropIndex('idx_box_updates_box_created');
            $table->dropIndex('idx_box_updates_box_phase_created');
            $table->dropIndex('idx_box_updates_phase_created');
        });

        Schema::table('boxes', function (Blueprint $table) {
            $table->dropIndex('idx_boxes_booking_status');
            $table->dropIndex('idx_boxes_batch_status');
            $table->dropIndex('idx_boxes_status_created');
            $table->dropIndex('idx_boxes_recipient_status');
            $table->dropIndex('idx_boxes_type_status');
            $table->dropIndex('idx_boxes_deleted_created');
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex('idx_bookings_sender_status_created');
            $table->dropIndex('idx_bookings_status_created');
            $table->dropIndex('idx_bookings_payment_status');
            $table->dropIndex('idx_bookings_preferred_status');
            $table->dropIndex('idx_bookings_deleted_created');
        });

        Schema::table('box_types', function (Blueprint $table) {
            $table->dropIndex('idx_box_types_active_name');
            $table->dropIndex('idx_box_types_deleted_name');
        });

        Schema::table('area_milestones', function (Blueprint $table) {
            $table->dropIndex('idx_area_milestones_area_sequence');
        });

        Schema::table('areas', function (Blueprint $table) {
            $table->dropIndex('idx_areas_active_name');
            $table->dropIndex('idx_areas_deleted_name');
        });

        Schema::table('settings', function (Blueprint $table) {
            $table->dropIndex('idx_settings_group');
        });
    }
};
