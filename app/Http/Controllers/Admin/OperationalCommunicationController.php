<?php

namespace App\Http\Controllers\Admin;

use App\Enums\OperationalMessageCategory;
use App\Enums\OperationalThreadPriority;
use App\Enums\OperationalThreadStatus;
use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreOperationalThreadRequest;
use App\Http\Requests\ResolveOperationalThreadRequest;
use App\Http\Requests\StoreOperationalMessageReplyRequest;
use App\Models\OperationalThread;
use App\Models\User;
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
        $statusFilter = $request->query('status', 'open');
        $categoryFilter = $request->query('category');
        $pickerFilter = $request->query('picker_id');
        $priorityFilter = $request->query('priority');
        $search = $request->query('search');

        $query = OperationalThread::query()
            ->with([
                'picker:id,name,email',
                'creator:id,name,role',
                'latestMessage.sender:id,name,role',
                'runsheet:id,status,scheduled_date',
                'booking:id,reference_number,status',
            ])
            ->withCount([
                'messages as unread_count' => function ($q) use ($request) {
                    $q->where('sender_id', '!=', $request->user()->id)
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

        if ($pickerFilter) {
            $query->where('picker_id', (int) $pickerFilter);
        }

        if ($priorityFilter) {
            $query->where('priority', $priorityFilter);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('subject', 'like', "%{$search}%")
                    ->orWhereHas('picker', fn ($sq) => $sq->where('name', 'like', "%{$search}%"))
                    ->orWhereHas('booking', fn ($sq) => $sq->where('reference_number', 'like', "%{$search}%"))
                    ->orWhereHas('messages', fn ($sq) => $sq->where('message', 'like', "%{$search}%"));
            });
        }

        $threads = $query->orderByDesc('last_message_at')->paginate(25)->withQueryString();

        $selectedThreadId = $request->query('thread_id');
        $selectedThread = null;

        if ($selectedThreadId) {
            $selectedThread = OperationalThread::query()
                ->with([
                    'picker:id,name,email',
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
                ->with([
                    'picker:id,name,email',
                    'creator:id,name,role',
                    'resolvedBy:id,name',
                    'runsheet.bookings:id,reference_number',
                    'booking.sender:id,first_name,last_name,phone',
                    'messages.sender:id,name,role',
                ])
                ->find($firstId);
        }

        if ($selectedThread) {
            $this->communicationService->markAsRead($selectedThread, $request->user());
            $selectedThread->unread_count = 0;
            $threads->getCollection()->transform(function ($thread) use ($selectedThread) {
                if ($thread->id === $selectedThread->id) {
                    $thread->unread_count = 0;
                }

                return $thread;
            });
        }

        $metrics = [
            'total_open' => OperationalThread::query()->where('status', '!=', OperationalThreadStatus::Resolved->value)->count(),
            'total_urgent' => OperationalThread::query()->where('status', '!=', OperationalThreadStatus::Resolved->value)->where('priority', OperationalThreadPriority::Urgent->value)->count(),
            'total_customer_concerns' => OperationalThread::query()->where('status', '!=', OperationalThreadStatus::Resolved->value)->where('category', OperationalMessageCategory::CustomerConcern->value)->count(),
            'total_schedule_changes' => OperationalThread::query()->where('status', '!=', OperationalThreadStatus::Resolved->value)->where('category', OperationalMessageCategory::ScheduleChange->value)->count(),
        ];

        $pickers = User::query()
            ->where('role', Role::Picker->value)
            ->whereNull('deleted_at')
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        $categories = collect(OperationalMessageCategory::cases())->map(fn ($case) => [
            'value' => $case->value,
            'label' => $case->label(),
        ]);

        $priorities = collect(OperationalThreadPriority::cases())->map(fn ($case) => [
            'value' => $case->value,
            'label' => $case->label(),
        ]);

        $statuses = collect(OperationalThreadStatus::cases())->map(fn ($case) => [
            'value' => $case->value,
            'label' => $case->label(),
        ]);

        return Inertia::render('admin/communications/index', [
            'threads' => $threads,
            'selectedThread' => $selectedThread,
            'filters' => [
                'status' => $statusFilter,
                'category' => $categoryFilter,
                'picker_id' => $pickerFilter,
                'priority' => $priorityFilter,
                'search' => $search,
            ],
            'metrics' => $metrics,
            'pickers' => $pickers,
            'categories' => $categories,
            'priorities' => $priorities,
            'statuses' => $statuses,
        ]);
    }

    public function store(StoreOperationalThreadRequest $request): RedirectResponse
    {
        $thread = $this->communicationService->createThread($request->user(), $request->validated());

        return redirect()->route('admin.communications.index', ['thread_id' => $thread->id])
            ->with('success', "Communication thread opened with {$thread->picker->name}.");
    }

    public function reply(StoreOperationalMessageReplyRequest $request, OperationalThread $thread): RedirectResponse
    {
        $this->communicationService->reply($thread, $request->user(), $request->validated('message'));

        return redirect()->route('admin.communications.index', ['thread_id' => $thread->id])
            ->with('success', 'Reply dispatched to field picker.');
    }

    public function resolve(ResolveOperationalThreadRequest $request, OperationalThread $thread): RedirectResponse
    {
        $this->communicationService->resolveThread(
            $thread,
            $request->user(),
            $request->validated('resolution_note')
        );

        return redirect()->route('admin.communications.index', ['thread_id' => $thread->id])
            ->with('success', 'Operational thread marked as resolved.');
    }

    public function reopen(OperationalThread $thread): RedirectResponse
    {
        $this->communicationService->reopenThread($thread, request()->user());

        return redirect()->route('admin.communications.index', ['thread_id' => $thread->id])
            ->with('success', 'Thread reopened.');
    }
}
