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
    ArrowLeft,
    Phone,
    Check,
    CheckCheck,
    Tag,
    BookOpen,
    RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem, SharedData } from '@/types';
import { cn } from '@/lib/utils';
import { useRealtimeSync } from '@/hooks/use-realtime-sync';

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

interface ActiveRunsheet {
    id: number;
    status: string;
    scheduled_date: string | null;
    bookings?: Array<{ id: number; reference_number: string }>;
}

interface Props {
    threads: {
        data: ThreadItem[];
        current_page: number;
        last_page: number;
        total: number;
    };
    selectedThread: ThreadItem | null;
    activeRunsheets: ActiveRunsheet[];
    categories: Array<{ value: string; label: string }>;
    priorities: Array<{ value: string; label: string }>;
    filters: {
        status?: string;
        category?: string;
        search?: string;
    };
    unreadTotal: number;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Picker Dashboard', href: '/picker/dashboard' },
    { title: 'Dispatch Messages', href: '/picker/messages' },
];

export default function PickerMessagesIndex({
    threads,
    selectedThread,
    activeRunsheets,
    categories,
    priorities,
    filters,
    unreadTotal,
}: Props) {
    const { auth } = usePage<SharedData>().props;
    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [isMobileViewingThread, setIsMobileViewingThread] = useState(!!selectedThread);
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
        subject: '',
        category: 'pickup_schedule',
        priority: 'normal',
        message: '',
        runsheet_id: activeRunsheets[0]?.id ? String(activeRunsheets[0].id) : '',
        booking_id: '',
    });

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedThread?.id, selectedThread?.messages?.length]);

    useRealtimeSync({
        only: ['threads', 'selectedThread', 'unreadTotal', 'sidebarCounts'],
        data: selectedThread?.id ? { thread_id: selectedThread.id } : undefined,
        intervalMs: 4500,
        paused: replyProcessing || newThreadProcessing || isNewModalOpen,
        notificationUserId: auth?.user?.id,
        notificationTypes: ['operational_message'],
    });

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.reload({
            only: ['threads', 'selectedThread', 'unreadTotal', 'sidebarCounts'],
            ...(selectedThread?.id ? { data: { thread_id: selectedThread.id } } : {}),
            preserveUrl: true,
            onFinish: () => {
                setIsRefreshing(false);
            },
        });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/picker/messages', {
            ...filters,
            search: searchQuery || undefined,
            thread_id: undefined,
        }, { preserveState: true, preserveScroll: true });
    };

    const handleFilterStatus = (status: string) => {
        router.get('/picker/messages', {
            ...filters,
            status: status === 'all' ? undefined : status,
            thread_id: undefined,
        }, { preserveState: true, preserveScroll: true });
    };

    const handleSelectThread = (threadId: number) => {
        setIsMobileViewingThread(true);
        router.get('/picker/messages', {
            ...filters,
            thread_id: threadId,
        }, { preserveState: true, preserveScroll: true });
    };

    const handleSendReply = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedThread || !replyData.message.trim()) return;

        postReply(`/picker/messages/${selectedThread.id}/reply`, {
            preserveScroll: true,
            onSuccess: () => {
                resetReply();
                toast.success('Message sent to dispatch');
            },
            onError: () => {
                toast.error('Failed to send message.');
            },
        });
    };

    const handleCreateThreadSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        postNewThread('/picker/messages', {
            onSuccess: () => {
                setIsNewModalOpen(false);
                setIsMobileViewingThread(true);
                resetNewThread();
                toast.success('Message sent to operations dispatch');
            },
            onError: () => {
                toast.error('Please check the form inputs.');
            },
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

    const quickTemplates = [
        'Delayed in heavy traffic, ETA +20 mins.',
        'Customer requested pickup pushed to afternoon.',
        'At customer location but nobody answering phone/door.',
        'Box dimensions larger than standard, extra box requested.',
        'Pickup completed successfully, proceeding to next stop.',
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Picker Dispatch Messages" />

            <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
                {/* Header Strip */}
                <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
                    <div className="flex items-center gap-2">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                            <MessageSquare className="size-5" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-foreground">Dispatch Communication</h1>
                            <p className="text-xs text-muted-foreground">
                                Real-time messaging with operations & route coordinators
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            title="Refresh messages"
                            className="inline-flex items-center justify-center rounded-lg border border-border bg-background p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={cn('size-4', isRefreshing && 'animate-spin')} />
                        </button>
                        <button
                            id="btn-picker-new-message"
                            onClick={() => setIsNewModalOpen(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-primary/90 transition-colors"
                        >
                            <Plus className="size-4" />
                            <span>Message Dispatch</span>
                        </button>
                    </div>
                </div>

                {/* Main Content Pane */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Pane: Thread Cards (hidden on mobile if viewing thread) */}
                    <aside
                        className={cn(
                            'flex w-full flex-col border-r border-border bg-card/30 md:w-88 lg:w-96',
                            isMobileViewingThread ? 'hidden md:flex' : 'flex'
                        )}
                    >
                        {/* Search & Tabs */}
                        <div className="space-y-2 border-b border-border p-3">
                            <form onSubmit={handleSearchSubmit} className="relative">
                                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search messages..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3 text-xs shadow-xs focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                                />
                            </form>

                            <div className="flex items-center gap-1 text-xs">
                                <button
                                    onClick={() => handleFilterStatus('open')}
                                    className={cn(
                                        'flex-1 rounded-md py-1 font-medium transition-colors text-center',
                                        (filters.status || 'open') === 'open'
                                            ? 'bg-brand-primary text-white font-semibold'
                                            : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                                    )}
                                >
                                    Active
                                </button>
                                <button
                                    onClick={() => handleFilterStatus('resolved')}
                                    className={cn(
                                        'flex-1 rounded-md py-1 font-medium transition-colors text-center',
                                        filters.status === 'resolved'
                                            ? 'bg-brand-primary text-white font-semibold'
                                            : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                                    )}
                                >
                                    Resolved
                                </button>
                                <button
                                    onClick={() => handleFilterStatus('all')}
                                    className={cn(
                                        'flex-1 rounded-md py-1 font-medium transition-colors text-center',
                                        filters.status === 'all'
                                            ? 'bg-brand-primary text-white font-semibold'
                                            : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                                    )}
                                >
                                    All
                                </button>
                            </div>
                        </div>

                        {/* Thread List */}
                        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                            {threads.data.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground">
                                    <MessageSquare className="mx-auto size-10 opacity-30" />
                                    <p className="mt-2 text-sm font-medium">No messages found</p>
                                    <p className="text-xs">Tap "Message Dispatch" to start a thread.</p>
                                </div>
                            ) : (
                                threads.data.map((thread) => {
                                    const isSelected = selectedThread?.id === thread.id;
                                    const hasUnread = (thread.unread_count ?? 0) > 0;

                                    return (
                                        <button
                                            key={thread.id}
                                            id={`picker-thread-${thread.id}`}
                                            onClick={() => handleSelectThread(thread.id)}
                                            className={cn(
                                                'w-full text-left p-3.5 transition-colors relative flex flex-col gap-1.5',
                                                isSelected
                                                    ? 'bg-brand-primary/10 border-l-4 border-l-brand-primary dark:bg-brand-primary/20'
                                                    : 'hover:bg-muted/50 border-l-4 border-l-transparent'
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-1 text-xs">
                                                <span className="font-semibold text-foreground truncate">
                                                    {thread.subject}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground shrink-0">
                                                    {thread.last_message_at
                                                        ? new Date(thread.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                        : ''}
                                                </span>
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

                                                    {thread.priority === 'urgent' && (
                                                        <span className="rounded bg-red-100 text-red-700 px-1 py-0.5 font-bold">
                                                            URGENT
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

                    {/* Right Pane: Active Thread Chat (visible on mobile if thread selected) */}
                    <main
                        className={cn(
                            'flex flex-1 flex-col overflow-hidden bg-background',
                            !isMobileViewingThread ? 'hidden md:flex' : 'flex'
                        )}
                    >
                        {selectedThread ? (
                            <>
                                {/* Mobile Back Button + Thread Title */}
                                <div className="border-b border-border bg-card/60 p-3 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setIsMobileViewingThread(false)}
                                            className="md:hidden rounded p-1 text-muted-foreground hover:bg-muted"
                                        >
                                            <ArrowLeft className="size-5" />
                                        </button>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-sm font-bold text-foreground">
                                                    {selectedThread.subject}
                                                </h2>
                                                <span
                                                    className={cn(
                                                        'rounded border px-1.5 py-0.2 text-[10px] font-medium',
                                                        getCategoryBadgeClass(selectedThread.category)
                                                    )}
                                                >
                                                    {getCategoryLabel(selectedThread.category)}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Thread #{selectedThread.id} • {selectedThread.status === 'resolved' ? 'Resolved' : 'Active conversation'}
                                            </p>
                                        </div>
                                    </div>

                                    {selectedThread.runsheet_id && (
                                        <a
                                            href={`/picker/runsheet/${selectedThread.runsheet_id}`}
                                            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted/80"
                                        >
                                            <ClipboardList className="size-3 text-brand-primary" />
                                            <span>Runsheet #{selectedThread.runsheet_id}</span>
                                        </a>
                                    )}
                                </div>

                                {/* Context Bar */}
                                {selectedThread.booking && (
                                    <div className="bg-muted/40 border-b border-border/80 px-3 py-1.5 text-xs flex items-center justify-between text-muted-foreground">
                                        <span>
                                            Stop Booking: <strong className="font-mono text-foreground">{selectedThread.booking.reference_number}</strong>
                                        </span>
                                        {selectedThread.booking.sender?.phone && (
                                            <a
                                                href={`tel:${selectedThread.booking.sender.phone}`}
                                                className="inline-flex items-center gap-1 text-brand-primary font-medium"
                                            >
                                                <Phone className="size-3" /> Call Sender
                                            </a>
                                        )}
                                    </div>
                                )}

                                {/* Chat Stream */}
                                <div className="flex-1 space-y-3.5 overflow-y-auto p-4">
                                    {(selectedThread.messages ?? []).map((msg) => {
                                        const isMine = msg.sender?.role === 'picker';

                                        return (
                                            <div
                                                key={msg.id}
                                                className={cn(
                                                    'flex flex-col max-w-[85%] rounded-2xl p-3.5 shadow-xs text-xs space-y-1',
                                                    isMine
                                                        ? 'ml-auto bg-brand-primary text-white rounded-br-none'
                                                        : 'mr-auto bg-card border border-border text-foreground rounded-bl-none'
                                                )}
                                            >
                                                <div className="flex items-center justify-between gap-3 text-[11px] font-semibold opacity-90">
                                                    <span>{isMine ? 'You' : 'Dispatch Team'}</span>
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

                                                {isMine && (
                                                    <div className="flex items-center justify-end text-[10px] opacity-75 pt-0.5">
                                                        {msg.read_at ? (
                                                            <span className="flex items-center gap-0.5 text-white/90">
                                                                <CheckCheck className="size-3" /> Read by dispatch
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-0.5 text-white/70">
                                                                <Check className="size-3" /> Delivered
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Quick Field Templates */}
                                <div className="border-t border-border/80 bg-muted/20 px-3 py-1.5 overflow-x-auto">
                                    <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px]">
                                        <span className="font-semibold text-muted-foreground shrink-0">Quick tap:</span>
                                        {quickTemplates.map((template, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setReplyData('message', template)}
                                                className="shrink-0 rounded-full border border-border bg-background px-2.5 py-0.5 text-foreground hover:bg-muted transition-colors"
                                            >
                                                {template}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Reply Input Box */}
                                <form onSubmit={handleSendReply} className="border-t border-border bg-card p-3">
                                    <div className="flex items-end gap-2">
                                        <textarea
                                            id="textarea-picker-reply"
                                            rows={2}
                                            placeholder="Type your message to dispatch..."
                                            value={replyData.message}
                                            onChange={(e) => setReplyData('message', e.target.value)}
                                            className="flex-1 rounded-lg border border-input bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary resize-none"
                                        />

                                        <button
                                            id="btn-send-picker-reply"
                                            type="submit"
                                            disabled={replyProcessing || !replyData.message.trim()}
                                            className="inline-flex items-center gap-1 rounded-lg bg-brand-primary px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-primary/90 disabled:opacity-50 transition-colors"
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
                                <h3 className="mt-3 text-base font-bold text-foreground">Select a Message</h3>
                                <p className="max-w-xs text-xs">
                                    Tap an existing conversation or start a new message to inform dispatch about route issues or customer concerns.
                                </p>
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {/* Modal: New Message to Dispatch */}
            {isNewModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between border-b border-border p-4 bg-muted/40">
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <MessageSquare className="size-4 text-brand-primary" />
                                Send Message to Dispatch
                            </h3>
                            <button
                                onClick={() => setIsNewModalOpen(false)}
                                className="rounded p-1 text-muted-foreground hover:bg-muted"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateThreadSubmit} className="p-4 space-y-3.5 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-semibold text-foreground mb-1">Topic</label>
                                    <select
                                        id="modal-picker-category"
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
                                        id="modal-picker-priority"
                                        value={newThreadData.priority}
                                        onChange={(e) => setNewThreadData('priority', e.target.value)}
                                        className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus:outline-none"
                                    >
                                        {priorities.map((p) => (
                                            <option key={p.value} value={p.value}>
                                                {p.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {activeRunsheets.length > 0 && (
                                <div>
                                    <label className="block font-semibold text-foreground mb-1">
                                        Link to Runsheet (Optional)
                                    </label>
                                    <select
                                        id="modal-picker-runsheet"
                                        value={newThreadData.runsheet_id}
                                        onChange={(e) => setNewThreadData('runsheet_id', e.target.value)}
                                        className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground focus:outline-none"
                                    >
                                        <option value="">No specific runsheet</option>
                                        {activeRunsheets.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                Runsheet #{r.id} ({r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString() : 'Active'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block font-semibold text-foreground mb-1">Subject</label>
                                <input
                                    id="modal-picker-subject"
                                    type="text"
                                    placeholder="e.g., Delay at Stop 4 or Customer Reschedule"
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
                                <label className="block font-semibold text-foreground mb-1">Your Message</label>
                                <textarea
                                    id="modal-picker-message"
                                    rows={4}
                                    placeholder="Describe the schedule update, customer concern, or operational issue..."
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
                                    id="modal-btn-picker-submit"
                                    type="submit"
                                    disabled={newThreadProcessing}
                                    className="rounded-md bg-brand-primary px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-primary/90 disabled:opacity-50"
                                >
                                    {newThreadProcessing ? 'Sending...' : 'Send to Dispatch'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
