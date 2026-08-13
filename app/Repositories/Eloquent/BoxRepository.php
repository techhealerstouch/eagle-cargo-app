<?php

namespace App\Repositories\Eloquent;

use App\Enums\BoxStatus;
use App\Enums\Role;
use App\Enums\RunsheetStatus;
use App\Models\AreaMilestone;
use App\Models\Box;
use App\Models\BoxUpdate;
use App\Repositories\Contracts\BoxRepositoryInterface;
use App\Services\TrackingCacheService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class BoxRepository implements BoxRepositoryInterface
{
    public function findByTrackingNumber(string $trackingNumber): ?Box
    {
        return Box::where('tracking_number', $trackingNumber)->first();
    }

    public function findByIdentifier(string $identifier): ?Box
    {
        $identifier = trim($identifier);

        return Box::where('serial_number', $identifier)
            ->orWhere('tracking_number', $identifier)
            ->first();
    }

    public function loadBoxDetails(Box $box): Box
    {
        return $box->load([
            'booking.sender',
            'booking.boxes',
            'recipient.area.milestones',
            'updates' => function ($query) {
                $query->orderBy('created_at', 'desc');
            },
            'updates.updater',
            'updates.milestone',
        ]);
    }

    public function updateStatus(
        Box $box,
        string $status,
        ?string $notes,
        int $courierId,
        ?int $areaMilestoneId = null,
        ?UploadedFile $deliveryProof = null,
        ?string $trackingPhase = null,
        ?string $signature = null,
        ?string $deliveryOverrideReason = null,
        ?UploadedFile $pickupProof = null,
        bool $bypassValidation = false,
        ?string $serialNumber = null,
        ?string $trackingStepKey = null
    ): void {
        DB::transaction(function () use ($box, $status, $notes, $courierId, $areaMilestoneId, $deliveryProof, $trackingPhase, $signature, $deliveryOverrideReason, $pickupProof, $bypassValidation, $serialNumber, $trackingStepKey) {
            // Lock the box row to prevent race conditions during status updates
            $lockedBox = Box::query()->whereKey($box->id)->lockForUpdate()->firstOrFail();
            $lockedBox->bypassStatusValidation = $bypassValidation;

            $location = 'In-Transit';
            $milestoneName = null;
            $statusEnum = BoxStatus::tryFrom($status);
            $deliveryProofPath = null;
            $pickupProofPath = null;
            $signaturePath = null;

            if ($deliveryProof) {
                if ($lockedBox->delivery_proof_path) {
                    Storage::disk('public')->delete($lockedBox->delivery_proof_path);
                }

                $deliveryProofPath = $deliveryProof->store('delivery-proofs/'.$lockedBox->tracking_number, 'public');
            }

            if ($pickupProof) {
                if ($lockedBox->pickup_proof_path) {
                    Storage::disk('public')->delete($lockedBox->pickup_proof_path);
                }

                $pickupProofPath = $pickupProof->store('pickup-proofs/'.$lockedBox->tracking_number, 'public');
            }

            if ($signature) {
                if ($lockedBox->signature_path) {
                    Storage::disk('public')->delete($lockedBox->signature_path);
                }

                $signatureData = str_replace('data:image/png;base64,', '', $signature);
                $signatureData = str_replace(' ', '+', $signatureData);
                $signatureName = 'signature_'.time().'.png';
                $signaturePath = 'signatures/'.$lockedBox->tracking_number.'/'.$signatureName;

                Storage::disk('public')->put($signaturePath, base64_decode($signatureData));
            }

            if (! $statusEnum) {
                throw new \InvalidArgumentException("Invalid box status [{$status}].");
            }

            if ($areaMilestoneId) {
                $milestone = AreaMilestone::find($areaMilestoneId);
                if (! $milestone) {
                    throw new \InvalidArgumentException('Invalid area milestone.');
                }

                $location = $milestone->location ?? $location;
                $milestoneName = $milestone->name;
                $statusEnum = $milestone->is_final_delivery
                    ? BoxStatus::Delivered
                    : BoxStatus::InTransit;

                $description = $notes ?: 'Status updated by courier.';
                if ($milestoneName) {
                    $description = $notes
                        ? "Milestone reached: {$milestoneName}. {$notes}"
                        : "Milestone reached: {$milestoneName}.";
                }
            } elseif ($trackingStepKey) {
                $steps = app(\App\Services\TrackingStepService::class)->getSteps();
                $step = collect($steps)->firstWhere('key', $trackingStepKey);
                
                $location = $lockedBox->warehouse_location ?? ($statusEnum === BoxStatus::ReceivedByWarehouse ? 'Warehouse' : 'In-Transit');
                $description = $notes ?: ($step['label'] ?? ($statusEnum ? "Status updated to {$statusEnum->label()}." : 'Status updated.'));
            } else {
                $location = $lockedBox->warehouse_location ?? ($statusEnum === BoxStatus::ReceivedByWarehouse ? 'Warehouse' : 'In-Transit');
                $description = $notes ?: ($statusEnum ? "Status updated to {$statusEnum->label()}." : 'Status updated.');
            }

            $this->assertDeliveryEvidence(
                box: $lockedBox,
                targetStatus: $statusEnum,
                deliveryProofPath: $deliveryProofPath,
                signaturePath: $signaturePath,
                overrideReason: $deliveryOverrideReason,
            );

            if ($statusEnum === BoxStatus::Delivered && $deliveryOverrideReason) {
                $description = trim($description."\nAdmin proof override: {$deliveryOverrideReason}");
            }

            $updates = [
                'status' => $statusEnum ?? $lockedBox->status,
                'courier_notes' => $notes,
                'delivery_proof_path' => $deliveryProofPath ?? $lockedBox->delivery_proof_path,
                'pickup_proof_path' => $pickupProofPath ?? $lockedBox->pickup_proof_path,
                'signature_path' => $signaturePath ?? $lockedBox->signature_path,
            ];

            if ($serialNumber !== null) {
                $updates['serial_number'] = $serialNumber;
            }

            $activeSerialNumber = $serialNumber ?? $lockedBox->serial_number;
            if ($activeSerialNumber) {
                $isCollected = ($statusEnum === BoxStatus::Collected) || ($statusEnum === null && $lockedBox->status === BoxStatus::Collected);
                $newSerialStatus = $isCollected
                    ? \App\Enums\SerialNumberStatus::Assigned->value
                    : \App\Enums\SerialNumberStatus::Allocated->value;

                \App\Models\SerialNumber::where('serial_number', $activeSerialNumber)->update([
                    'status' => $newSerialStatus,
                    'box_id' => $lockedBox->id,
                    'assigned_by' => $courierId,
                    'allocated_at' => DB::raw('COALESCE(allocated_at, CURRENT_TIMESTAMP)'),
                ]);
            }

            $lockedBox->update($updates);

            // Prevent duplicate adjacent tracking history entries for the same status
            $lastUpdate = BoxUpdate::where('box_id', $lockedBox->id)->latest('id')->first();
            $newStatusValue = ($statusEnum ? $statusEnum->value : null) ?? $lockedBox->status?->value ?? 'unknown';

            if ($lastUpdate && $lastUpdate->status === $newStatusValue && $lastUpdate->description === $description) {
                return;
            }

            // Determine admin override flags at write-time
            $updater = \App\Models\User::find($courierId);
            $isAdminOverride = $updater && in_array($updater->role, ['admin', 'super_admin']);
            $stepsBypassed = 0;

            if ($isAdminOverride && $trackingStepKey) {
                $stepService = app(\App\Services\TrackingStepService::class);
                $allSteps = $stepService->getSteps();
                $currentStatus = $lockedBox->getOriginal('status');
                $currentStatusValue = $currentStatus instanceof \App\Enums\BoxStatus ? $currentStatus->value : $currentStatus;

                // Find the order of the box's previous status and the new step
                $previousStep = collect($allSteps)->first(fn ($s) => $s['system_status'] === $currentStatusValue);
                $newStep = collect($allSteps)->firstWhere('key', $trackingStepKey);

                if ($previousStep && $newStep) {
                    $previousOrder = (int) $previousStep['order'];
                    $newOrder = (int) $newStep['order'];
                    $stepsBypassed = max(0, $newOrder - $previousOrder - 1);
                }
            }
            if (! $trackingPhase && $statusEnum) {
                $trackingPhase = match ($statusEnum) {
                    BoxStatus::Collected => \App\Enums\TrackingPhase::PICKED_UP->value,
                    BoxStatus::ReceivedByWarehouse => \App\Enums\TrackingPhase::RECEIVED_BY_WAREHOUSE->value,
                    BoxStatus::LoadedToContainer => \App\Enums\TrackingPhase::LOADING_CONTAINER->value,
                    BoxStatus::InTransit => \App\Enums\TrackingPhase::IN_TRANSIT_SEA->value,
                    BoxStatus::Arrived => \App\Enums\TrackingPhase::ARRIVED_MANILA_PORT->value,
                    BoxStatus::ForCheckingUnloading, BoxStatus::UnloadedManila => \App\Enums\TrackingPhase::RECEIVED_MANILA_WAREHOUSE->value,
                    BoxStatus::ForDeliveryScheduling, BoxStatus::EnRouteRoRo => \App\Enums\TrackingPhase::DISPATCHED_TO_LOCAL_HUB->value,
                    BoxStatus::OutForDelivery => \App\Enums\TrackingPhase::OUT_FOR_DELIVERY->value,
                    BoxStatus::Delivered => \App\Enums\TrackingPhase::DELIVERED->value,
                    default => null,
                };
            }

            BoxUpdate::create([
                'box_id' => $lockedBox->id,
                'area_milestone_id' => $areaMilestoneId,
                'status' => $newStatusValue,
                'tracking_step_key' => $trackingStepKey,
                'description' => $description,
                'location' => $location,
                'tracking_phase' => $trackingPhase,
                'updated_by' => $courierId,
                'is_admin_override' => $isAdminOverride,
                'steps_bypassed' => $stepsBypassed,
            ]);
        });

        app(TrackingCacheService::class)->forgetBox($box->refresh());
    }

    private function assertDeliveryEvidence(
        Box $box,
        BoxStatus $targetStatus,
        ?string $deliveryProofPath,
        ?string $signaturePath,
        ?string $overrideReason,
    ): void {
        if ($targetStatus !== BoxStatus::Delivered) {
            return;
        }

        $hasProof = filled($deliveryProofPath) || filled($box->delivery_proof_path);

        if ($hasProof) {
            return;
        }

        if (blank($overrideReason)) {
            throw new \InvalidArgumentException('Cannot mark this box as Delivered without delivery proof photo/file.');
        }

        $role = Auth::user()?->role;
        $role = $role instanceof Role ? $role : Role::tryFrom((string) $role);

        if (! in_array($role, [Role::Admin, Role::SuperAdmin], true)) {
            throw new \InvalidArgumentException('Only admins can override missing delivery proof requirements.');
        }
    }

    public function getStatsByCourier(int $courierId): array
    {
        $statusCounts = Box::whereHas('runsheets', function ($query) use ($courierId) {
            $query->where('type', \App\Enums\RunsheetType::Delivery->value)
                ->where('courier_id', $courierId)
                ->whereIn('status', [RunsheetStatus::Assigned, RunsheetStatus::InProgress]);
        })
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $totalBoxes = array_sum($statusCounts);

        return [
            'totalBoxes' => $totalBoxes,
            'collected' => $statusCounts[BoxStatus::Collected->value] ?? 0,
            'pending' => $statusCounts[BoxStatus::Pending->value] ?? 0,
            'delivered' => $statusCounts[BoxStatus::Delivered->value] ?? 0,
        ];
    }
}
