<?php

namespace App\Http\Controllers;

use App\Enums\BoxStatus;
use App\Models\Box;
use App\Models\Recipient;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class RecipientDashboardController extends Controller
{
    public function index()
    {
        /** @var User $user */
        $user = Auth::user();

        // Find boxes where this user is the recipient.
        // Primary: match via user_id-linked Recipient record (secure, non-spoofable).
        // Fallback: match by verified email if no user_id link exists yet.
        $recipientIds = collect();

        // Primary match: Recipient linked directly to user via user_id
        $linkedRecipient = $user->recipient;
        if ($linkedRecipient) {
            $recipientIds->push($linkedRecipient->id);
        }

        // Fallback: match by user's email (more trustworthy than phone number)
        if ($user->email) {
            $emailMatchedIds = Recipient::where('email', $user->email)
                ->whereNull('user_id')
                ->pluck('id');
            $recipientIds = $recipientIds->merge($emailMatchedIds);
        }

        $recipientIds = $recipientIds->unique()->values();

        $incomingBoxes = Box::with(['booking', 'recipient.area', 'boxType', 'updates'])
            ->when($recipientIds->isNotEmpty(), function ($query) use ($recipientIds) {
                $query->whereIn('recipient_id', $recipientIds);
            }, function ($query) {
                $query->whereRaw('1=0'); // Don't match anything if no recipient found
            })
            ->latest()
            ->get();

        $stats = [
            'total' => $incomingBoxes->count(),
            'active' => $incomingBoxes->whereNotIn('status', [BoxStatus::Delivered, BoxStatus::Cancelled])->count(),
            'delivered' => $incomingBoxes->where('status', BoxStatus::Delivered)->count(),
        ];

        return Inertia::render('recipient/Dashboard', [
            'boxes' => $incomingBoxes,
            'stats' => $stats,
            'pageTitle' => 'Recipient Dashboard',
            'breadcrumbs' => [
                ['title' => 'Home', 'href' => route('recipient.dashboard')],
            ],
        ]);
    }
}
