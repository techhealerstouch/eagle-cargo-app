<?php

namespace App\Services;

use App\Enums\BatchStatus;
use App\Enums\CalendarEventCategory;
use App\Enums\CalendarEventType;
use App\Enums\CalendarEventVisibility;
use App\Enums\RunsheetType;
use App\Models\Batch;
use App\Models\CalendarEvent;
use App\Models\Runsheet;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;

class CalendarEventService
{
    /**
     * Get all visible calendar events for a date range with optional filters.
     *
     * @return Collection<int, CalendarEvent>
     */
    public function getEventsForRange(
        Carbon|string $startDate,
        Carbon|string $endDate,
        ?User $user = null,
        ?int $pickupZoneId = null,
        ?string $category = null,
        ?string $eventType = null
    ): Collection {
        $query = CalendarEvent::query()
            ->with(['batch', 'runsheet', 'pickupZone', 'area', 'creator'])
            ->forUser($user)
            ->inRange($startDate, $endDate);

        if ($pickupZoneId) {
            $query->where(function ($q) use ($pickupZoneId) {
                $q->whereNull('pickup_zone_id')
                    ->orWhere('pickup_zone_id', $pickupZoneId);
            });
        }

        if ($category) {
            $query->where('category', $category);
        }

        if ($eventType) {
            $query->where('event_type', $eventType);
        }

        $events = $query->orderBy('start_date')->get();

        // Inject active promotions as virtual marketing events
        if (($category === null || $category === CalendarEventCategory::Marketing->value) &&
            ($eventType === null || $eventType === 'promo' || $eventType === CalendarEventType::Promo->value)
        ) {
            $promos = \App\Models\Promotion::query()
                ->where('is_active', true)
                ->where(function ($q) use ($startDate, $endDate) {
                    $q->whereNull('valid_from')->whereNull('valid_to')
                      ->orWhere(function ($q2) use ($startDate, $endDate) {
                          $q2->where(function ($q3) use ($endDate) {
                               $q3->whereNull('valid_from')
                                  ->orWhere('valid_from', '<=', $endDate);
                           })
                           ->where(function ($q4) use ($startDate) {
                               $q4->whereNull('valid_to')
                                  ->orWhere('valid_to', '>=', $startDate);
                           });
                      });
                })
                ->get();

            foreach ($promos as $promo) {
                $start = $promo->valid_from ?? $promo->created_at ?? now();
                $end = $promo->valid_to;

                if (! $end) {
                    // "show start date only" for indefinite promos
                    $end = $start->copy()->endOfDay();
                }

                $event = new CalendarEvent([
                    'title' => 'Promo: ' . $promo->name,
                    'description' => "Code: {$promo->code}\n{$promo->description}",
                    'event_type' => CalendarEventType::Promo,
                    'category' => CalendarEventCategory::Marketing,
                    'visibility' => CalendarEventVisibility::Public,
                    'start_date' => $start,
                    'end_date' => $end,
                    'is_all_day' => true,
                    'color_hex' => '#d946ef',
                    'badge_label' => $promo->code,
                ]);

                // Virtual event markers
                $event->id = -1000 - $promo->id;
                $event->setAttribute('is_virtual_promo', true);
                $event->setAttribute('promo_id', $promo->id);

                $events->push($event);
            }

            // Re-sort the collection after appending virtual events
            $events = $events->sortBy('start_date')->values();
        }

        return $events;
    }

    /**
     * Check if a given date is blocked for bookings in a specific pickup zone.
     */
    public function isDateBlockedForZone(Carbon|string $date, ?int $pickupZoneId = null): bool
    {
        $carbonDate = Carbon::parse($date)->startOfDay();

        return CalendarEvent::query()
            ->blocking()
            ->where(function ($query) use ($carbonDate) {
                $query->whereDate('start_date', '<=', $carbonDate)
                    ->where(function ($sub) use ($carbonDate) {
                        $sub->whereNull('end_date')
                            ->orWhereDate('end_date', '>=', $carbonDate);
                    });
            })
            ->where(function ($query) use ($pickupZoneId) {
                $query->whereNull('pickup_zone_id');
                if ($pickupZoneId) {
                    $query->orWhere('pickup_zone_id', $pickupZoneId);
                }
            })
            ->exists();
    }

    /**
     * Get the next upcoming active Batch Cut-off with business metadata and countdown.
     */
    public function getNextUpcomingCutoff(?int $pickupZoneId = null): ?array
    {
        $cutoffEvent = CalendarEvent::query()
            ->with(['batch'])
            ->where('event_type', CalendarEventType::Cutoff->value)
            ->where('visibility', CalendarEventVisibility::Public->value)
            ->whereDate('start_date', '>=', now()->startOfDay())
            ->where(function ($query) use ($pickupZoneId) {
                $query->whereNull('pickup_zone_id');
                if ($pickupZoneId) {
                    $query->orWhere('pickup_zone_id', $pickupZoneId);
                }
            })
            ->orderBy('start_date')
            ->first();

        if (! $cutoffEvent) {
            return null;
        }

        $cutoffDate = Carbon::parse($cutoffEvent->start_date);
        $diffDays = now()->diffInDays($cutoffDate, false);
        $isToday = $cutoffDate->isToday();

        $urgencyLevel = 'normal';
        if ($isToday) {
            $urgencyLevel = 'last_day';
        } elseif ($diffDays <= 3) {
            $urgencyLevel = 'closing_soon';
        }

        $batch = $cutoffEvent->batch;
        $etaDate = $batch?->arrived_at ?? $batch?->eta_at;
        $sailingDate = $batch?->sailed_at ?? $batch?->departed_at;

        // Estimated delivery window in PH (Manila: ~28 days from sailing, Provincial: ~40 days from sailing)
        $estimatedDeliveryWindow = null;
        if ($sailingDate) {
            $sailCarbon = Carbon::parse($sailingDate);
            $estStart = $sailCarbon->copy()->addDays(28)->format('M d, Y');
            $estEnd = $sailCarbon->copy()->addDays(42)->format('M d, Y');
            $estimatedDeliveryWindow = "{$estStart} – {$estEnd}";
        } elseif ($cutoffDate) {
            $estStart = $cutoffDate->copy()->addDays(35)->format('M d, Y');
            $estEnd = $cutoffDate->copy()->addDays(50)->format('M d, Y');
            $estimatedDeliveryWindow = "{$estStart} – {$estEnd}";
        }

        return [
            'id' => $cutoffEvent->id,
            'title' => $cutoffEvent->title,
            'cutoff_date' => $cutoffDate->toIso8601String(),
            'formatted_cutoff' => $cutoffDate->format('l, F j, Y'),
            'days_remaining' => max(0, (int) $diffDays),
            'is_today' => $isToday,
            'urgency_level' => $urgencyLevel,
            'vessel_name' => $batch?->vessel_name ?: 'Scheduled Container Vessel',
            'container_number' => $batch?->container_number,
            'batch_number' => $batch?->batch_number,
            'origin_port' => $batch?->origin_port ?? 'Sydney Port',
            'destination_port' => $batch?->destination_port ?? 'Port of Manila',
            'sailing_date' => $sailingDate ? Carbon::parse($sailingDate)->format('M j, Y') : 'TBA (Post-Cutoff)',
            'estimated_delivery_window' => $estimatedDeliveryWindow,
            'loaded_boxes_count' => $batch?->boxes()->count() ?? 0,
        ];
    }

    /**
     * Get operational summary metrics for calendar dashboard.
     */
    public function getCalendarMetrics(?Carbon $month = null): array
    {
        $targetMonth = $month ?: now();
        $startOfMonth = $targetMonth->copy()->startOfMonth();
        $endOfMonth = $targetMonth->copy()->endOfMonth();

        $activeBatchesCount = Batch::query()
            ->whereIn('status', [
                BatchStatus::Open->value,
                BatchStatus::Loading->value,
                BatchStatus::ReadyToClose->value,
                BatchStatus::Sailed->value,
                BatchStatus::Arrived->value,
            ])
            ->count();

        $cutoffQuery = CalendarEvent::query()
            ->where('event_type', CalendarEventType::Cutoff->value);

        if ($targetMonth->isCurrentMonth()) {
            $cutoffQuery->whereBetween('start_date', [now()->startOfDay(), $endOfMonth]);
        } else {
            $cutoffQuery->whereBetween('start_date', [$startOfMonth, $endOfMonth]);
        }

        $upcomingCutoffsCount = $cutoffQuery->count();

        $monthlyRunsheetsCount = Runsheet::query()
            ->whereBetween('scheduled_date', [$startOfMonth, $endOfMonth])
            ->count();

        $activeBlackoutsCount = CalendarEvent::query()
            ->blocking()
            ->inRange($startOfMonth, $endOfMonth)
            ->count();

        return [
            'active_batches_count' => $activeBatchesCount,
            'upcoming_cutoffs_count' => $upcomingCutoffsCount,
            'monthly_runsheets_count' => $monthlyRunsheetsCount,
            'active_blackouts_count' => $activeBlackoutsCount,
        ];
    }

    /**
     * Generate standard RFC 5545 iCalendar (.ics) content.
     */
    public function generateIcsContent(Collection|array $events, string $calendarName = 'Love Balikbayan Schedules'): string
    {
        $now = gmdate('Ymd\THis\Z');
        $ics = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Love Balikbayan Box//Logistics Calendar//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            "X-WR-CALNAME:{$calendarName}",
            'X-WR-TIMEZONE:Australia/Sydney',
        ];

        foreach ($events as $event) {
            $uid = 'event-' . $event->id . '-' . md5($event->title . $event->start_date) . '@lovebalikbayan.com';
            $startDate = Carbon::parse($event->start_date);
            $endDate = $event->end_date ? Carbon::parse($event->end_date) : $startDate->copy()->addHour();

            if ($event->is_all_day) {
                $dtStart = 'VALUE=DATE:' . $startDate->format('Ymd');
                $dtEnd = 'VALUE=DATE:' . $endDate->copy()->addDay()->format('Ymd');
            } else {
                $dtStart = $startDate->utc()->format('Ymd\THis\Z');
                $dtEnd = $endDate->utc()->format('Ymd\THis\Z');
            }

            $summary = str_replace(["\r", "\n"], ' ', $event->title);
            $description = str_replace(["\r\n", "\r", "\n"], '\\n', $event->description ?? '');
            $location = str_replace(["\r", "\n"], ' ', $event->location ?? '');

            $ics[] = 'BEGIN:VEVENT';
            $ics[] = "UID:{$uid}";
            $ics[] = "DTSTAMP:{$now}";
            $ics[] = "DTSTART;{$dtStart}";
            $ics[] = "DTEND;{$dtEnd}";
            $ics[] = "SUMMARY:{$summary}";
            if (! empty($description)) {
                $ics[] = "DESCRIPTION:{$description}";
            }
            if (! empty($location)) {
                $ics[] = "LOCATION:{$location}";
            }
            $ics[] = 'STATUS:CONFIRMED';
            $ics[] = 'END:VEVENT';
        }

        $ics[] = 'END:VCALENDAR';

        return implode("\r\n", $ics);
    }

    /**
     * Automatically sync all milestone events for a Batch.
     */
    public function syncBatchEvents(Batch $batch): void
    {
        // 1. Cut-off Event
        if ($batch->cutoff_at) {
            CalendarEvent::updateOrCreate(
                [
                    'batch_id' => $batch->id,
                    'event_type' => CalendarEventType::Cutoff->value,
                ],
                [
                    'title' => "Cut-off: Batch {$batch->batch_number}",
                    'description' => "Cargo loading cut-off for container {$batch->container_number} (Vessel: " . ($batch->vessel_name ?: 'TBA') . ").",
                    'category' => CalendarEventCategory::Logistics->value,
                    'visibility' => CalendarEventVisibility::Public->value,
                    'start_date' => $batch->cutoff_at,
                    'end_date' => $batch->cutoff_at,
                    'is_all_day' => true,
                    'is_blocking' => false,
                    'color_hex' => CalendarEventType::Cutoff->defaultColor(),
                    'badge_label' => 'Cut-off',
                    'location' => $batch->origin_port ?? 'Warehouse Hub',
                ]
            );
        } else {
            CalendarEvent::where('batch_id', $batch->id)
                ->where('event_type', CalendarEventType::Cutoff->value)
                ->delete();
        }

        // 2. Sailing Event
        $sailingDate = $batch->sailed_at ?? $batch->departed_at;
        if ($sailingDate) {
            CalendarEvent::updateOrCreate(
                [
                    'batch_id' => $batch->id,
                    'event_type' => CalendarEventType::Sailing->value,
                ],
                [
                    'title' => "Sailing: Batch {$batch->batch_number}",
                    'description' => "Vessel " . ($batch->vessel_name ?: 'Cargo Vessel') . " departing " . ($batch->origin_port ?: 'Port') . " to " . ($batch->destination_port ?: 'Destination') . ".",
                    'category' => CalendarEventCategory::Logistics->value,
                    'visibility' => CalendarEventVisibility::Public->value,
                    'start_date' => $sailingDate,
                    'end_date' => $sailingDate,
                    'is_all_day' => true,
                    'is_blocking' => false,
                    'color_hex' => CalendarEventType::Sailing->defaultColor(),
                    'badge_label' => 'Sailing',
                    'location' => $batch->origin_port ?? 'Origin Port',
                ]
            );
        } else {
            CalendarEvent::where('batch_id', $batch->id)
                ->where('event_type', CalendarEventType::Sailing->value)
                ->delete();
        }

        // 3. Port Arrival / Devanning Event
        $arrivalDate = $batch->arrived_at ?? $batch->eta_at;
        if ($arrivalDate) {
            CalendarEvent::updateOrCreate(
                [
                    'batch_id' => $batch->id,
                    'event_type' => CalendarEventType::Arrival->value,
                ],
                [
                    'title' => "ETA Port Arrival: Batch {$batch->batch_number}",
                    'description' => "Expected container arrival at " . ($batch->destination_port ?: 'Philippine Port') . " for customs clearance and devanning.",
                    'category' => CalendarEventCategory::Logistics->value,
                    'visibility' => CalendarEventVisibility::Public->value,
                    'start_date' => $arrivalDate,
                    'end_date' => $arrivalDate,
                    'is_all_day' => true,
                    'is_blocking' => false,
                    'color_hex' => CalendarEventType::Arrival->defaultColor(),
                    'badge_label' => 'Arrival ETA',
                    'location' => $batch->destination_port ?? 'Philippine Port',
                ]
            );
        } else {
            CalendarEvent::where('batch_id', $batch->id)
                ->where('event_type', CalendarEventType::Arrival->value)
                ->delete();
        }
    }

    /**
     * Automatically sync Runsheet schedule event.
     */
    public function syncRunsheetEvent(Runsheet $runsheet): void
    {
        if (! $runsheet->scheduled_date) {
            CalendarEvent::where('runsheet_id', $runsheet->id)->delete();
            return;
        }

        $isPickup = $runsheet->type === RunsheetType::Pickup;
        $eventType = $isPickup ? CalendarEventType::PickupRun : CalendarEventType::DeliveryRun;
        $driver = $isPickup ? $runsheet->picker : $runsheet->courier;
        $driverName = $driver ? $driver->name : 'Unassigned';

        CalendarEvent::updateOrCreate(
            [
                'runsheet_id' => $runsheet->id,
            ],
            [
                'title' => ($isPickup ? 'Pickup Run' : 'Delivery Run') . " #{$runsheet->id} ({$runsheet->area_description})",
                'description' => "Assigned Driver: {$driverName}. Timeslot: " . ($runsheet->timeslot ?: 'Full Day') . ". Status: {$runsheet->status->value}",
                'event_type' => $eventType->value,
                'category' => CalendarEventCategory::Operations->value,
                'visibility' => CalendarEventVisibility::StaffOnly->value,
                'start_date' => $runsheet->scheduled_date,
                'end_date' => $runsheet->scheduled_date,
                'is_all_day' => empty($runsheet->timeslot),
                'is_blocking' => false,
                'color_hex' => $eventType->defaultColor(),
                'badge_label' => $isPickup ? 'Pickup Run' : 'Delivery Run',
                'location' => $runsheet->area_description,
            ]
        );
    }
}
