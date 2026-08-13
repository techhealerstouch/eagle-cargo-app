<?php

namespace App\Http\Controllers;

use App\Models\Area;
use App\Models\Recipient;
use App\Rules\Phone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class SenderRecipientController extends Controller
{
    public function index(Request $request)
    {
        $sender = Auth::user()->sender;
        $search = trim((string) $request->input('search', ''));

        $recipients = $sender
            ? $sender->recipients()
                ->with('area')
                ->withCount('boxes')
                ->when($search !== '', function ($query) use ($search) {
                    $query->where(function ($recipientQuery) use ($search) {
                        $recipientQuery->where('name', 'like', "%{$search}%")
                            ->orWhere('city', 'like', "%{$search}%")
                            ->orWhere('province', 'like', "%{$search}%")
                            ->orWhere('phone_number', 'like', "%{$search}%");
                    });
                })
                ->latest()
                ->paginate(10)
                ->withQueryString()
            : null;

        return Inertia::render('sender/Recipients', [
            'recipients' => $recipients,
            'filters' => ['search' => $search],
        ]);
    }

    public function edit(Recipient $recipient)
    {
        $this->assertOwner($recipient);

        return Inertia::render('sender/EditRecipient', [
            'recipient' => $recipient->load('area'),
            'areas' => Area::where('is_active', true)->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function update(Request $request, Recipient $recipient)
    {
        $this->assertOwner($recipient);

        $validated = $this->validatedData($request);

        // Option A: block area change if any linked box is currently mid-transit.
        // Area determines the pricing matrix (BoxPrice), so changing it after a rate
        // has been charged would create a price discrepancy.
        if (
            isset($validated['area_id']) &&
            (int) $validated['area_id'] !== (int) $recipient->area_id
        ) {
            $midTransitStatuses = [
                'loaded_to_container',
                'in_transit',
                'arrived',
                'for_checking_unloading',
                'unloaded_manila',
                'for_delivery_scheduling',
                'en_route_roro',
                'out_for_delivery',
            ];

            $hasMidTransitBox = $recipient->boxes()
                ->whereIn('status', $midTransitStatuses)
                ->exists();

            if ($hasMidTransitBox) {
                return back()->withErrors([
                    'area_id' => 'The delivery area cannot be changed while one or more boxes linked to this recipient are currently in transit. Please contact support to arrange a re-routing.',
                ])->withInput();
            }
        }

        $recipient->update($validated);

        return redirect()->route('sender.recipients.index')->with('success', 'Recipient updated successfully.');
    }

    public function destroy(Recipient $recipient)
    {
        $this->assertOwner($recipient);

        if ($recipient->boxes()->exists()) {
            return back()->with('error', 'This recipient is linked to shipment history and cannot be deleted.');
        }

        $recipient->delete();

        return redirect()->route('sender.recipients.index')->with('success', 'Recipient deleted.');
    }

    private function assertOwner(Recipient $recipient): void
    {
        if (! Auth::user()->sender || $recipient->sender_id !== Auth::user()->sender->id) {
            abort(403);
        }
    }

    private function validatedData(Request $request): array
    {
        if ($request->filled('phone_number')) {
            $request->merge([
                'phone_number' => preg_replace('/[\s\-\(\)]+/', '', $request->input('phone_number'))
            ]);
        }

        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone_number' => [
                'nullable',
                'string',
                'max:50',
                new Phone('phone number'),
            ],
            'address' => ['required', 'string', 'max:500'],
            'city' => ['required', 'string', 'max:100'],
            'province' => ['required', 'string', 'max:100'],
            'zip_code' => ['nullable', 'string', 'max:20'],
            'landmarks' => ['nullable', 'string', 'max:500'],
            'area_id' => ['required', Rule::exists('areas', 'id')->where('is_active', true)],
        ]);
    }
}
