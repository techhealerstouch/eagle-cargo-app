<?php

namespace App\Http\Controllers\Picker;

use App\Enums\OperationalMessageCategory;
use App\Enums\OperationalThreadPriority;
use App\Enums\OperationalThreadStatus;
use App\Enums\RunsheetStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Picker\StoreOperationalThreadRequest;
use App\Http\Requests\ResolveOperationalThreadRequest;
use App\Http\Requests\StoreOperationalMessageReplyRequest;
use App\Models\OperationalThread;
use App\Models\Runsheet;
use App\Services\OperationalCommunicationService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class OperationalCommunicationController extends Controller
{
    public function __construct(
        protected OperationalCommunicationService $communicationService
    ) {}

    public function index(Request $request): Response
    {
        $user = $request->user();
        $statusFilter = $request->query('status', 'open');
        $categoryFilter = $request->query('category');
        $search = $request->query('search');

        $query = OperationalThread::query()
            ->where('picker_id', $user->id)
            ->with([
                'creator:id,name,role',
                'latestMessage.sender:id,name,role',
                'runsheet:id,status,scheduled_date',
                'booking:id,reference_number,status',
            ])
            ->withCount([
                'messages as unread_count' => function ($q) use ($user) {
                    $q->where('sender_id', '!=', $user->id)
                        ->whereNull('read_at');
                },
            ]);

        if ($statusFilter === 'open') {
            $query->where('status', '!=', OperationalThreadStatus::Resolved->value);
        } elseif ($statusFilter === 'resolved') {
            $query->where('status', OperationalThreadStatus::Resolved->value);
        }

        if ($categoryFilter) {
            $query->where('category', $categoryFilter);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('subject', 'like', "%{$search}%")
                    ->orWhereHas('booking', fn ($sq) => $sq->where('reference_number', 'like', "%{$search}%"))
                    ->orWhereHas('messages', fn ($sq) => $sq->where('message', 'like', "%{$search}%"));
            });
        }

        $threads = $query->orderByDesc('last_message_at')->paginate(20)->withQueryString();

        $selectedThreadId = $request->query('thread_id');
        $selectedThread = null;

        if ($selectedThreadId) {
            $selectedThread = OperationalThread::query()
                ->where('picker_id', $user->id)
                ->with([
                    'creator:id,name,role',
                    'resolvedBy:id,name',
                    'runsheet.bookings:id,reference_number',
                    'booking.sender:id,first_name,last_name,phone',
                    'messages.sender:id,name,role',
                ])
                ->find($selectedThreadId);
        } elseif ($threads->isNotEmpty()) {
            $firstId = $threads->first()->id;
            $selectedThread = OperationalThread::query()
                ->where('picker_id', $user->id)
                ->with([
                    'creator:id,name,role',
                    'resolvedBy:id,name',
                    'runsheet.bookings:id,reference_number',
                    'booking.sender:id,first_name,last_name,phone',
                    'messages.sender:id,name,role',
                ])
                ->find($firstId);
        }

        if ($selectedThread) {
            $this->communicationService->markAsRead($selectedThread, $user);
            $selectedThread->unread_count = 0;
            $threads->getCollection()->transform(function ($thread) use ($selectedThread) {
                if ($thread->id === $selectedThread->id) {
                    $thread->unread_count = 0;
                }

                return $thread;
            });
        }

        $activeRunsheets = Runsheet::query()
            ->where('picker_id', $user->id)
            ->whereIn('status', RunsheetStatus::activeValues())
            ->with('bookings:id,reference_number')
            ->orderByDesc('scheduled_date')
            ->take(10)
            ->get(['id', 'status', 'scheduled_date']);

        $categories = collect(OperationalMessageCategory::cases())->map(fn ($case) => [
            'value' => $case->value,
            'label' => $case->label(),
        ]);

        $priorities = collect(OperationalThreadPriority::cases())->map(fn ($case) => [
            'value' => $case->value,
            'label' => $case->label(),
        ]);

        return Inertia::render('picker/messages/index', [
            'threads' => $threads,
            'selectedThread' => $selectedThread,
            'activeRunsheets' => $activeRunsheets,
            'categories' => $categories,
            'priorities' => $priorities,
            'filters' => [
                'status' => $statusFilter,
                'category' => $categoryFilter,
                'search' => $search,
            ],
            'unreadTotal' => OperationalThread::query()
                ->where('picker_id', $user->id)
                ->whereHas('messages', fn ($q) => $q->where('sender_id', '!=', $user->id)->whereNull('read_at'))
                ->count(),
        ]);
    }

    public function store(StoreOperationalThreadRequest $request): RedirectResponse
    {
        $thread = $this->communicationService->createThread($request->user(), $request->validated());

        return redirect()->route('picker.messages.index', ['thread_id' => $thread->id])
            ->with('success', 'Message dispatched to operations team.');
    }

    public function reply(StoreOperationalMessageReplyRequest $request, OperationalThread $thread): RedirectResponse
    {
        if ((int) $thread->picker_id !== (int) $request->user()->id) {
            abort(403, 'Unauthorized thread access.');
        }

        $this->communicationService->reply($thread, $request->user(), $request->validated('message'));

        return redirect()->route('picker.messages.index', ['thread_id' => $thread->id])
            ->with('success', 'Reply sent to dispatch.');
    }

    public function resolve(ResolveOperationalThreadRequest $request, OperationalThread $thread): RedirectResponse
    {
        if ((int) $thread->picker_id !== (int) $request->user()->id) {
            abort(403, 'Unauthorized thread access.');
        }

        $this->communicationService->resolveThread(
            $thread,
            $request->user(),
            $request->validated('resolution_note')
        );

        return redirect()->route('picker.messages.index', ['thread_id' => $thread->id])
            ->with('success', 'Thread marked as resolved.');
    }
}
