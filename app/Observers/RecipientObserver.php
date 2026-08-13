<?php

namespace App\Observers;

use App\Enums\BatchStatus;
use App\Enums\BoxStatus;
use App\Models\ActivityLog;
use App\Models\Box;
use App\Models\Recipient;
use Illuminate\Support\Facades\Auth;

class RecipientObserver
{
    /**
     * Handle the Recipient "updated" event.
     */
    public function updated(Recipient $recipient): void
    {
        $addressFields = ['address', 'city', 'province', 'zip_code', 'landmarks', 'area_id'];

        if (! $recipient->wasChanged($addressFields)) {
            return;
        }

        $midTransitBoxStatuses = [
            BoxStatus::LoadedToContainer->value,
            BoxStatus::InTransit->value,
            BoxStatus::Arrived->value,
            BoxStatus::ForCheckingUnloading->value,
            BoxStatus::UnloadedManila->value,
            BoxStatus::ForDeliveryScheduling->value,
            BoxStatus::EnRouteRoRo->value,
            BoxStatus::OutForDelivery->value,
        ];

        $midTransitBatchStatuses = [
            BatchStatus::Loading->value,
            BatchStatus::Sailed->value,
            BatchStatus::Arrived->value,
        ];

        $boxes = $recipient->boxes()
            ->where(function ($query) use ($midTransitBoxStatuses, $midTransitBatchStatuses) {
                $query->whereIn('status', $midTransitBoxStatuses)
                    ->orWhereHas('batch', function ($q) use ($midTransitBatchStatuses) {
                        $q->whereIn('status', $midTransitBatchStatuses);
                    });
            })
            ->get();

        foreach ($boxes as $box) {
            $newDestination = trim("{$recipient->city}, {$recipient->province}");
            
            $box->update([
                'destination' => $newDestination,
            ]);

            if ($box->booking) {
                $box->booking->update([
                    'attention_required' => true,
                    'admin_notes' => trim($box->booking->admin_notes . "\n\nMid-transit recipient address updated. Flagged for destination hub re-routing."),
                ]);
            }

            ActivityLog::create([
                'user_id' => Auth::id(),
                'model_type' => Box::class,
                'model_id' => $box->id,
                'action' => 'mid_transit_address_change',
                'changes' => [
                    'message' => 'Recipient address modified mid-transit. Flagged for destination hub re-routing.',
                    'recipient_id' => $recipient->id,
                    'old_city' => $recipient->getOriginal('city'),
                    'new_city' => $recipient->city,
                    'old_province' => $recipient->getOriginal('province'),
                    'new_province' => $recipient->province,
                    'old_address' => $recipient->getOriginal('address'),
                    'new_address' => $recipient->address,
                ],
            ]);
        }
    }
}
