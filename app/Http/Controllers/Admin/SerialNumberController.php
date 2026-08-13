<?php

namespace App\Http\Controllers\Admin;

use App\Enums\SerialNumberStatus;
use App\Http\Controllers\Controller;
use App\Models\SerialNumber;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class SerialNumberController extends Controller
{
    public function index(Request $request)
    {
        $query = SerialNumber::with([
            'box.booking.sender.user',
            'box.booking.runsheets.picker',
            'box.runsheets.courier',
            'assignedByUser'
        ]);
        $this->applyFilters($query, $request);

        $sort = $request->sort ?? 'id';
        $direction = $request->direction ?? 'desc';

        $serialNumbers = $query->orderBy($sort, $direction)->paginate(15)->withQueryString();

        $stats = [
            'total' => SerialNumber::count(),
            'available' => SerialNumber::where('status', SerialNumberStatus::Available->value)->count(),
            'allocated' => SerialNumber::where('status', SerialNumberStatus::Allocated->value)->count(),
            'assigned' => SerialNumber::where('status', SerialNumberStatus::Assigned->value)->count(),
            'void' => SerialNumber::where('status', SerialNumberStatus::Void->value)->count(),
        ];

        $pickers = \App\Models\User::where('role', \App\Enums\Role::Picker->value)->orderBy('name')->get(['id', 'name']);
        $couriers = \App\Models\User::where('role', \App\Enums\Role::Courier->value)->orderBy('name')->get(['id', 'name']);

        return Inertia::render('admin/serial-numbers/Index', [
            'serialNumbers' => $serialNumbers,
            'filters' => $request->only(['search', 'status', 'sort', 'direction', 'start_date', 'end_date', 'picker_id', 'courier_id']),
            'statuses' => collect(SerialNumberStatus::cases())->map->value,
            'stats' => $stats,
            'pickers' => $pickers,
            'couriers' => $couriers,
        ]);
    }

    private function applyFilters($query, Request $request)
    {
        if ($request->search) {
            $query->where(function($q) use ($request) {
                $q->where('serial_number', 'like', "%{$request->search}%")
                  ->orWhereHas('box', function ($sub) use ($request) {
                      $sub->where('tracking_number', 'like', "%{$request->search}%");
                  });
            });
        }

        if ($request->status) {
            $query->where('status', $request->status);
        }

        if ($request->start_date) {
            $query->whereDate('allocated_at', '>=', $request->start_date);
        }

        if ($request->end_date) {
            $query->whereDate('allocated_at', '<=', $request->end_date);
        }

        if ($request->picker_id) {
            $query->where(function($q) use ($request) {
                $q->whereHas('box.booking.runsheets', function ($sub) use ($request) {
                    $sub->where('type', \App\Enums\RunsheetType::Pickup->value)
                      ->where('picker_id', $request->picker_id);
                })->orWhere('assigned_by', $request->picker_id);
            });
        }

        if ($request->courier_id) {
            $query->whereHas('box.runsheets', function ($q) use ($request) {
                $q->where('type', \App\Enums\RunsheetType::Delivery->value)
                  ->where('courier_id', $request->courier_id);
            });
        }
    }

    public function store(Request $request)
    {
        $request->validate([
            'start' => 'required|integer|min:1',
            'end' => 'required|integer|gte:start|max:9999999',
            'prefix' => 'nullable|string|max:10',
            'padding' => 'nullable|integer|min:1|max:10',
        ]);

        $start = $request->start;
        $end = $request->end;
        $prefix = $request->prefix ?? '';
        $padding = $request->padding ?? 6;

        $batchSize = 1000;
        $records = [];
        $now = now();

        DB::transaction(function () use ($start, $end, $prefix, $padding, $batchSize, $now) {
            for ($i = $start; $i <= $end; $i++) {
                $number = str_pad($i, $padding, '0', STR_PAD_LEFT);
                $serialNumber = $prefix . $number;

                $records[] = [
                    'serial_number' => $serialNumber,
                    'status' => SerialNumberStatus::Available->value,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];

                if (count($records) >= $batchSize) {
                    SerialNumber::insertOrIgnore($records);
                    $records = [];
                }
            }

            if (!empty($records)) {
                SerialNumber::insertOrIgnore($records);
            }
        });

        return back()->with('success', 'Serial numbers generated successfully.');
    }

    public function export(Request $request)
    {
        $query = SerialNumber::with([
            'box.booking.sender.user',
            'box.booking.runsheets.picker',
            'box.runsheets.courier',
            'assignedByUser'
        ]);

        if ($request->has('ids')) {
            $ids = explode(',', $request->ids);
            $query->whereIn('id', $ids);
        } else {
            $this->applyFilters($query, $request);
        }

        $totalCount = $query->count();
        $serialNumbers = $query->orderBy('id', 'desc')->limit(250)->get();
        $isTruncated = $totalCount > 250;

        $stats = [
            'total' => SerialNumber::count(),
            'available' => SerialNumber::where('status', \App\Enums\SerialNumberStatus::Available->value)->count(),
            'allocated' => SerialNumber::where('status', \App\Enums\SerialNumberStatus::Allocated->value)->count(),
            'void' => SerialNumber::where('status', \App\Enums\SerialNumberStatus::Void->value)->count(),
        ];

        $pdf = app('dompdf.wrapper')->loadView('admin.serial-numbers.pdf', compact('serialNumbers', 'stats', 'isTruncated', 'totalCount'))
            ->setPaper('a4', 'portrait');

        return $pdf->stream('serial_numbers_report.pdf');
    }

    public function void(SerialNumber $serialNumber)
    {
        if ($serialNumber->status !== SerialNumberStatus::Void) {
            $serialNumber->update(['status' => SerialNumberStatus::Void->value]);
        }

        return back()->with('success', 'Serial number voided successfully.');
    }

    public function bulkVoid(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:serial_numbers,id',
        ]);

        SerialNumber::whereIn('id', $request->ids)
            ->where('status', '!=', SerialNumberStatus::Void->value)
            ->update(['status' => SerialNumberStatus::Void->value]);

        return back()->with('success', 'Selected serial numbers voided successfully.');
    }

    public function show(SerialNumber $serialNumber)
    {
        $serialNumber->load([
            'box.booking.sender.user',
            'box.booking.runsheets.picker',
            'box.runsheets.courier',
            'box.recipient',
            'box.boxType',
            'box.batch',
            'assignedByUser'
        ]);

        return Inertia::render('admin/serial-numbers/Show', [
            'serialNumber' => $serialNumber,
        ]);
    }
}
