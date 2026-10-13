<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Enquiry;
use App\Models\Sender;
use Illuminate\Http\Request;
use Inertia\Inertia;

class EnquiryController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'is_read' => ['nullable', 'string', 'in:all,read,unread'],
            'status' => ['nullable', 'string', 'in:all,waiting,replied'],
            'selected' => ['nullable', 'integer'],
            'email' => ['nullable', 'string', 'max:255'],
        ]);

        // Base query to group conversation threads by customer email
        $emailQuery = Enquiry::query()
            ->select('email')
            ->selectRaw('MAX(created_at) as latest_activity')
            ->groupBy('email');

        if (! empty($validated['search'])) {
            $search = trim($validated['search']);
            $matchingEmails = Enquiry::where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('mobile', 'like', "%{$search}%")
                    ->orWhere('message', 'like', "%{$search}%")
                    ->orWhere('admin_notes', 'like', "%{$search}%");
            })->pluck('email')->unique();

            $emailQuery->whereIn('email', $matchingEmails);
        }

        if (! empty($validated['is_read']) && $validated['is_read'] !== 'all') {
            $unreadEmails = Enquiry::where('is_read', false)->pluck('email')->unique();
            if ($validated['is_read'] === 'unread') {
                $emailQuery->whereIn('email', $unreadEmails);
            } elseif ($validated['is_read'] === 'read') {
                $emailQuery->whereNotIn('email', $unreadEmails);
            }
        }

        if (! empty($validated['status']) && $validated['status'] !== 'all') {
            $waitingEmails = Enquiry::where(function ($q) {
                $q->whereNull('admin_notes')->orWhere('admin_notes', '');
            })->pluck('email')->unique();

            if ($validated['status'] === 'waiting') {
                $emailQuery->whereIn('email', $waitingEmails);
            } elseif ($validated['status'] === 'replied') {
                $emailQuery->whereNotIn('email', $waitingEmails);
            }
        }

        $paginatedEmails = $emailQuery
            ->orderByDesc('latest_activity')
            ->paginate(50)
            ->withQueryString();

        // Fetch all enquiries belonging to the displayed conversation threads
        $emails = $paginatedEmails->pluck('email');
        $allEnquiries = Enquiry::whereIn('email', $emails)
            ->oldest()
            ->get()
            ->groupBy('email');

        // Transform paginated emails into rich conversation threads
        $threads = $paginatedEmails->through(function ($item) use ($allEnquiries) {
            $threadEnquiries = $allEnquiries->get($item->email, collect());
            $latest = $threadEnquiries->last();
            $unreadCount = $threadEnquiries->where('is_read', false)->count();
            $waitingCount = $threadEnquiries->filter(fn ($e) => empty($e->admin_notes))->count();

            return [
                'id' => $latest?->id,
                'email' => $item->email,
                'name' => $latest?->name ?? 'Customer',
                'mobile' => $latest?->mobile,
                'message' => $latest?->message ?? '',
                'latest_message' => $latest?->message ?? '',
                'latest_created_at' => $latest?->created_at?->toISOString() ?? $item->latest_activity,
                'created_at' => $latest?->created_at?->toISOString() ?? $item->latest_activity,
                'is_read' => $unreadCount === 0,
                'unread_count' => $unreadCount,
                'status' => $waitingCount > 0 ? 'waiting' : 'replied',
                'messages_count' => $threadEnquiries->count(),
                'messages' => $threadEnquiries->map(fn ($e) => [
                    'id' => $e->id,
                    'name' => $e->name,
                    'email' => $e->email,
                    'mobile' => $e->mobile,
                    'message' => $e->message,
                    'admin_notes' => $e->admin_notes,
                    'is_read' => (bool) $e->is_read,
                    'read_at' => $e->read_at?->toISOString(),
                    'replied_at' => $e->replied_at?->toISOString(),
                    'created_at' => $e->created_at?->toISOString(),
                ])->values(),
            ];
        });

        // Determine which thread is currently selected
        $selectedId = $request->input('selected');
        $selectedEmail = $request->input('email');
        $selectedThread = null;

        if ($selectedEmail) {
            $selectedThread = $threads->firstWhere('email', $selectedEmail);
        } elseif ($selectedId) {
            $selectedThread = $threads->first(function ($t) use ($selectedId) {
                return $t['id'] == $selectedId || collect($t['messages'])->contains('id', $selectedId);
            });

            // If selected enquiry is on another page, fetch its thread directly
            if (! $selectedThread) {
                $targetEnquiry = Enquiry::find($selectedId);
                if ($targetEnquiry) {
                    $targetThreadEnquiries = Enquiry::where('email', $targetEnquiry->email)->oldest()->get();
                    $latest = $targetThreadEnquiries->last();
                    $unreadCount = $targetThreadEnquiries->where('is_read', false)->count();
                    $waitingCount = $targetThreadEnquiries->filter(fn ($e) => empty($e->admin_notes))->count();

                    $selectedThread = [
                        'id' => $latest?->id,
                        'email' => $targetEnquiry->email,
                        'name' => $latest?->name ?? 'Customer',
                        'mobile' => $latest?->mobile,
                        'message' => $latest?->message ?? '',
                        'latest_message' => $latest?->message ?? '',
                        'latest_created_at' => $latest?->created_at?->toISOString(),
                        'created_at' => $latest?->created_at?->toISOString(),
                        'is_read' => $unreadCount === 0,
                        'unread_count' => $unreadCount,
                        'status' => $waitingCount > 0 ? 'waiting' : 'replied',
                        'messages_count' => $targetThreadEnquiries->count(),
                        'messages' => $targetThreadEnquiries->map(fn ($e) => [
                            'id' => $e->id,
                            'name' => $e->name,
                            'email' => $e->email,
                            'mobile' => $e->mobile,
                            'message' => $e->message,
                            'admin_notes' => $e->admin_notes,
                            'is_read' => (bool) $e->is_read,
                            'read_at' => $e->read_at?->toISOString(),
                            'replied_at' => $e->replied_at?->toISOString(),
                            'created_at' => $e->created_at?->toISOString(),
                        ])->values(),
                    ];
                }
            }
        }

        if (! $selectedThread && $threads->isNotEmpty()) {
            $selectedThread = $threads->first();
        }

        // When viewing a conversation thread, mark all inbound messages as read
        if ($selectedThread) {
            Enquiry::where('email', $selectedThread['email'])
                ->where('is_read', false)
                ->update([
                    'is_read' => true,
                    'read_at' => now(),
                ]);
        }

        // Identify the specific enquiry to reply to (prefer awaiting/unreplied, else latest)
        $selectedEnquiry = null;
        if ($selectedThread && ! empty($selectedThread['messages'])) {
            $messagesCollection = collect($selectedThread['messages']);
            $unreplied = $messagesCollection->first(fn ($m) => empty($m['admin_notes']));
            $targetMessage = $unreplied ?: $messagesCollection->last();
            if ($targetMessage) {
                $selectedEnquiry = Enquiry::find($targetMessage['id']);
            }
        }

        // Fetch associated sender account and recent shipments if registered
        $senderContext = null;
        if ($selectedThread) {
            $sender = Sender::where('email', $selectedThread['email'])
                ->with(['bookings' => fn ($q) => $q->latest()->take(5)])
                ->first();

            if ($sender) {
                $senderContext = [
                    'id' => $sender->id,
                    'name' => trim("{$sender->first_name} {$sender->last_name}"),
                    'email' => $sender->email,
                    'mobile' => $sender->mobile,
                    'city' => trim("{$sender->suburb} {$sender->state}"),
                    'bookings' => $sender->bookings->map(fn ($b) => [
                        'id' => $b->id,
                        'reference_number' => $b->reference_number ?? "BK-{$b->id}",
                        'status' => $b->status?->value ?? 'pending',
                        'destination' => $b->destination,
                        'created_at' => $b->created_at->format('M d, Y'),
                    ]),
                ];
            }
        }

        // Calculate aggregate statistics by customer thread
        $totalThreads = Enquiry::distinct('email')->count('email');
        $unreadThreads = Enquiry::where('is_read', false)->distinct('email')->count('email');
        $waitingThreads = Enquiry::where(function ($q) {
            $q->whereNull('admin_notes')->orWhere('admin_notes', '');
        })->distinct('email')->count('email');
        $repliedThreads = max(0, $totalThreads - $waitingThreads);

        $stats = [
            'total' => $totalThreads,
            'unread' => $unreadThreads,
            'waiting' => $waitingThreads,
            'replied' => $repliedThreads,
        ];

        return Inertia::render('admin/enquiries/index', [
            'enquiries' => $threads,
            'selectedThread' => $selectedThread,
            'selectedEnquiry' => $selectedEnquiry,
            'senderContext' => $senderContext,
            'stats' => $stats,
            'filters' => $request->only(['search', 'is_read', 'status', 'selected', 'email']),
        ]);
    }

    public function show(Enquiry $enquiry)
    {
        return redirect()->route('admin.enquiries.index', ['selected' => $enquiry->id]);
    }

    public function update(Request $request, Enquiry $enquiry)
    {
        // Toggle read status for entire conversation if requested
        if ($request->has('toggle_thread') && $request->boolean('toggle_thread')) {
            $targetRead = ! $enquiry->is_read;
            Enquiry::where('email', $enquiry->email)->update([
                'is_read' => $targetRead,
                'read_at' => $targetRead ? now() : null,
            ]);

            return redirect()->back()->with('success', 'Conversation read status updated.');
        }

        $validated = $request->validate([
            'admin_notes' => 'nullable|string',
            'replied_at' => 'nullable|date',
            'is_read' => 'nullable|boolean',
        ]);

        if (! empty($validated['admin_notes']) && empty($validated['replied_at'])) {
            $validated['replied_at'] = now();
        }

        if (! empty($validated['admin_notes']) && ! isset($validated['is_read'])) {
            $validated['is_read'] = true;
        }

        $enquiry->update($validated);

        return redirect()->back()->with('success', 'Enquiry reply updated successfully.');
    }

    public function destroy(Request $request, Enquiry $enquiry)
    {
        if ($request->boolean('delete_all')) {
            Enquiry::where('email', $enquiry->email)->delete();

            return redirect()->route('admin.enquiries.index')->with('success', 'Customer conversation deleted successfully.');
        }

        $enquiry->delete();

        return redirect()->route('admin.enquiries.index')->with('success', 'Enquiry message deleted successfully.');
    }
}
