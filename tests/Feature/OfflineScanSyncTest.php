<?php

namespace Tests\Feature;

use App\Enums\BoxStatus;
use App\Models\Box;
use App\Models\BoxUpdate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class OfflineScanSyncTest extends TestCase
{
    use RefreshDatabase;

    protected $warehouseUser;
    protected $box;

    protected function setUp(): void
    {
        parent::setUp();

        // Create a warehouse user
        $this->warehouseUser = User::factory()->create(['role' => 'warehouse']);

        // Create a test box
        $this->box = Box::factory()->create([
            'status' => BoxStatus::Collected,
        ]);
        
        // Initial setup update
        BoxUpdate::create([
            'box_id' => $this->box->id,
            'status' => BoxStatus::Collected->value,
            'updated_by' => $this->warehouseUser->id,
            'client_uuid' => Str::uuid()->toString(),
        ]);
    }

    public function test_it_applies_offline_scans_and_ignores_duplicates_via_idempotency()
    {
        $uuid1 = Str::uuid()->toString();
        
        $payload = [
            'scans' => [
                [
                    'client_uuid' => $uuid1,
                    'tracking_number' => $this->box->tracking_number,
                    'status' => BoxStatus::ReceivedByWarehouse->value,
                    'scanned_at' => now()->addMinutes(5)->toIso8601String(),
                    'notes' => 'Offline scan 1',
                ],
                [
                    'client_uuid' => $uuid1, // Duplicate UUID
                    'tracking_number' => $this->box->tracking_number,
                    'status' => BoxStatus::ReceivedByWarehouse->value,
                    'scanned_at' => now()->addMinutes(5)->toIso8601String(),
                    'notes' => 'Offline scan duplicate',
                ],
            ],
        ];

        $response = $this->actingAs($this->warehouseUser)
            ->postJson('/api/boxes/sync', $payload);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'processed' => 1,
                    'skipped' => 1,
                    'errors' => [],
                ]
            ]);

        // Box status should be updated
        $this->box->refresh();
        $this->assertEquals(BoxStatus::ReceivedByWarehouse, $this->box->status);

        // Check BoxUpdates
        $updates = BoxUpdate::where('box_id', $this->box->id)
            ->where('client_uuid', $uuid1)
            ->get();

        $this->assertCount(1, $updates, 'Only one update should be created for duplicate client_uuids');
    }

    public function test_it_does_not_downgrade_current_box_status_if_scan_is_older_than_latest()
    {
        $olderUuid = Str::uuid()->toString();
        $newerUuid = Str::uuid()->toString();

        // Simulate a newer online scan already existing
        $newerScanTime = now()->subMinutes(5);
        BoxUpdate::create([
            'box_id' => $this->box->id,
            'status' => BoxStatus::LoadedToContainer->value,
            'updated_by' => $this->warehouseUser->id,
            'client_uuid' => $newerUuid,
            'created_at' => $newerScanTime,
            'updated_at' => $newerScanTime,
        ]);
        
        $this->box->bypassStatusValidation = true;
        $this->box->update(['status' => BoxStatus::LoadedToContainer]);

        // Now an offline device syncs an older scan
        $olderScanTime = now()->subMinutes(15);
        $payload = [
            'scans' => [
                [
                    'client_uuid' => $olderUuid,
                    'tracking_number' => $this->box->tracking_number,
                    'status' => BoxStatus::ReceivedByWarehouse->value,
                    'scanned_at' => $olderScanTime->toIso8601String(),
                    'notes' => 'Older offline scan',
                ],
            ],
        ];

        $response = $this->actingAs($this->warehouseUser)
            ->postJson('/api/boxes/sync', $payload);

        $response->assertStatus(200)
            ->assertJsonPath('data.processed', 1);

        $this->box->refresh();
        // The box's current status should still be LoadedToContainer because the synced scan was older
        $this->assertEquals(BoxStatus::LoadedToContainer, $this->box->status);

        // But the history should contain the older scan
        $this->assertDatabaseHas('box_updates', [
            'box_id' => $this->box->id,
            'client_uuid' => $olderUuid,
            'status' => BoxStatus::ReceivedByWarehouse->value,
        ]);
    }
}
