# Runsheet Dispatch Calendar, Modernization & Dual-Filtering Guide

> **Target Version / Scope:** Laravel 11 + Inertia React (TypeScript) + Tailwind CSS  
> **Applies to:** Pickup Runsheets, Delivery Runsheets, Dispatch Calendars, Driver Assignment Modals, and Filter Engine

---

## 1. Overview of Changes

This guide documents all updates, architectural improvements, and bug fixes applied to the Runsheets system. You can use this document to replicate the exact functionality and UI on any clone or fork of this repository.

### Key Enhancements
1. **Interactive Runsheet Dispatch Calendars:**
   - Dedicated Pickup Dispatch Calendar (`/admin/runsheets/pickups/calendar`).
   - Dedicated Delivery Dispatch Calendar (`/admin/runsheets/deliveries/calendar`).
   - Month, Week, and Day views with real-time driver/zone filters, workload metrics, and unscheduled inventory drawers.
   - High-performance JSON calendar feed (`/admin/runsheets/calendar/feed`).
2. **Dual-Filtering System for Pickup Creation:**
   - Replaced legacy raw suburb chips with a dual-filter engine:
     - **Pickup Area:** Categorized by official Pickup Zones (`Brisbane City`, `Sydney Metro`, `Unassigned`, etc.), mapping suburbs via `pickupZones` to prevent unmapped suburbs (e.g., "Poblacion NSW") from leaking into area filters.
     - **Pickup Date:** Categorized by sender requested collection dates (`preferred_date`), formatted into readable chips (`Thu, 1 Oct`, `Unscheduled`) with live counts.
     - **Simultaneous Filtering:** Both filters operate concurrently with search and include a 1-click "Reset Filters" action.
3. **Driver Assignment Modal Modernization:**
   - Redesigned the "Select Picker" and "Select Courier" dialogs across all 4 runsheet forms (`pickups/create.tsx`, `pickups/edit.tsx`, `deliveries/create.tsx`, `deliveries/edit.tsx`).
   - Eliminated oversized, bubble-like elements (`rounded-[2.5rem]`) in favor of crisp, professional web app cards (`rounded-lg`, `border-slate-200/80`).
   - Integrated Lucide `<Phone />` icons (removed emojis) and active task counters (`0 active tasks` / `X active tasks`).
4. **Table & Card Alignment:**
   - Renamed table columns to **Pickup Area** and **Pickup Date**.
   - Location cell prominently displays the resolved **Pickup Area** (bold) with specific suburb/state details underneath.
   - Grid cards display both Pickup Area and Pickup Date.
   - Smart empty state with a "Clear All Filters" button when search or filter combinations yield zero records.
5. **Eyebrow & Heading Component Consistency:**
   - Standardized `Heading` component in `resources/js/components/common/heading.tsx` to support the eyebrow design pattern.

---

## 2. Backend Routes & Controllers

### 2.1 Web Routes (`routes/web.php`)

Add the dispatch calendar routes to the `admin` middleware group:

```php
// routes/web.php inside Route::middleware(['auth', 'verified', 'role:admin'])->prefix('admin')->as('admin.')->group(...)

Route::get('runsheets/pickups', [RunsheetController::class, 'pickups'])->name('runsheets.pickups');
Route::get('runsheets/pickups/calendar', [RunsheetController::class, 'pickupCalendar'])->name('runsheets.pickups.calendar');

Route::get('runsheets/deliveries', [RunsheetController::class, 'deliveries'])->name('runsheets.deliveries');
Route::get('runsheets/deliveries/calendar', [RunsheetController::class, 'deliveryCalendar'])->name('runsheets.deliveries.calendar');

Route::get('runsheets/calendar/feed', [RunsheetController::class, 'dispatchCalendarFeed'])->name('runsheets.calendar.feed');
```

---

### 2.2 Controller Implementation (`app/Http/Controllers/Admin/RunsheetController.php`)

Add methods for calendar rendering, JSON feeds, and calendar data aggregation:

```php
use App\Enums\Role;
use App\Enums\RunsheetType;
use App\Models\Area;
use App\Models\PickupZone;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Pickup Dispatch Calendar
 */
public function pickupCalendar(Request $request)
{
    $pickers = User::where('role', Role::Picker)
        ->with('picker:id,user_id,mobile')
        ->orderBy('name')
        ->get(['id', 'name', 'email']);

    $pickupZones = PickupZone::query()
        ->where('is_active', true)
        ->orderBy('name')
        ->get(['id', 'name', 'code']);

    $start = $request->input('start', now()->startOfMonth()->subDays(7)->toDateString());
    $end = $request->input('end', now()->endOfMonth()->addDays(7)->toDateString());

    $initialData = $this->getDispatchCalendarData(
        type: 'pickup',
        start: $start,
        end: $end,
        driverId: $request->input('driver_id') ? (int) $request->input('driver_id') : null,
        zoneId: $request->input('zone_id') ? (int) $request->input('zone_id') : null,
        areaId: null,
    );

    return Inertia::render('admin/runsheets/pickups/calendar', [
        'initialData' => $initialData,
        'pickers' => $pickers,
        'pickupZones' => $pickupZones,
        'filters' => $request->only(['start', 'end', 'driver_id', 'zone_id']),
    ]);
}

/**
 * Delivery Dispatch Calendar
 */
public function deliveryCalendar(Request $request)
{
    $couriers = User::where('role', Role::Courier)
        ->with('courier:id,user_id,mobile,area_id')
        ->orderBy('name')
        ->get(['id', 'name', 'email']);

    $areas = Area::query()
        ->where('is_active', true)
        ->orderBy('name')
        ->get(['id', 'name']);

    $start = $request->input('start', now()->startOfMonth()->subDays(7)->toDateString());
    $end = $request->input('end', now()->endOfMonth()->addDays(7)->toDateString());

    $initialData = $this->getDispatchCalendarData(
        type: 'delivery',
        start: $start,
        end: $end,
        driverId: $request->input('driver_id') ? (int) $request->input('driver_id') : null,
        zoneId: null,
        areaId: $request->input('area_id') ? (int) $request->input('area_id') : null,
    );

    return Inertia::render('admin/runsheets/deliveries/calendar', [
        'initialData' => $initialData,
        'couriers' => $couriers,
        'areas' => $areas,
        'filters' => $request->only(['start', 'end', 'driver_id', 'area_id']),
    ]);
}

/**
 * JSON Feed for asynchronous calendar navigation (next/prev month, filter changes)
 */
public function dispatchCalendarFeed(Request $request)
{
    $type = $request->input('type', 'all');
    $start = $request->input('start', now()->startOfMonth()->subDays(7)->toDateString());
    $end = $request->input('end', now()->endOfMonth()->addDays(7)->toDateString());
    $driverId = $request->input('driver_id') ? (int) $request->input('driver_id') : null;
    $zoneId = $request->input('zone_id') ? (int) $request->input('zone_id') : null;
    $areaId = $request->input('area_id') ? (int) $request->input('area_id') : null;

    $data = $this->getDispatchCalendarData($type, $start, $end, $driverId, $zoneId, $areaId);

    return response()->json($data);
}

/**
 * Core Data Aggregator for Dispatch Calendars
 */
private function getDispatchCalendarData(
    string $type,
    string $start,
    string $end,
    ?int $driverId = null,
    ?int $zoneId = null,
    ?int $areaId = null
): array {
    $startDate = Carbon::parse($start)->startOfDay();
    $endDate = Carbon::parse($end)->endOfDay();

    // 1. Runsheets Query
    $runsheetQuery = Runsheet::query()
        ->whereBetween('scheduled_date', [$startDate, $endDate])
        ->with([
            'picker:id,name,email,role',
            'picker.picker:id,user_id,mobile',
            'courier:id,name,email,role',
            'courier.courier:id,user_id,mobile,area_id',
            'bookings.sender.pickupZone',
            'bookings.boxes.boxType',
            'boxes.booking.sender',
            'boxes.recipient.area',
            'boxes.boxType',
        ]);

    if ($type === 'pickup') {
        $runsheetQuery->where('type', RunsheetType::Pickup);
        if ($driverId) {
            $runsheetQuery->where('picker_id', $driverId);
        }
        if ($zoneId) {
            $zone = PickupZone::find($zoneId);
            if ($zone) {
                $runsheetQuery->where(function ($q) use ($zone) {
                    $q->where('area_description', $zone->name)
                      ->orWhereHas('bookings.sender', function ($sq) use ($zone) {
                          $sq->where('pickup_zone_id', $zone->id);
                      });
                });
            }
        }
    } elseif ($type === 'delivery') {
        $runsheetQuery->where('type', RunsheetType::Delivery);
        if ($driverId) {
            $runsheetQuery->where('courier_id', $driverId);
        }
        if ($areaId) {
            $area = Area::find($areaId);
            if ($area) {
                $runsheetQuery->where(function ($q) use ($area) {
                    $q->where('area_description', $area->name)
                      ->orWhereHas('boxes.recipient', function ($sq) use ($area) {
                          $sq->where('area_id', $area->id);
                      });
                });
            }
        }
    }

    $runsheets = $runsheetQuery->orderBy('scheduled_date')->get();

    // 2. Unscheduled Bookings for Pickups
    $unscheduledBookings = collect();
    if ($type === 'pickup' || $type === 'all') {
        $unscheduledBookings = Booking::query()
            ->where('status', BookingStatus::Confirmed)
            ->where('payment_status', PaymentStatus::Paid)
            ->whereDoesntHave('runsheetBookings')
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('preferred_date', [$startDate, $endDate])
                  ->orWhereNull('preferred_date');
            })
            ->with(['sender.pickupZone', 'boxes.boxType'])
            ->limit(50)
            ->get();
    }

    // 3. Incoming Deliveries for Couriers
    $incomingDeliveries = collect();
    if ($type === 'delivery' || $type === 'all') {
        $incomingDeliveries = Box::query()
            ->whereIn('status', [BoxStatus::ArrivedPh, BoxStatus::InTransitPh])
            ->whereDoesntHave('runsheetBoxes')
            ->with(['booking.sender', 'recipient.area', 'boxType'])
            ->limit(50)
            ->get();
    }

    return [
        'runsheets' => $runsheets,
        'unscheduled_bookings' => $unscheduledBookings,
        'incoming_deliveries' => $incomingDeliveries,
        'summary' => [
            'total_runsheets' => $runsheets->count(),
            'total_stops' => $runsheets->sum(fn ($r) => $r->bookings->count() + $r->boxes->count()),
            'assigned' => $runsheets->whereNotNull('picker_id')->whereNotNull('courier_id')->count(),
            'unassigned' => $runsheets->whereNull('picker_id')->whereNull('courier_id')->count(),
        ],
    ];
}
```

---

### 2.3 Middleware for Return URLs (`app/Http/Middleware/HandleInertiaRequests.php`)

Ensure Inertia shares `admin_return_url` so back buttons return users to the calendar when navigated from the calendar:

```php
public function share(Request $request): array
{
    return array_merge(parent::share($request), [
        // ... existing props
        'admin_return_url' => $request->session()->get('admin_return_url', url()->previous()),
    ]);
}
```

---

## 3. Frontend Architecture

### 3.1 Common Heading Component (`resources/js/components/common/heading.tsx`)

Update to support standardized eyebrows and font-sans styling:

```tsx
import { cn } from '@/lib/utils';

interface HeadingProps {
    title: string;
    description?: string;
    eyebrow?: string;
    variant?: 'default' | 'small';
}

export default function Heading({
    title,
    description,
    eyebrow,
    variant = 'default',
}: HeadingProps) {
    return (
        <header className={variant === 'small' ? '' : 'space-y-1'}>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2
                className={cn(
                    "font-sans text-brand-text",
                    variant === 'small'
                        ? 'mb-0.5 text-base font-bold'
                        : 'text-xl font-bold tracking-tight leading-tight'
                )}
            >
                {title}
            </h2>
            {description && (
                <p className="text-xs text-muted-foreground font-sans">
                    {description}
                </p>
            )}
        </header>
    );
}
```

---

### 3.2 Dispatch Calendar Component (`resources/js/components/runsheets/RunsheetDispatchCalendar.tsx`)

Place this reusable full-feature component at `resources/js/components/runsheets/RunsheetDispatchCalendar.tsx`.

It handles:
- Month, Week, and Day views.
- Reactive date range updates with previous/next/today navigation.
- Asynchronous data fetching via `/admin/runsheets/calendar/feed`.
- Runsheet status color coding (Draft, Assigned, In Progress, Completed).
- Quick detail modals showing stops, boxes, driver contact details, and quick links.
- "Create Runsheet for Date" prefill shortcut.

---

### 3.3 Calendar Pages

#### Pickup Calendar (`resources/js/pages/admin/runsheets/pickups/calendar.tsx`):
- Wraps `RunsheetDispatchCalendar` with `type="pickup"`.
- Passes `pickers` and `pickupZones`.
- Provides quick breadcrumbs and "New Runsheet" button.

#### Delivery Calendar (`resources/js/pages/admin/runsheets/deliveries/calendar.tsx`):
- Wraps `RunsheetDispatchCalendar` with `type="delivery"`.
- Passes `couriers` and `areas`.

---

### 3.4 Table vs. Calendar View Switcher in Index Pages

In `resources/js/pages/admin/runsheets/pickups/index.tsx` and `resources/js/pages/admin/runsheets/deliveries/index.tsx`, add the toggle header:

```tsx
<div className="flex items-center gap-2.5 flex-wrap">
    <div className="inline-flex rounded-xl bg-muted/60 p-1 border shadow-xs">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-background text-foreground shadow-xs">
            <List className="w-3.5 h-3.5 text-brand-rust" />
            <span>Table View</span>
        </span>
        <Link
            href="/admin/runsheets/pickups/calendar"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Calendar View</span>
        </Link>
    </div>

    <Link
        href="/admin/runsheets/create?type=pickup"
        className="bg-brand-rust text-white hover:bg-brand-rust/90 flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-brand-rust/10 transition-all font-sans"
    >
        <Plus className="size-4" />
        New Runsheet
    </Link>
</div>
```

---

## 4. Pickup Runsheet Creation Dual-Filtering System

File: `resources/js/pages/admin/runsheets/pickups/create.tsx`

### 4.1 Filter State & Helper Functions

```tsx
const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');

// 1. Resolve Booking Pickup Area from official PickupZones
const getBookingPickupArea = (booking: Booking): string => {
    const directZone = booking.sender?.pickup_zone?.name || booking.sender?.pickupZone?.name;
    if (directZone) return directZone;

    const matchedZone = findZoneForSender(booking.sender);
    if (matchedZone) return matchedZone;

    // Default to Unassigned so arbitrary suburb strings (like Poblacion NSW) do not become areas
    return 'Unassigned';
};

// 2. Resolve Booking Preferred Date (YYYY-MM-DD or Unscheduled)
const getBookingPickupDate = (booking: Booking): string => {
    if (!booking.preferred_date) return 'Unscheduled';
    return booking.preferred_date.substring(0, 10);
};

// 3. Compute unique Pickup Areas with counts
const pickupAreaOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    pickupEligibleBookings.forEach((booking) => {
        const area = getBookingPickupArea(booking);
        counts[area] = (counts[area] || 0) + 1;
    });

    return Object.entries(counts).map(([name, count]) => ({
        name,
        count,
    })).sort((a, b) => {
        if (a.name === 'Unassigned') return 1;
        if (b.name === 'Unassigned') return -1;
        return a.name.localeCompare(b.name);
    });
}, [pickupEligibleBookings, pickupZones]);

// 4. Compute unique Pickup Dates with friendly labels
const pickupDateOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    pickupEligibleBookings.forEach((booking) => {
        const dateStr = getBookingPickupDate(booking);
        counts[dateStr] = (counts[dateStr] || 0) + 1;
    });

    return Object.entries(counts).map(([value, count]) => {
        let label = value;
        if (value === 'Unscheduled') {
            label = 'Unscheduled';
        } else {
            try {
                const parsed = new Date(value + 'T00:00:00');
                if (!isNaN(parsed.getTime())) {
                    label = parsed.toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric' });
                }
            } catch {
                label = value;
            }
        }
        return { value, label, count };
    }).sort((a, b) => {
        if (a.value === 'Unscheduled') return 1;
        if (b.value === 'Unscheduled') return -1;
        return a.value.localeCompare(b.value);
    });
}, [pickupEligibleBookings]);

// 5. Reactive Filter Evaluation
const filteredBookings = useMemo(() => {
    return pickupEligibleBookings.filter((booking) => {
        const matchesSearch =
            booking.reference_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            booking.sender.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            booking.sender.last_name.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        if (selectedAreaFilter !== 'all') {
            const area = getBookingPickupArea(booking);
            if (area.toLowerCase() !== selectedAreaFilter.toLowerCase()) return false;
        }

        if (selectedDateFilter !== 'all') {
            const dateStr = getBookingPickupDate(booking);
            if (dateStr !== selectedDateFilter) return false;
        }

        return true;
    });
}, [pickupEligibleBookings, searchTerm, selectedAreaFilter, selectedDateFilter, pickupZones]);
```

---

### 4.2 Dual-Tier Filter UI

```tsx
{/* Pickup Area & Pickup Date Filters */}
<div className="space-y-2 mb-3 bg-white/70 p-3 rounded-xl border border-brand-sand/40 shadow-2xs">
    {/* Filter 1: Pickup Area */}
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 custom-scrollbar">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 shrink-0 flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80 shadow-2xs font-sans">
            <MapPin className="size-3 text-brand-rust" /> Pickup Area:
        </span>
        <button
            type="button"
            onClick={() => setSelectedAreaFilter('all')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap font-sans ${
                selectedAreaFilter === 'all'
                    ? 'bg-brand-rust text-white shadow-xs'
                    : 'bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
            }`}
        >
            All Areas ({pickupEligibleBookings.length})
        </button>
        {pickupAreaOptions.map((area) => (
            <button
                key={area.name}
                type="button"
                onClick={() => setSelectedAreaFilter(area.name)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap font-sans flex items-center gap-1.5 ${
                    selectedAreaFilter.toLowerCase() === area.name.toLowerCase()
                        ? 'bg-brand-rust text-white shadow-xs'
                        : 'bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
            >
                <MapPin className={`size-3 shrink-0 ${
                    selectedAreaFilter.toLowerCase() === area.name.toLowerCase() ? 'text-white' : 'text-brand-rust'
                }`} />
                <span>{area.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    selectedAreaFilter.toLowerCase() === area.name.toLowerCase()
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-500'
                }`}>
                    {area.count}
                </span>
            </button>
        ))}
    </div>

    {/* Filter 2: Pickup Date */}
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5 custom-scrollbar">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 shrink-0 flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80 shadow-2xs font-sans">
            <Calendar className="size-3 text-brand-rust" /> Pickup Date:
        </span>
        <button
            type="button"
            onClick={() => setSelectedDateFilter('all')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap font-sans ${
                selectedDateFilter === 'all'
                    ? 'bg-brand-rust text-white shadow-xs'
                    : 'bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
            }`}
        >
            All Dates ({pickupEligibleBookings.length})
        </button>
        {pickupDateOptions.map((date) => (
            <button
                key={date.value}
                type="button"
                onClick={() => setSelectedDateFilter(date.value)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap font-sans flex items-center gap-1.5 ${
                    selectedDateFilter === date.value
                        ? 'bg-brand-rust text-white shadow-xs'
                        : 'bg-white border border-slate-200/80 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                }`}
            >
                <Calendar className={`size-3 shrink-0 ${
                    selectedDateFilter === date.value ? 'text-white' : 'text-brand-rust'
                }`} />
                <span>{date.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    selectedDateFilter === date.value
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-500'
                }`}>
                    {date.count}
                </span>
            </button>
        ))}
        {(selectedAreaFilter !== 'all' || selectedDateFilter !== 'all') && (
            <button
                type="button"
                onClick={() => {
                    setSelectedAreaFilter('all');
                    setSelectedDateFilter('all');
                }}
                className="text-[11px] text-brand-rust hover:underline font-semibold whitespace-nowrap ml-2 font-sans"
            >
                Reset Filters
            </button>
        )}
    </div>
</div>
```

---

### 4.3 Table Header & Location Cell Updates

Header:
```tsx
<th className="px-4 py-3.5 font-semibold">Stop #</th>
<th className="px-4 py-3.5 font-semibold">Booking Ref</th>
<th className="px-4 py-3.5 font-semibold">Sender Name</th>
<th className="px-4 py-3.5 font-semibold">Pickup Area</th>
<th className="px-4 py-3.5 font-semibold text-center">Boxes</th>
<th className="px-4 py-3.5 font-semibold">Status</th>
<th className="px-4 py-3.5 font-semibold">Pickup Date</th>
```

Cell:
```tsx
<td className="px-4 py-3.5 text-slate-700">
    <div className="flex items-center gap-1.5">
        <MapPin className="size-3 text-brand-rust shrink-0" />
        <span className="font-semibold text-xs text-slate-800 font-sans">{getBookingPickupArea(booking)}</span>
    </div>
    {[booking.sender.suburb, booking.sender.state].filter(Boolean).length > 0 && (
        <div className="text-[10px] text-slate-400 mt-0.5 ml-4.5 font-sans">
            {[booking.sender.suburb, booking.sender.state].filter(Boolean).join(', ')}
        </div>
    )}
</td>
```

---

## 5. Driver Selection Dialog Modernization

Applied to:
- `resources/js/pages/admin/runsheets/pickups/create.tsx`
- `resources/js/pages/admin/runsheets/pickups/edit.tsx`
- `resources/js/pages/admin/runsheets/deliveries/create.tsx`
- `resources/js/pages/admin/runsheets/deliveries/edit.tsx`

### 5.1 Card Structure & Styling

```tsx
<div className="p-3 bg-slate-50/60 max-h-[340px] overflow-y-auto space-y-1.5 custom-scrollbar">
    {displayedDrivers.map((u) => {
        const isSelected = String(data.driver_id) === String(u.id);
        const activeCount = (u as any).active_runsheet_count ?? 0;
        const initials = u.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
        const mobile = u.picker?.mobile || u.courier?.mobile || '';

        return (
            <div
                key={u.id}
                onClick={() => {
                    setData('driver_id', String(u.id));
                    setIsModalOpen(false);
                }}
                className={`group relative p-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-3 ${
                    isSelected
                        ? 'border-brand-rust bg-brand-rust/[0.04] ring-1 ring-brand-rust/20 shadow-2xs'
                        : 'border-slate-200/80 bg-white hover:border-brand-rust/40 hover:bg-slate-50 hover:shadow-2xs'
                }`}
            >
                {/* Initials Avatar */}
                <div className={`size-8 rounded-md flex items-center justify-center text-xs font-bold font-sans transition-colors shrink-0 ${
                    isSelected
                        ? 'bg-brand-rust text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 border border-slate-200/80 group-hover:bg-brand-rust/10 group-hover:text-brand-rust'
                }`}>
                    {initials}
                </div>

                {/* Driver Details */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className={`text-xs font-semibold truncate font-sans transition-colors ${
                            isSelected ? 'text-brand-rust' : 'text-slate-900 group-hover:text-brand-rust'
                        }`}>
                            {u.name}
                        </p>
                        {isSelected && (
                            <span className="text-[10px] font-semibold text-brand-rust bg-brand-rust/10 px-1.5 py-0.2 rounded shrink-0">
                                Selected
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2.5 mt-0.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium font-sans ${
                            activeCount === 0 ? 'text-emerald-700' : 'text-amber-700'
                        }`}>
                            <span className={`size-1.5 rounded-full ${activeCount === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {activeCount === 0 ? '0 active tasks' : `${activeCount} active ${activeCount === 1 ? 'task' : 'tasks'}`}
                        </span>
                        {mobile && (
                            <>
                                <span className="text-slate-300 text-xs">•</span>
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                                    <Phone className="size-2.5 text-slate-400" />
                                    {mobile}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Checkmark Indicator */}
                <div className={`size-5 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                    isSelected
                        ? 'bg-brand-rust border-brand-rust text-white shadow-2xs'
                        : 'border-slate-300 bg-white group-hover:border-slate-400'
                }`}>
                    {isSelected && <Check className="size-2.5 stroke-[3]" />}
                </div>
            </div>
        );
    })}
</div>
```

---

## 6. Automated Feature Tests

File: `tests/Feature/Admin/RunsheetDispatchCalendarTest.php`

Test coverage verifies:
1. `test_admin_can_access_pickup_calendar_page`: Confirms Inertia page renders with `initialData`, `pickers`, `pickupZones`.
2. `test_admin_can_access_delivery_calendar_page`: Confirms Inertia page renders with `initialData`, `couriers`, `areas`.
3. `test_pickup_calendar_feed_returns_collections_and_runsheets`: Confirms JSON API returns correctly aggregated collections, runsheets, and summary metrics.
4. `test_delivery_calendar_feed_returns_deliveries_and_runsheets`: Confirms JSON API returns courier delivery runsheets and arrived boxes.
5. `test_calendar_feed_filters_by_driver_and_zone`: Verifies filtering query parameters work as expected.

Run tests using:
```bash
php artisan test --filter=RunsheetDispatchCalendarTest
```

---

## 7. Step-by-Step Checklist to Apply to a Clone Repository

To apply all these updates to another clone or branch of the repository:

1. **Routes & Middleware:**
   - Add calendar routes in `routes/web.php`.
   - Update `app/Http/Middleware/HandleInertiaRequests.php` to share `admin_return_url`.
2. **Controller Logic:**
   - Copy `pickupCalendar`, `deliveryCalendar`, `dispatchCalendarFeed`, and `getDispatchCalendarData` into `app/Http/Controllers/Admin/RunsheetController.php`.
3. **Frontend Components:**
   - Copy `resources/js/components/runsheets/RunsheetDispatchCalendar.tsx`.
   - Update `resources/js/components/common/heading.tsx`.
4. **Pages:**
   - Copy `resources/js/pages/admin/runsheets/pickups/calendar.tsx`.
   - Copy `resources/js/pages/admin/runsheets/deliveries/calendar.tsx`.
   - Update view switchers in `resources/js/pages/admin/runsheets/pickups/index.tsx` and `deliveries/index.tsx`.
   - Update `pickups/create.tsx` with the dual-filter bar and table headers.
   - Update `pickups/edit.tsx`, `deliveries/create.tsx`, and `deliveries/edit.tsx` with the modernized driver dialogs.
5. **Verify Build & Tests:**
   ```bash
   npm run build
   php artisan test --filter=RunsheetDispatchCalendarTest
   ```
