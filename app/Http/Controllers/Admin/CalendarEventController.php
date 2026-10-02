<?php

namespace App\Http\Controllers\Admin;

use App\Enums\CalendarEventCategory;
use App\Enums\CalendarEventType;
use App\Enums\CalendarEventVisibility;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreCalendarEventRequest;
use App\Http\Requests\Admin\UpdateCalendarEventRequest;
use App\Models\Area;
use App\Models\Batch;
use App\Models\CalendarEvent;
use App\Models\PickupZone;
use App\Services\CalendarEventService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class CalendarEventController extends Controller
{
    public function __construct(
        protected CalendarEventService $calendarService
    ) {}

    /**
     * Display the Admin Calendar interface.
     */
    public function index(Request $request): Response
    {
        $start = $request->input('start_date')
            ? Carbon::parse($request->input('start_date'))->startOfMonth()->subDays(7)
            : Carbon::now()->startOfMonth()->subDays(7);

        $end = $request->input('end_date')
            ? Carbon::parse($request->input('end_date'))->endOfMonth()->addDays(7)
            : Carbon::now()->endOfMonth()->addDays(7);

        $events = $this->calendarService->getEventsForRange(
            $start,
            $end,
            $request->user(),
            $request->input('pickup_zone_id') ? (int) $request->input('pickup_zone_id') : null,
            $request->input('category'),
            $request->input('event_type')
        );

        $targetDate = $request->input('start_date')
            ? Carbon::parse($request->input('start_date'))
            : Carbon::now();

        $pickupZones = PickupZone::select('id', 'name', 'code')->where('is_active', true)->get();
        $areas = Area::select('id', 'name')->where('is_active', true)->get();
        $batches = Batch::select('id', 'batch_number', 'container_number', 'status')->latest()->take(30)->get();
        $metrics = $this->calendarService->getCalendarMetrics($targetDate);

        return Inertia::render('admin/calendar/index', [
            'initialEvents' => $events,
            'pickupZones' => $pickupZones,
            'areas' => $areas,
            'batches' => $batches,
            'metrics' => $metrics,
            'categories' => collect(CalendarEventCategory::cases())->map(fn ($cat) => [
                'value' => $cat->value,
                'label' => $cat->label(),
            ]),
            'eventTypes' => collect(CalendarEventType::cases())->map(fn ($type) => [
                'value' => $type->value,
                'label' => $type->label(),
                'defaultColor' => $type->defaultColor(),
            ]),
            'visibilities' => collect(CalendarEventVisibility::cases())->map(fn ($vis) => [
                'value' => $vis->value,
                'label' => $vis->label(),
            ]),
            'filters' => $request->only(['start_date', 'end_date', 'pickup_zone_id', 'category', 'event_type']),
        ]);
    }

    /**
     * API Feed for calendar range changes.
     */
    public function feed(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'start' => ['required', 'date'],
            'end' => ['required', 'date'],
            'pickup_zone_id' => ['nullable', 'integer'],
            'category' => ['nullable', 'string'],
            'event_type' => ['nullable', 'string'],
            'target_date' => ['nullable', 'date'],
        ]);

        $events = $this->calendarService->getEventsForRange(
            Carbon::parse($validated['start']),
            Carbon::parse($validated['end']),
            $request->user(),
            $validated['pickup_zone_id'] ?? null,
            $validated['category'] ?? null,
            $validated['event_type'] ?? null
        );

        $targetMonth = ! empty($validated['target_date'])
            ? Carbon::parse($validated['target_date'])
            : Carbon::parse($validated['start'])->addDays(15);

        $metrics = $this->calendarService->getCalendarMetrics($targetMonth);

        return response()->json([
            'events' => $events,
            'metrics' => $metrics,
        ]);
    }

    /**
     * Export admin calendar events in standard iCalendar (.ics) format.
     */
    public function exportIcs(Request $request): HttpResponse
    {
        $start = Carbon::now()->startOfMonth()->subMonths(1);
        $end = Carbon::now()->addMonths(6)->endOfMonth();

        $events = $this->calendarService->getEventsForRange($start, $end, $request->user());
        $icsContent = $this->calendarService->generateIcsContent($events, 'Love Balikbayan Operations Calendar');

        return response($icsContent, 200, [
            'Content-Type' => 'text/calendar; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="operations_calendar.ics"',
        ]);
    }

    /**
     * Store a newly created custom calendar event.
     */
    public function store(StoreCalendarEventRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['created_by'] = Auth::id();

        if (empty($data['color_hex'])) {
            $eventType = CalendarEventType::tryFrom($data['event_type']);
            $data['color_hex'] = $eventType ? $eventType->defaultColor() : '#3B82F6';
        }

        CalendarEvent::create($data);

        return redirect()->back()->with('success', 'Calendar event created successfully.');
    }

    /**
     * Update the specified calendar event.
     */
    public function update(UpdateCalendarEventRequest $request, CalendarEvent $event): RedirectResponse
    {
        $data = $request->validated();

        if (empty($data['color_hex'])) {
            $eventType = CalendarEventType::tryFrom($data['event_type']);
            $data['color_hex'] = $eventType ? $eventType->defaultColor() : '#3B82F6';
        }

        $event->update($data);

        return redirect()->back()->with('success', 'Calendar event updated successfully.');
    }

    /**
     * Remove the specified calendar event.
     */
    public function destroy(CalendarEvent $event): RedirectResponse
    {
        $event->delete();

        return redirect()->back()->with('success', 'Calendar event deleted successfully.');
    }
}
