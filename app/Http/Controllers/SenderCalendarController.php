<?php

namespace App\Http\Controllers;

use App\Models\CalendarEvent;
use App\Models\PickupZone;
use App\Services\CalendarEventService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class SenderCalendarController extends Controller
{
    public function __construct(
        protected CalendarEventService $calendarService
    ) {}

    /**
     * Display the Sender Calendar / Shipping Schedules view.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $sender = $user?->sender;
        $defaultZoneId = $sender?->pickup_zone_id;

        $start = $request->filled('start')
            ? Carbon::parse($request->input('start'))->startOfDay()
            : Carbon::now()->startOfMonth()->subDays(14);

        $end = $request->filled('end')
            ? Carbon::parse($request->input('end'))->endOfDay()
            : Carbon::now()->addMonths(6)->endOfMonth()->addDays(14);

        $selectedZoneId = $request->input('pickup_zone_id')
            ? (int) $request->input('pickup_zone_id')
            : $defaultZoneId;

        $events = $this->calendarService->getEventsForRange(
            $start,
            $end,
            $user,
            $selectedZoneId
        );

        $pickupZones = PickupZone::select('id', 'name', 'code', 'pickup_windows')
            ->where('is_active', true)
            ->get();

        $nextCutoff = $this->calendarService->getNextUpcomingCutoff($selectedZoneId);

        return Inertia::render('sender/calendar', [
            'events' => $events,
            'pickupZones' => $pickupZones,
            'selectedZoneId' => $selectedZoneId,
            'nextCutoff' => $nextCutoff,
        ]);
    }

    /**
     * Export all visible shipping schedules in standard iCalendar (.ics) format.
     */
    public function exportIcs(Request $request): HttpResponse
    {
        $user = $request->user();
        $start = Carbon::now()->startOfMonth()->subDays(14);
        $end = Carbon::now()->addMonths(6)->endOfMonth();

        $selectedZoneId = $request->input('pickup_zone_id') ? (int) $request->input('pickup_zone_id') : null;

        $events = $this->calendarService->getEventsForRange($start, $end, $user, $selectedZoneId);
        $icsContent = $this->calendarService->generateIcsContent($events, 'Love Balikbayan Shipping Schedules');

        return response($icsContent, 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="love_balikbayan_schedules.ics"',
        ]);
    }

    /**
     * Export a single calendar event in iCalendar (.ics) format.
     */
    public function exportSingleIcs(CalendarEvent $event): HttpResponse
    {
        $icsContent = $this->calendarService->generateIcsContent([$event], $event->title);
        $filename = Str::slug($event->title) . '.ics';

        return response($icsContent, 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }
}
