<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Enums\RunsheetType;
use App\Models\Runsheet;
use App\Models\User;
use App\Notifications\RunsheetAssigned;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class RunsheetNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_picker_is_notified_when_runsheet_is_created_active(): void
    {
        Notification::fake();

        $picker = User::factory()->create(['role' => Role::Picker]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Pickup,
        ]);

        Notification::assertSentTo(
            $picker,
            RunsheetAssigned::class,
            function (RunsheetAssigned $notification) use ($picker, $runsheet): bool {
                $payload = $notification->toArray($picker);
                
                $this->assertEquals('runsheet_assigned', $payload['type']);
                $this->assertEquals($runsheet->id, $payload['runsheet_id']);
                $this->assertStringContainsString('Earn Commission', $payload['title']);
                $this->assertStringContainsString('earn commission', $payload['message']);
                $this->assertEquals('/picker/runsheet/' . $runsheet->id, $payload['url']);
                
                return true;
            }
        );
    }

    public function test_courier_is_notified_when_runsheet_is_created_active(): void
    {
        Notification::fake();

        $courier = User::factory()->create(['role' => Role::Courier]);

        $runsheet = Runsheet::factory()->create([
            'courier_id' => $courier->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Delivery,
        ]);

        Notification::assertSentTo(
            $courier,
            RunsheetAssigned::class,
            function (RunsheetAssigned $notification) use ($courier, $runsheet): bool {
                $payload = $notification->toArray($courier);
                
                $this->assertEquals('runsheet_assigned', $payload['type']);
                $this->assertEquals($runsheet->id, $payload['runsheet_id']);
                $this->assertStringNotContainsString('Earn Commission', $payload['title']);
                $this->assertStringNotContainsString('earn commission', $payload['message']);
                $this->assertEquals('/courier/runsheet/' . $runsheet->id, $payload['url']);
                
                return true;
            }
        );
    }

    public function test_picker_is_notified_when_runsheet_status_transitions_to_active(): void
    {
        Notification::fake();

        $picker = User::factory()->create(['role' => Role::Picker]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker->id,
            'status' => RunsheetStatus::Draft,
            'type' => RunsheetType::Pickup,
        ]);

        // No notification should be sent yet since status is draft
        Notification::assertNotSentTo($picker, RunsheetAssigned::class);

        $runsheet->update(['status' => RunsheetStatus::Assigned]);

        Notification::assertSentTo($picker, RunsheetAssigned::class);
    }

    public function test_new_picker_is_notified_when_assigned_to_active_runsheet(): void
    {
        Notification::fake();

        $picker1 = User::factory()->create(['role' => Role::Picker]);
        $picker2 = User::factory()->create(['role' => Role::Picker]);

        $runsheet = Runsheet::factory()->create([
            'picker_id' => $picker1->id,
            'status' => RunsheetStatus::Assigned,
            'type' => RunsheetType::Pickup,
        ]);

        Notification::assertSentTo($picker1, RunsheetAssigned::class);
        Notification::assertNotSentTo($picker2, RunsheetAssigned::class);

        // Reassign to picker 2
        $runsheet->update(['picker_id' => $picker2->id]);

        Notification::assertSentTo($picker2, RunsheetAssigned::class);
    }
}
