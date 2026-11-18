import { useState, useRef, useEffect } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    MessageSquare,
    Search,
    Send,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Calendar,
    User,
    ClipboardList,
    Plus,
    X,
    Filter,
    ShieldAlert,
    CheckCheck,
    Check,
    Phone,
    CornerDownLeft,
    RotateCcw,
    ChevronRight,
    Tag,
    BookOpen,
    RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, SharedData } from '@/types';
import { cn } from '@/lib/utils';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

interface PickerUser {
    id: number;
    name: string;
    email: string;
}

interface MessageItem {
    id: number;
    thread_id: number;
    sender_id: number;
    message: string;
    attachment_path?: string | null;
    read_at?: string | null;
    created_at: string;
    sender?: {
        id: number;
        name: string;
        role: string;
    };
}

interface ThreadItem {
    id: number;
    subject: string;
    category: string;
    priority: string;
    status: string;
    picker_id: number;
    creator_id: number;
    runsheet_id?: number | null;
    booking_id?: number | null;
    last_message_at?: string | null;
    resolved_at?: string | null;
    resolved_by?: number | null;
    resolution_note?: string | null;
    created_at: string;
    unread_count?: number;
    picker?: PickerUser;
    creator?: { id: number; name: string; role: string };
    latest_message?: MessageItem;
    runsheet?: {
        id: number;
        status: string;
        scheduled_date?: string | null;
        bookings?: Array<{ id: number; reference_number: string }>;
    };
    booking?: {
        id: number;
        reference_number: string;
        status: string;
        sender?: { first_name: string; last_name: string; phone?: string };
    };
    messages?: MessageItem[];
    resolved_by_user?: { id: number; name: string };
}

interface Props {
    threads: {
        data: ThreadItem[];
        current_page: number;
        last_page: number;
        total: number;
    };
    selectedThread: ThreadItem | null;
    filters: {
        status?: string;
        category?: string;
        picker_id?: string;
        priority?: string;
        search?: string;
    };
    metrics: {
        total_open: number;
        total_urgent: number;
        total_customer_concerns: number;
        total_schedule_changes: number;
    };
    pickers: PickerUser[];
    categories: Array<{ value: string; label: string }>;
    priorities: Array<{ value: string; label: string }>;
    statuses: Array<{ value: string; label: string }>;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Operations', href: '/admin/runsheets/pickups' },
    { title: 'Communications Hub', href: '/admin/communications' },
];

export default function AdminCommunicationsIndex({
    threads,
    selectedThread,
    filters,
    metrics,
    pickers,
    categories,
    priorities,
}: Props) {
    const { auth } = usePage<SharedData>().props;
    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Reply form
    const {
        data: replyData,
        setData: setReplyData,
        post: postReply,
        processing: replyProcessing,
        reset: resetReply,
    } = useForm({
        message: '',
    });

    // New thread form
    const {
        data: newThreadData,
        setData: setNewThreadData,
        post: postNewThread,
        processing: newThreadProcessing,
        reset: resetNewThread,
        errors: newThreadErrors,
    } = useForm({
        picker_id: pickers[0]?.id ? String(pickers[0].id) : '',
        subject: '',
        category: 'general',
        priority: 'normal',
        message: '',
        runsheet_id: '',
        booking_id: '',
    });

    // Resolve form
    const {
        data: resolveData,
        setData: setResolveData,
        post: postResolve,
        processing: resolveProcessing,
        reset: resetResolve,
    } = useForm({
        resolution_note: '',
    });

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedThread?.id, selectedThread?.messages?.length]);

    useRealtimeSync({
        only: ['threads', 'selectedThread', 'metrics', 'sidebarCounts'],
        data: selectedThread?.id ? { thread_id: selectedThread.id } : undefined,
        intervalMs: 4500,
        paused: replyProcessing || newThreadProcessing || resolveProcessing || isNewModalOpen || isResolveModalOpen,
        notificationUserId: auth?.user?.id,
        notificationTypes: ['operational_message'],
    });

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.reload({
            only: ['threads', 'selectedThread', 'metrics', 'sidebarCounts'],
            ...(selectedThread?.id ? { data: { thread_id: selectedThread.id } } : {}),
            preserveUrl: true,
            onFinish: () => {
                setIsRefreshing(false);
            },
        });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/admin/communications', {
            ...filters,
            search: searchQuery || undefined,
            thread_id: undefined,
        }, { preserveState: true, preserveScroll: true });
    };

    const handleFilterChange = (key: string, value: string) => {
        router.get('/admin/communications', {
            ...filters,
            [key]: value === 'all' ? undefined : value,
            thread_id: undefined,
        }, { preserveState: true, preserveScroll: true });
    };

    const handleSelectThread = (threadId: number) => {
        router.get('/admin/communications', {
            ...filters,
            thread_id: threadId,
        }, { preserveState: true, preserveScroll: true });
    };

    const handleSendReply = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedThread || !replyData.message.trim()) return;

        postReply(`/admin/communications/${selectedThread.id}/reply`, {
            preserveScroll: true,
            onSuccess: () => {
                resetReply();
                toast.success('Reply sent to picker');
            },
            onError: () => {
                toast.error('Failed to send reply. Please try again.');
            },
        });
    };

    const handleCreateThreadSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        postNewThread('/admin/communications', {
            onSuccess: () => {
                setIsNewModalOpen(false);
                resetNewThread();
                toast.success('Communication thread opened');
            },
            onError: () => {
                toast.error('Please resolve the errors highlighted below.');
            },
        });
    };

    const handleResolveSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedThread) return;

        postResolve(`/admin/communications/${selectedThread.id}/resolve`, {
            preserveScroll: true,
            onSuccess: () => {
                setIsResolveModalOpen(false);
                resetResolve();
                toast.success('Thread marked as resolved');
            },
        });
    };

    const handleReopen = () => {
        if (!selectedThread) return;
        router.post(`/admin/communications/${selectedThread.id}/reopen`, {}, {
            preserveScroll: true,
            onSuccess: () => toast.success('Thread reopened'),
        });
    };

    const getCategoryBadgeClass = (category: string) => {
        switch (category) {
            case 'customer_concern':
                return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
            case 'schedule_change':
                return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
            case 'pickup_schedule':
                return 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
            default:
                return 'bg-neutral-100 text-neutral-800 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700';
        }
    };

    const getCategoryLabel = (cat: string) => {
        const found = categories.find((c) => c.value === cat);
        return found ? found.label : cat.replace('_', ' ');
    };

    const quickReplies = [
        'Confirmed. Schedule updated on dispatch runsheet.',
        'Please verify with customer if someone is home to sign.',
        'Standing by for your arrival at the stop.',
        'Box quantity discrepancy noted. Proceed with collected count.',
        'Understood. Drive safely and advise once complete.',
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Operations Communications Hub" />

            <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
                {/* Top Metrics Ribbon */}
                <div className="grid grid-cols-2 gap-3 border-b border-border bg-card/60 p-4 backdrop-blur sm:grid-cols-4">
                    <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-background/50 p-3 shadow-xs">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                            <MessageSquare className="size-5" />
                        </div>
                        <div>
                            <div className="text-xs font-medium text-muted-foreground">Active Threads</div>
                            <div className="text-xl font-bold tracking-tight text-foreground">{metrics.total_open}</div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-background/50 p-3 shadow-xs">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="size-5" />
                        </div>
                        <div>
                            <div className="text-xs font-medium text-muted-foreground">Urgent Issues</div>
                            <div className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                                {metrics.total_urgent}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-background/50 p-3 shadow-xs">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                            <User className="size-5" />
                        </div>
                        <div>
                            <div className="text-xs font-medium text-muted-foreground">Customer Concerns</div>
                            <div className="text-xl font-bold tracking-tight text-foreground">
                                {metrics.total_customer_concerns}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-background/50 p-3 shadow-xs">
                        <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <Calendar className="size-5" />
                        </div>
                        <div>
                            <div className="text-xs font-medium text-muted-foreground">Schedule Changes</div>
                            <div className="text-xl font-bold tracking-tight text-foreground">
                                {metrics.total_schedule_changes}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Split View */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Pane: Threads List */}
                    <aside className="flex w-full flex-col border-r border-border bg-card/40 md:w-96 lg:w-[420px]">
                        {/* Search & Actions Header */}
                        <div className="space-y-2 border-b border-border p-3">
                            <div className="flex items-center justify-between gap-2">
                                <h1 className="text-lg font-bold tracking-tight text-foreground">
                                    Dispatch & Field Messaging
                                </h1>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={handleRefresh}
                                        disabled={isRefreshing}
                                        title="Refresh messages"
                                        className="inline-flex items-center justify-center rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                                    >
                                        <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
                                    </button>
                                    <button
                                        id="btn-new-communication-thread"
                                        onClick={() => setIsNewModalOpen(true)}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-primary/90 transition-colors"
                                    >
                                        <Plus className="size-4" />
                                        <span>New Message</span>
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleSearchSubmit} className="relative">
                                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                                <input
                                    id="input-thread-search"
                                    type="text"
                                    placeholder="Search messages, picker, or booking..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-xs shadow-xs focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                />
                            </form>

                            {/* Filters Bar */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                                <select
                                    id="select-filter-status"
                                    value={filters.status || 'open'}
                                    onChange={(e) => handleFilterChange('status', e.target.value)}
                                    className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                                >
                                    <option value="open">Active / Open</option>
                                    <option value="resolved">Resolved</option>
                                    <option value="all">All Statuses</option>
                                </select>

                                <select
                                    id="select-filter-category"
                                    value={filters.category || 'all'}
                                    onChange={(e) => handleFilterChange('category', e.target.value)}
                                    className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                                >
                                    <option value="all">All Topics</option>
                                    {categories.map((cat) => (
                                        <option key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    id="select-filter-picker"
                                    value={filters.picker_id || 'all'}
                                    onChange={(e) => handleFilterChange('picker_id', e.target.value)}
                                    className="max-w-[130px] truncate rounded border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none"
                                >
                                    <option value="all">All Pickers</option>
                                    {pickers.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Thread Cards List */}
                        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                            {threads.data.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    <MessageSquare className="mx-auto size-10 opacity-30" />
                                    <p className="mt-2 text-sm font-medium">No operational messages found</p>
                                    <p className="text-xs">Adjust filters or create a new message to a picker.</p>
                                </div>
                            ) : (
                                threads.data.map((thread) => {
                                    const isSelected = selectedThread?.id === thread.id;
                                    const hasUnread = (thread.unread_count ?? 0) > 0;

                                    return (
                                        <button
                                            key={thread.id}
                                            id={`thread-card-${thread.id}`}
                                            onClick={() => handleSelectThread(thread.id)}
                                            className={cn(
                                                'w-full text-left p-3.5 transition-colors relative flex flex-col gap-1.5',
                                                isSelected
                                                    ? 'bg-brand-primary/10 border-l-4 border-l-brand-primary dark:bg-brand-primary/20'
                                                    : 'hover:bg-muted/50 border-l-4 border-l-transparent'
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-1 text-xs">
                                                <div className="flex items-center gap-1.5 font-semibold text-foreground truncate">
                                                    <span className="truncate">{thread.picker?.name ?? 'Assigned Picker'}</span>
                                                    {thread.priority === 'urgent' && (
                                                        <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                                                            URGENT
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[11px] text-muted-foreground shrink-0">
                                                    {thread.last_message_at
                                                        ? new Date(thread.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                        : ''}
                                                </span>
                                            </div>

                                            <div className="text-xs font-medium text-foreground truncate">
                                                {thread.subject}
                                            </div>

                                            <div className="text-[11px] text-muted-foreground line-clamp-2">
                                                {thread.latest_message?.message ?? 'No message content'}
                                            </div>

                                            <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className={cn(
                                                            'rounded border px-1.5 py-0.5 font-medium',
                                                            getCategoryBadgeClass(thread.category)
                                                        )}
                                                    >
                                                        {getCategoryLabel(thread.category)}
                                                    </span>

                                                    {thread.booking?.reference_number && (
                                                        <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground font-mono">
                                                            {thread.booking.reference_number}
                                                        </span>
                                                    )}
                                                </div>

                                                {hasUnread && (
                                                    <span className="size-2 rounded-full bg-brand-primary ring-2 ring-background animate-pulse" />
                                                )}

                                                {thread.status === 'resolved' && (
                                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                                                        <CheckCircle2 className="size-3" /> Resolved
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </aside>

                    {/* Right Pane: Active Thread Transcript */}
                    <main className="flex flex-1 flex-col overflow-hidden bg-background">
                        {selectedThread ? (
                            <>
                                {/* Thread Header Banner */}
                                <div className="border-b border-border bg-card/60 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-base font-bold text-foreground">
                                                    {selectedThread.subject}
                                                </h2>
                                                <span
                                                    className={cn(
                                                        'rounded border px-2 py-0.5 text-[11px] font-medium',
                                                        getCategoryBadgeClass(selectedThread.category)
                                                    )}
                                                >
                                                    {getCategoryLabel(selectedThread.category)}
                                                </span>
                                                {selectedThread.priority === 'urgent' && (
                                                    <span className="rounded bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-950 dark:text-red-300">
                                                        URGENT
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1 font-medium text-foreground">
                                                    <User className="size-3.5 text-brand-primary" />
                                                    Picker: {selectedThread.picker?.name} ({selectedThread.picker?.email})
                                                </span>

                                                {selectedThread.runsheet_id && (
                                                    <a
                                                        href={`/admin/runsheets/${selectedThread.runsheet_id}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 text-brand-primary hover:underline"
                                                    >
                                                        <ClipboardList className="size-3.5" />
                                                        Runsheet #{selectedThread.runsheet_id}
                                                    </a>
                                                )}

                                                {selectedThread.booking && (
                                                    <a
                                                        href={`/admin/bookings/${selectedThread.booking.id}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 font-mono text-brand-primary hover:underline"
                                                    >
                                                        <BookOpen className="size-3.5" />
                                                        Booking {selectedThread.booking.reference_number}
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {selectedThread.status === 'resolved' ? (
                                                <button
                                                    onClick={handleReopen}
                                                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted text-foreground transition-colors"
                                                >
                                                    <RotateCcw className="size-3.5 text-muted-foreground" />
                                                    Reopen Thread
                                                </button>
                                            ) : (
                                                <button
                                                    id="btn-resolve-thread"
                                                    onClick={() => setIsResolveModalOpen(true)}
                                                    className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors"
                                                >
                                                    <CheckCircle2 className="size-3.5" />
                                                    Mark Resolved
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Linked Operational Context Strip */}
                                    {(selectedThread.booking || selectedThread.runsheet) && (
                                        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-xs">
                                            {selectedThread.booking?.sender && (
                                                <span className="flex items-center gap-1 text-muted-foreground">
                                                    <span className="font-semibold text-foreground">Sender:</span>
                                                    {selectedThread.booking.sender.first_name}{' '}
                                                    {selectedThread.booking.sender.last_name}
                                                    {selectedThread.booking.sender.phone && (
                                                        <span className="ml-1 flex items-center gap-0.5 text-brand-primary">
                                                            <Phone className="size-3" />
                                                            {selectedThread.booking.sender.phone}
                                                        </span>
                                                    )}
                                                </span>
                                            )}

                                            {selectedThread.runsheet?.scheduled_date && (
                                                <span className="flex items-center gap-1 text-muted-foreground">
                                                    <span className="font-semibold text-foreground">Scheduled Date:</span>
                                                    {new Date(selectedThread.runsheet.scheduled_date).toLocaleDateString()}
                                                </span>
                                            )}

                                            {selectedThread.resolution_note && (
                                                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                                                    <strong>Resolution:</strong> {selectedThread.resolution_note}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Messages Conversation Stream */}
                                <div className="flex-1 space-y-4 overflow-y-auto p-4">
                                    {(selectedThread.messages ?? []).map((msg) => {
                                        const isDispatcher = msg.sender?.role !== 'picker';

                                        return (
                                            <div
                                                key={msg.id}
                                                className={cn(
                                                    'flex flex-col max-w-[80%] rounded-2xl p-4 shadow-xs text-xs space-y-1',
                                                    isDispatcher
                                                        ? 'ml-auto bg-brand-primary text-white rounded-br-none'
                                                        : 'mr-auto bg-card border border-border text-foreground rounded-bl-none'
                                                )}
                                            >
                                                <div className="flex items-center justify-between gap-3 text-[11px] font-semibold opacity-90">
                                                    <span>{msg.sender?.name ?? (isDispatcher ? 'Dispatch' : 'Picker')}</span>
                                                    <span className="text-[10px] opacity-75 font-normal">
                                                        {new Date(msg.created_at).toLocaleTimeString([], {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </span>
                                                </div>

                                                <p className="whitespace-pre-wrap leading-relaxed text-sm">
                                                    {msg.message}
                                                </p>

                                                <div className="flex items-center justify-end gap-1 text-[10px] opacity-75 pt-1">
                                                    {isDispatcher && (
                                                        msg.read_at ? (
                                                            <span className="flex items-center gap-0.5 text-white/90">
                                                                <CheckCheck className="size-3" /> Read
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-0.5 text-white/70">
                                                                <Check className="size-3" /> Sent
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Quick Templates Ribbon */}
                                <div className="border-t border-border/80 bg-muted/20 px-4 py-2">
                                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] text-muted-foreground">
                                        <span className="font-semibold shrink-0">Quick reply:</span>
                                        {quickReplies.map((reply, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setReplyData('message', reply)}
                                                className="shrink-0 rounded-full border border-border bg-background px-2.5 py-0.5 text-foreground hover:bg-muted transition-colors"
                                            >
                                                {reply}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Reply Composer */}
                                <form onSubmit={handleSendReply} className="border-t border-border bg-card p-3">
                                    <div className="flex items-end gap-2">
                                        <textarea
                                            id="textarea-admin-reply"
                                            rows={2}
                                            placeholder="Type a response to the picker (Ctrl + Enter to send)..."
                                            value={replyData.message}
                                            onChange={(e) => setReplyData('message', e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                                    e.preventDefault();
                                                    handleSendReply(e);
                                                }
                                            }}
                                            className="flex-1 rounded-lg border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary resize-none"
                                        />

                                        <button
                                            id="btn-send-admin-reply"
                                            type="submit"
                                            disabled={replyProcessing || !replyData.message.trim()}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
                                        >
                                            <Send className="size-4" />
                                            <span>Send</span>
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
                                <MessageSquare className="size-12 opacity-20" />
                                <h3 className="mt-3 text-base font-bold text-foreground">No Conversation Selected</h3>
                                <p className="max-w-sm text-xs">
                                    Choose an existing thread from the left pane or start a new message to communicate with a field picker.
                                </p>
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {/* Modal: New Communication Thread */}
            {isNewModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between border-b border-border p-4 bg-muted/40">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <MessageSquare className="size-4 text-brand-primary" />
                                New Message to Field Picker
                            </h3>
                            <button
                                onClick={() => setIsNewModalOpen(false)}
                                className="rounded p-1 text-muted-foreground hover:bg-muted"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateThreadSubmit} className="p-4 space-y-3.5 text-xs">
                            <div>
                                <label className="block font-semibold text-foreground mb-1">Select Picker</label>
                                <select
                                    id="modal-select-picker"
                                    value={newThreadData.picker_id}
                                    onChange={(e) => setNewThreadData('picker_id', e.target.value)}
                                    className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus:outline-none"
                                >
                                    {pickers.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.email})
                                        </option>
                                    ))}
                                </select>
                                {newThreadErrors.picker_id && (
                                    <p className="mt-1 text-[11px] text-red-600">{newThreadErrors.picker_id}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-semibold text-foreground mb-1">Category / Topic</label>
                                    <select
                                        id="modal-select-category"
                                        value={newThreadData.category}
                                        onChange={(e) => setNewThreadData('category', e.target.value)}
                                        className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus:outline-none"
                                    >
                                        {categories.map((c) => (
                                            <option key={c.value} value={c.value}>
                                                {c.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-semibold text-foreground mb-1">Priority</label>
                                    <select
                                        id="modal-select-priority"
                                        value={newThreadData.priority}
                                        onChange={(e) => setNewThreadData('priority', e.target.value)}
                                        className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus:outline-none"
                                    >
                                        {priorities.map((pr) => (
                                            <option key={pr.value} value={pr.value}>
                                                {pr.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold text-foreground mb-1">Subject</label>
                                <input
                                    id="modal-input-subject"
                                    type="text"
                                    placeholder="e.g., Schedule Adjustment for Western Suburbs Route"
                                    value={newThreadData.subject}
                                    onChange={(e) => setNewThreadData('subject', e.target.value)}
                                    className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus:border-brand-primary focus:outline-none"
                                    required
                                />
                                {newThreadErrors.subject && (
                                    <p className="mt-1 text-[11px] text-red-600">{newThreadErrors.subject}</p>
                                )}
                            </div>

                            <div>
                                <label className="block font-semibold text-foreground mb-1">Initial Message</label>
                                <textarea
                                    id="modal-textarea-message"
                                    rows={4}
                                    placeholder="Type dispatch instructions, customer updates, or route adjustments..."
                                    value={newThreadData.message}
                                    onChange={(e) => setNewThreadData('message', e.target.value)}
                                    className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus:border-brand-primary focus:outline-none resize-none"
                                    required
                                />
                                {newThreadErrors.message && (
                                    <p className="mt-1 text-[11px] text-red-600">{newThreadErrors.message}</p>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setIsNewModalOpen(false)}
                                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted text-foreground"
                                >
                                    Cancel
                                </button>
                                <button
                                    id="modal-btn-submit-thread"
                                    type="submit"
                                    disabled={newThreadProcessing}
                                    className="rounded-md bg-brand-primary px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-primary/90 disabled:opacity-50"
                                >
                                    {newThreadProcessing ? 'Sending...' : 'Send Message'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Resolve Thread */}
            {isResolveModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between border-b border-border p-4 bg-muted/40">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <CheckCircle2 className="size-4 text-emerald-600" />
                                Mark Communication Resolved
                            </h3>
                            <button
                                onClick={() => setIsResolveModalOpen(false)}
                                className="rounded p-1 text-muted-foreground hover:bg-muted"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        <form onSubmit={handleResolveSubmit} className="p-4 space-y-3.5 text-xs">
                            <p className="text-muted-foreground leading-relaxed">
                                Resolving this thread archives it from active dispatch lists. Both you and the picker can still view the message history, and either party can reopen it at any time with a new reply.
                            </p>

                            <div>
                                <label className="block font-semibold text-foreground mb-1">
                                    Resolution Note (Optional)
                                </label>
                                <textarea
                                    id="modal-textarea-resolution-note"
                                    rows={3}
                                    placeholder="e.g., Customer confirmed home for 3:30 PM pickup. Driver updated."
                                    value={resolveData.resolution_note}
                                    onChange={(e) => setResolveData('resolution_note', e.target.value)}
                                    className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus:border-brand-primary focus:outline-none resize-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setIsResolveModalOpen(false)}
                                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted text-foreground"
                                >
                                    Cancel
                                </button>
                                <button
                                    id="modal-btn-confirm-resolve"
                                    type="submit"
                                    disabled={resolveProcessing}
                                    className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {resolveProcessing ? 'Resolving...' : 'Confirm Resolution'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
