<?php

namespace Tests\Feature;

use App\Enums\CalendarEventType;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Batch;
use App\Models\CalendarEvent;
use App\Models\Runsheet;
use App\Models\User;
use App\Rules\ValidPickupDate;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class BatchCalendarSyncTest extends TestCase
{
    use DatabaseTransactions;

    public function test_batch_creation_and_update_syncs_calendar_events(): void
    {
        $cutoff = now()->addDays(10)->startOfDay();
        $eta = now()->addDays(40)->startOfDay();

        // 1. Create Batch
        $batch = Batch::factory()->create([
            'batch_number' => 'BATCH-2026-001',
            'cutoff_at' => $cutoff,
            'eta_at' => $eta,
            'vessel_name' => 'Ever Given',
        ]);

        $this->assertDatabaseHas('calendar_events', [
            'batch_id' => $batch->id,
            'event_type' => CalendarEventType::Cutoff->value,
            'title' => 'Cut-off: Batch BATCH-2026-001',
        ]);

        $this->assertDatabaseHas('calendar_events', [
            'batch_id' => $batch->id,
            'event_type' => CalendarEventType::Arrival->value,
            'title' => 'ETA Port Arrival: Batch BATCH-2026-001',
        ]);

        // 2. Update Batch Departure (Sailing)
        $sailing = now()->addDays(15)->startOfDay();
        $batch->update([
            'sailed_at' => $sailing,
        ]);

        $this->assertDatabaseHas('calendar_events', [
            'batch_id' => $batch->id,
            'event_type' => CalendarEventType::Sailing->value,
            'title' => 'Sailing: Batch BATCH-2026-001',
        ]);
    }

    public function test_runsheet_creation_and_update_syncs_calendar(): void
    {
        $picker = User::factory()->create(['role' => Role::Picker]);
        $scheduledDate = now()->addDays(3)->startOfDay();

        $runsheet = Runsheet::create([
            'picker_id' => $picker->id,
            'type' => RunsheetType::Pickup,
            'status' => RunsheetStatus::Assigned,
            'scheduled_date' => $scheduledDate,
            'area_description' => 'Western Sydney',
        ]);

        $this->assertDatabaseHas('calendar_events', [
            'runsheet_id' => $runsheet->id,
            'event_type' => CalendarEventType::PickupRun->value,
            'location' => 'Western Sydney',
        ]);
    }

    public function test_blackout_calendar_event_fails_pickup_date_validation(): void
    {
        $blackoutDate = Carbon::now()->addDays(5)->startOfDay();

        // Create a blocking holiday event
        CalendarEvent::factory()->blackout()->create([
            'title' => 'Good Friday Public Holiday',
            'start_date' => $blackoutDate,
            'is_blocking' => true,
        ]);

        $validator = Validator::make(
            ['preferred_date' => $blackoutDate->format('Y-m-d H:i')],
            ['preferred_date' => [new ValidPickupDate()]]
        );

        $this->assertTrue($validator->fails());
        $this->assertStringContainsString('unavailable for pickups due to a scheduled holiday or blackout', $validator->errors()->first('preferred_date'));
    }

    public function test_zone_specific_blackout_only_blocks_target_zone(): void
    {
        $blackoutDate = Carbon::now()->addDays(6)->startOfDay();
        $zoneA = \App\Models\PickupZone::factory()->create(['code' => 'ZONE-A']);
        $zoneB = \App\Models\PickupZone::factory()->create(['code' => 'ZONE-B']);

        // Create a blocking event specifically for Zone A
        CalendarEvent::factory()->blackout()->create([
            'title' => 'Zone A Maintenance Day',
            'start_date' => $blackoutDate,
            'is_blocking' => true,
            'pickup_zone_id' => $zoneA->id,
        ]);

        // Validation for Zone A should fail
        $validatorA = Validator::make(
            ['preferred_date' => $blackoutDate->format('Y-m-d H:i')],
            ['preferred_date' => [new ValidPickupDate(null, $zoneA->id)]]
        );
        $this->assertTrue($validatorA->fails());
        $this->assertStringContainsString('unavailable for pickups due to a scheduled holiday or blackout', $validatorA->errors()->first('preferred_date'));

        // Validation for Zone B should pass the calendar blackout check (assuming within logistics lead time / windows)
        $isBlockedForB = app(\App\Services\CalendarEventService::class)->isDateBlockedForZone($blackoutDate, $zoneB->id);
        $this->assertFalse($isBlockedForB);
    }
}
