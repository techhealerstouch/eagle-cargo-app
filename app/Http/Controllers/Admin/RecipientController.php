<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Area;
use App\Models\Recipient;
use App\Rules\Phone;
use Illuminate\Http\Request;
use Inertia\Inertia;

class RecipientController extends Controller
{
    public function index(Request $request)
    {
        $query = Recipient::with(['sender', 'area']);

        $query->when($request->search, function ($q, $search) {
            $q->where(function ($qq) use ($search) {
                $qq->where('name', 'like', "%{$search}%")
                    ->orWhere('city', 'like', "%{$search}%")
                    ->orWhere('province', 'like', "%{$search}%")
                    ->orWhereHas('sender', function ($sq) use ($search) {
                        $sq->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        })->when($request->sender_id, function ($q, $sender_id) {
            $q->where('sender_id', $sender_id);
        });

        $recipients = $query->latest()->paginate(10)->withQueryString();

        return Inertia::render('admin/recipients/index', [
            'recipients' => $recipients,
            'filters' => $request->only(['search', 'sender_id']),
        ]);
    }

    public function show(Recipient $recipient)
    {
        $recipient->load(['sender', 'area', 'user']);

        $boxes = $recipient->boxes()
            ->with(['booking', 'boxType'])
            ->latest()
            ->paginate(10);

        $stats = [
            'totalBoxesCount' => $recipient->boxes()->count(),
        ];

        return Inertia::render('admin/recipients/show', [
            'recipient' => $recipient,
            'boxes' => $boxes,
            'stats' => $stats,
        ]);
    }

    public function edit(Recipient $recipient)
    {
        $areas = Area::where('is_active', true)->orderBy('name')->get();

        return Inertia::render('admin/recipients/edit', [
            'recipient' => $recipient->load(['sender', 'area']),
            'areas' => $areas,
        ]);
    }

    public function update(Request $request, Recipient $recipient)
    {
        if ($request->filled('phone_number')) {
            $request->merge([
                'phone_number' => preg_replace('/[\s\-\(\)]+/', '', $request->input('phone_number'))
            ]);
        }
        if ($request->filled('secondary_phone_number')) {
            $request->merge([
                'secondary_phone_number' => preg_replace('/[\s\-\(\)]+/', '', $request->input('secondary_phone_number'))
            ]);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone_number' => [
                'nullable',
                'string',
                'max:50',
                new Phone('phone number'),
            ],
            'secondary_phone_number' => [
                'nullable',
                'string',
                'max:50',
                function ($attribute, $value, $fail) {
                    if (! empty($value)) {
                        (new Phone('secondary phone number'))->validate($attribute, $value, $fail);
                    }
                },
            ],
            'address' => 'required|string|max:500',
            'city' => 'required|string|max:100', // Mandate city to avoid N/A destinations (Item 74)
            'province' => 'required|string|max:100', // Mandate province (Item 74)
            'zip_code' => 'nullable|string|max:20',
            'landmarks' => 'nullable|string|max:500',
            'area_id' => 'nullable|exists:areas,id',
        ]);

        $recipient->update($validated);

        return redirect()->route('admin.recipients.index')->with('success', 'Recipient updated successfully.');
    }

    public function destroy(Recipient $recipient)
    {
        $recipient->delete();

        return redirect()->route('admin.recipients.index')->with('success', 'Recipient deleted.');
    }
}
