import { useState, useRef, useEffect } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import { 
    MessageSquare, 
    Search, 
    CheckCircle2, 
    Clock, 
    Mail, 
    Phone, 
    Send, 
    Trash2, 
    Check, 
    CheckCheck, 
    Sparkles, 
    Package, 
    Calendar, 
    RefreshCw, 
    AlertCircle, 
    ArrowRight, 
    ShieldCheck, 
    User, 
    CornerDownLeft, 
    Filter,
    ChevronRight,
    MapPin,
    Eye,
    EyeOff,
    Maximize2,
    Minimize2
} from 'lucide-react';
import { toast } from 'sonner';
import ConfirmModal from '@/components/common/confirm-modal';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { cn } from '@/lib/utils';

interface EnquiryMessage {
    id: number;
    name: string;
    email: string;
    mobile: string | null;
    message: string;
    is_read: boolean;
    read_at: string | null;
    replied_at: string | null;
    admin_notes: string | null;
    created_at: string;
}

interface ConversationThread {
    id: number;
    email: string;
    name: string;
    mobile: string | null;
    message?: string;
    latest_message: string;
    latest_created_at: string;
    created_at: string;
    is_read: boolean;
    unread_count: number;
    status: 'waiting' | 'replied';
    messages_count: number;
    messages: EnquiryMessage[];
}

interface ActiveBooking {
    id: number;
    reference_number: string;
    status: string;
    destination?: string;
    created_at: string;
}

interface SenderContext {
    id: number;
    name: string;
    email: string;
    mobile: string | null;
    city: string;
    bookings: ActiveBooking[];
}

interface Stats {
    total: number;
    unread: number;
    waiting: number;
    replied: number;
}

interface Props {
    enquiries: {
        data: ConversationThread[];
        links: any[];
        current_page: number;
        last_page: number;
    };
    selectedThread?: ConversationThread | null;
    selectedEnquiry: EnquiryMessage | null;
    senderContext: SenderContext | null;
    stats: Stats;
    filters: {
        search?: string;
        is_read?: string;
        status?: string;
        selected?: number;
        email?: string;
    };
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Support Inbox', href: '/admin/enquiries' },
];

export default function AdminEnquiriesIndex({
    enquiries,
    selectedThread,
    selectedEnquiry,
    senderContext,
    stats,
    filters,
}: Props) {
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [statusFilter, setStatusFilter] = useState(filters.status || 'all');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [enquiryToDelete, setEnquiryToDelete] = useState<EnquiryMessage | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Active thread resolution
    const activeThread = selectedThread || (enquiries.data.length > 0 ? enquiries.data[0] : null);
    const activeMessages = activeThread?.messages || (selectedEnquiry ? [selectedEnquiry] : []);
    const isAwaitingReply = activeThread?.status === 'waiting' || (!selectedEnquiry?.admin_notes && !!selectedEnquiry);

    // Fullscreen toggling helper
    const toggleFullscreen = () => {
        if (!isFullscreen) {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
            }
            setIsFullscreen(true);
        } else {
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFullscreen]);

    // Reply form handling
    const { data, setData, patch, processing, reset } = useForm({
        admin_notes: '',
        is_read: true,
    });

    // Update reply textarea when active target enquiry changes
    useEffect(() => {
        setData('admin_notes', '');
    }, [selectedThread?.id, selectedEnquiry?.id]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSelectThread = (thread: ConversationThread) => {
        router.get(
            '/admin/enquiries',
            {
                ...filters,
                selected: thread.id,
                email: thread.email,
                search: searchTerm || undefined,
                status: statusFilter !== 'all' ? statusFilter : undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            '/admin/enquiries',
            {
                ...filters,
                search: searchTerm || undefined,
                status: statusFilter !== 'all' ? statusFilter : undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    const handleFilterChange = (newStatus: string) => {
        setStatusFilter(newStatus);
        router.get(
            '/admin/enquiries',
            {
                ...filters,
                status: newStatus !== 'all' ? newStatus : undefined,
                search: searchTerm || undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.reload({
            onFinish: () => {
                setIsRefreshing(false);
                toast.success('Support inbox refreshed.');
            },
        });
    };

    const handleSendReply = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEnquiry || !data.admin_notes.trim()) return;

        patch(`/admin/enquiries/${selectedEnquiry.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setData('admin_notes', '');
                reset('admin_notes');
                toast.success('Reply saved and sent to customer.');
                setTimeout(scrollToBottom, 100);
            }
        });
    };

    const handleToggleRead = () => {
        if (!selectedEnquiry) return;
        router.patch(`/admin/enquiries/${selectedEnquiry.id}`, {
            toggle_thread: true,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Conversation read status updated.');
            },
        });
    };

    const handleDeleteClick = () => {
        if (!selectedEnquiry) return;
        setEnquiryToDelete(selectedEnquiry);
        setDeleteModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (!enquiryToDelete) return;
        router.delete(`/admin/enquiries/${enquiryToDelete.id}`, {
            data: { delete_all: true },
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Conversation deleted.');
                setDeleteModalOpen(false);
                setEnquiryToDelete(null);
            },
        });
    };

    // Quick canned reply templates (Tailored for Eagle Cargo)
    const cannedTemplates = [
        {
            label: '📍 Shipment Check',
            text: `Hello ${activeThread?.name || 'there'}! We have verified your shipment tracking in our Eagle Cargo logistics hub. Everything is proceeding smoothly on schedule. Please let us know if you need additional details!`,
        },
        {
            label: '🚢 Next Voyage',
            text: `Good day ${activeThread?.name || ''}! Our upcoming sea cargo container batch cut-off is coming up shortly. Sea freight sailing to Manila takes approximately 4-6 weeks from vessel departure.`,
        },
        {
            label: '🏠 Address Update',
            text: `Hi ${activeThread?.name || ''}! We have noted your Philippine destination address update and updated our dispatch manifest accordingly. Safe delivery is our top priority!`,
        },
        {
            label: '📞 Call Request',
            text: `Hello ${activeThread?.name || ''}! A representative from Eagle Cargo will call your mobile number shortly to assist you directly with this request. Thank you!`,
        },
    ];

    const applyCannedTemplate = (templateText: string) => {
        setData('admin_notes', templateText);
        textareaRef.current?.focus();
    };

    const formatRelativeTime = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch {
            return '';
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Support Inbox | Admin | Eagle Cargo" />

            <div className={cn(
                "flex flex-col transition-all duration-300 min-h-0",
                isFullscreen
                    ? "fixed inset-0 z-50 bg-zinc-50 dark:bg-zinc-950 p-2 sm:p-3 w-screen h-screen overflow-hidden space-y-2.5"
                    : "w-full h-[calc(100vh-4.25rem)] min-h-[660px] p-2 sm:p-3 md:p-4 space-y-3"
            )}>
                {/* Header with Stats Counter Pills & Fullscreen Toggle */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-3 shrink-0">
                    <div>
                        <div className="flex items-center gap-2.5 mb-1">
                            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                                Support Helpdesk Inbox
                            </h1>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-full">
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Live Sync
                            </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Manage customer conversation threads, reply directly to their portal, and review active bookings.
                        </p>
                    </div>

                    {/* Stats pills & Fullscreen Action */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/70 dark:border-zinc-700/70 text-xs font-semibold text-zinc-700 dark:text-zinc-300 shadow-2xs">
                            <MessageSquare className="size-3.5 text-zinc-500" />
                            <span>{stats.total} {stats.total === 1 ? 'Customer' : 'Customers'}</span>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900/50 text-xs font-semibold text-blue-700 dark:text-blue-300 shadow-2xs">
                            <span className="size-2 rounded-full bg-blue-500 animate-pulse"></span>
                            <span>{stats.unread} Unread</span>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/50 text-xs font-semibold text-amber-700 dark:text-amber-300 shadow-2xs">
                            <Clock className="size-3.5 text-amber-600" />
                            <span>{stats.waiting} Awaiting Reply</span>
                        </div>

                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/50 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs">
                            <CheckCheck className="size-3.5 text-emerald-600" />
                            <span>{stats.replied} Replied</span>
                        </div>

                        <button
                            type="button"
                            onClick={toggleFullscreen}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-750 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors shadow-2xs cursor-pointer ml-1"
                            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Toggle Fullscreen"}
                        >
                            {isFullscreen ? (
                                <>
                                    <Minimize2 className="size-3.5 text-brand-rust" />
                                    <span>Exit Fullscreen</span>
                                </>
                            ) : (
                                <>
                                    <Maximize2 className="size-3.5 text-brand-rust" />
                                    <span>Fullscreen</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Main 2-Pane Inbox Frame */}
                <div className="flex flex-col lg:flex-row flex-1 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden min-h-0">
                    
                    {/* LEFT PANE: Non-redundant Customer Threads List & Filters */}
                    <div className="w-full lg:w-[380px] xl:w-[420px] border-b lg:border-b-0 lg:border-r border-zinc-200/80 dark:border-zinc-800 flex flex-col bg-zinc-50/60 dark:bg-zinc-950/40 shrink-0">
                        {/* Search & Actions Bar */}
                        <div className="p-3 sm:p-4 border-b border-zinc-200/70 dark:border-zinc-800 space-y-3 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xs">
                            <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Search by name, email, or message..."
                                        className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    disabled={isRefreshing}
                                    className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors shadow-2xs"
                                    title="Refresh inbox"
                                >
                                    <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin text-brand-rust")} />
                                </button>
                            </form>

                            {/* Status Filter Tabs */}
                            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'waiting', label: 'Needs Reply' },
                                    { id: 'replied', label: 'Replied' },
                                    { id: 'unread', label: 'Unread' },
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => handleFilterChange(tab.id)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 shadow-2xs",
                                            statusFilter === tab.id
                                                ? "bg-brand-rust text-white shadow-xs"
                                                : "bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-750 border border-zinc-200/70 dark:border-zinc-700/70"
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Scrollable Conversation Threads List (1 card per customer) */}
                        <div className="flex-1 overflow-y-auto divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                            {enquiries.data.length > 0 ? (
                                enquiries.data.map((thread) => {
                                    const isSelected = activeThread?.email === thread.email;
                                    const isReplied = thread.status === 'replied';

                                    return (
                                        <button
                                            key={thread.email || thread.id}
                                            type="button"
                                            onClick={() => handleSelectThread(thread)}
                                            className={cn(
                                                "w-full text-left p-3.5 sm:p-4 transition-all flex items-start gap-3 relative group",
                                                isSelected
                                                    ? "bg-white dark:bg-zinc-800/90 shadow-2xs border-l-4 border-l-brand-rust"
                                                    : "hover:bg-zinc-100/70 dark:hover:bg-zinc-850/60"
                                            )}
                                        >
                                            {/* Avatar */}
                                            <div className="relative size-10 rounded-xl bg-gradient-to-br from-brand-rust/20 to-brand-rust/10 border border-brand-rust/30 flex items-center justify-center text-brand-rust font-bold text-sm shrink-0">
                                                {thread.name.charAt(0).toUpperCase()}
                                                {!thread.is_read && (
                                                    <span className="absolute -top-1 -right-1 size-3 bg-blue-500 rounded-full border-2 border-white dark:border-zinc-900 animate-pulse" />
                                                )}
                                            </div>

                                            {/* Thread Snippet */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-1 mb-1">
                                                    <h3 className={cn(
                                                        "text-xs truncate tracking-tight",
                                                        !thread.is_read ? "font-bold text-zinc-900 dark:text-white" : "font-semibold text-zinc-800 dark:text-zinc-200"
                                                    )}>
                                                        {thread.name}
                                                    </h3>
                                                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium shrink-0">
                                                        {formatRelativeTime(thread.latest_created_at || thread.created_at)}
                                                    </span>
                                                </div>

                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-2">
                                                    {thread.latest_message || thread.message}
                                                </p>

                                                {/* Status & Thread Counter Badges */}
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {isReplied ? (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-900/40">
                                                            <CheckCheck className="size-3" /> Replied
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/40">
                                                            <Clock className="size-3" /> Awaiting Reply
                                                        </span>
                                                    )}

                                                    {thread.messages_count > 1 && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                                                            <MessageSquare className="size-2.5" /> {thread.messages_count} msgs
                                                        </span>
                                                    )}

                                                    {thread.mobile && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
                                                            <Phone className="size-2.5" />
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center space-y-2">
                                    <div className="size-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mx-auto">
                                        <MessageSquare className="size-6" />
                                    </div>
                                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">No conversations found</p>
                                    <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
                                        Try adjusting your search terms or filter state.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHT PANE: Complete Customer Conversation Stream & Reply Console */}
                    <div className="flex-1 flex flex-col bg-white dark:bg-zinc-900 overflow-hidden min-h-0">
                        {activeThread ? (
                            <>
                                {/* Conversation Top Header */}
                                <div className="p-4 sm:px-6 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xs flex items-center justify-between gap-4 shrink-0">
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className="size-11 rounded-2xl bg-gradient-to-br from-brand-rust to-[#c25430] text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                                            {activeThread.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-base font-bold text-zinc-900 dark:text-white truncate">
                                                    {activeThread.name}
                                                </h2>
                                                {senderContext && (
                                                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold bg-brand-warm/60 dark:bg-zinc-800 text-brand-rust border border-brand-sand/50 dark:border-zinc-700 px-2 py-0.5 rounded-full">
                                                        <ShieldCheck className="size-3" />
                                                        Registered Sender
                                                    </span>
                                                )}
                                                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                                    {activeMessages.length} {activeMessages.length === 1 ? 'message' : 'messages'} in thread
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                                                <a
                                                    href={`mailto:${activeThread.email}`}
                                                    className="inline-flex items-center gap-1 hover:text-brand-rust transition-colors"
                                                >
                                                    <Mail className="size-3 text-brand-rust" />
                                                    <span className="truncate">{activeThread.email}</span>
                                                </a>
                                                {activeThread.mobile && (
                                                    <a
                                                        href={`tel:${activeThread.mobile}`}
                                                        className="inline-flex items-center gap-1 hover:text-brand-rust transition-colors"
                                                    >
                                                        <Phone className="size-3 text-brand-rust" />
                                                        <span>{activeThread.mobile}</span>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={handleToggleRead}
                                            className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 transition-colors shadow-2xs inline-flex items-center gap-1.5"
                                            title={activeThread.is_read ? 'Mark Thread as Unread' : 'Mark Thread as Read'}
                                        >
                                            {activeThread.is_read ? (
                                                <>
                                                    <EyeOff className="size-3.5 text-zinc-500" />
                                                    <span className="hidden md:inline">Mark Unread</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Eye className="size-3.5 text-blue-500" />
                                                    <span className="hidden md:inline">Mark Read</span>
                                                </>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleDeleteClick}
                                            className="p-2 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200/60 dark:border-rose-900/40 transition-colors shadow-2xs"
                                            title="Delete conversation thread"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Verified Sender Context Banner (if registered sender with bookings) */}
                                {senderContext && (
                                    <div className="px-4 sm:px-6 py-2.5 bg-brand-warm/20 dark:bg-zinc-800/40 border-b border-brand-sand/40 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs shrink-0">
                                        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
                                            <span className="font-semibold text-zinc-700 dark:text-zinc-300 shrink-0 flex items-center gap-1">
                                                <Package className="size-3.5 text-brand-rust" /> Customer Shipments:
                                            </span>
                                            {senderContext.bookings.length > 0 ? (
                                                senderContext.bookings.map((b) => (
                                                    <span
                                                        key={b.id}
                                                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 font-mono text-[11px] shrink-0"
                                                    >
                                                        <span className="font-bold text-brand-rust">#{b.reference_number}</span>
                                                        <span className="text-[10px] text-zinc-400 uppercase">({b.status})</span>
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-zinc-400 italic">No previous bookings</span>
                                            )}
                                        </div>

                                        {senderContext.city && (
                                            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0 hidden sm:inline-flex items-center gap-1">
                                                <MapPin className="size-3 text-zinc-400" />
                                                {senderContext.city}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Continuous Chronological Conversation Stream */}
                                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-zinc-50/40 dark:bg-zinc-950/30">
                                    {activeMessages.map((msg, index) => (
                                        <div key={msg.id} className="space-y-4">
                                            {/* Date / Timestamp Separator */}
                                            <div className="flex items-center justify-center my-1">
                                                <span className="px-3 py-0.5 bg-zinc-200/70 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[10px] font-semibold rounded-full shadow-2xs border border-zinc-200/50 dark:border-zinc-700/50">
                                                    {new Date(msg.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                                                </span>
                                            </div>

                                            {/* Customer Inbound Message Bubble (Left) */}
                                            <div className="flex items-start gap-3 max-w-[90%] sm:max-w-[80%]">
                                                <div className="size-8 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 font-bold text-xs shrink-0 mt-0.5 shadow-2xs">
                                                    {msg.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col items-start min-w-0">
                                                    <div className="flex items-center gap-2 mb-1 px-1">
                                                        <span className="text-xs font-bold text-zinc-900 dark:text-white">
                                                            {msg.name}
                                                        </span>
                                                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-full">
                                                            Customer
                                                        </span>
                                                    </div>
                                                    <div className="bg-white dark:bg-zinc-800 border border-zinc-200/90 dark:border-zinc-750 text-zinc-900 dark:text-zinc-100 px-4 py-3 rounded-2xl rounded-tl-xs shadow-xs text-sm leading-relaxed whitespace-pre-wrap select-text">
                                                        {msg.message}
                                                    </div>
                                                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 px-1">
                                                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Official Support Reply Bubble (Right) */}
                                            {msg.admin_notes && (
                                                <div className="flex justify-end animate-in fade-in-50 duration-300">
                                                    <div className="flex flex-col items-end max-w-[90%] sm:max-w-[80%]">
                                                        <div className="flex items-center gap-2 mb-1 px-1">
                                                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full">
                                                                Official Response
                                                            </span>
                                                            <span className="text-xs font-bold text-zinc-900 dark:text-white">
                                                                Support Team
                                                            </span>
                                                        </div>
                                                        <div className="bg-gradient-to-r from-brand-rust to-[#c25430] text-white px-4 py-3 rounded-2xl rounded-tr-xs shadow-xs text-sm leading-relaxed whitespace-pre-wrap select-text">
                                                            {msg.admin_notes}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-zinc-400 font-medium">
                                                            <span>
                                                                Sent {msg.replied_at ? new Date(msg.replied_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                            </span>
                                                            <CheckCheck className="size-3 text-emerald-600" />
                                                            <span className="text-emerald-600 font-semibold">Delivered to Portal</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Awaiting response banner if current thread requires reply */}
                                    {isAwaitingReply && (
                                        <div className="p-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex items-center gap-3 my-2 shadow-2xs">
                                            <Clock className="size-5 text-amber-600 shrink-0" />
                                            <div className="text-xs">
                                                <p className="font-bold text-amber-900 dark:text-amber-200">
                                                    Customer is awaiting your response
                                                </p>
                                                <p className="text-amber-700 dark:text-amber-300/80 mt-0.5">
                                                    Type your official reply in the console below to send it directly to their customer chat desk.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>

                                {/* BOTTOM CONSOLE: Quick Canned Templates & Reply Form */}
                                <div className="border-t border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 sm:p-4 space-y-2.5 shrink-0">
                                    {/* Quick Canned Reply Templates */}
                                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
                                        <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 shrink-0 flex items-center gap-1">
                                            <Sparkles className="size-3 text-brand-rust" /> Quick Replies:
                                        </span>
                                        {cannedTemplates.map((template, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => applyCannedTemplate(template.text)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-brand-rust/10 hover:text-brand-rust transition-colors text-[11px] font-medium shrink-0 border border-zinc-200/60 dark:border-zinc-700"
                                            >
                                                <span>{template.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Reply Textarea & Submit */}
                                    <form onSubmit={handleSendReply} className="space-y-2">
                                        <div className="relative">
                                            <textarea
                                                ref={textareaRef}
                                                rows={3}
                                                value={data.admin_notes}
                                                onChange={(e) => setData('admin_notes', e.target.value)}
                                          onKeyDown={(e) => {
                                              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                                  e.preventDefault();
                                                  handleSendReply(e);
                                              }
                                          }}
                                                placeholder={`Type your reply to ${activeThread.name}... This reply will appear directly in their customer chat desk.`}
                                                disabled={processing}
                                                className="w-full resize-none rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950/60 p-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-brand-rust focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-brand-rust/20 transition-all shadow-inner disabled:opacity-60"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between gap-3 pt-1">
                                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 hidden sm:inline">
                                                Will automatically mark as <span className="text-emerald-600 font-semibold">Resolved</span> and timestamp the response
                                            </span>

                                            <div className="flex items-center gap-2 ml-auto">
                                                {data.admin_notes.trim().length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setData('admin_notes', '')}
                                                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                                                    >
                                                        Clear
                                                    </button>
                                                )}

                                                <button
                                                    type="submit"
                                                    disabled={processing || !data.admin_notes.trim()}
                                                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-brand-rust to-[#c25430] hover:opacity-95 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                                >
                                                    <Send className="size-3.5" />
                                                    <span>Send Reply to Customer</span>
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
                                <div className="size-16 rounded-3xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                                    <MessageSquare className="size-8" />
                                </div>
                                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                    No Conversation Selected
                                </h3>
                                <p className="text-xs text-zinc-400 max-w-sm">
                                    Select a customer conversation thread from the inbox on the left to read their message history and reply.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirm Delete Conversation Modal */}
            <ConfirmModal
                isOpen={deleteModalOpen}
                title="Delete Customer Conversation"
                description={`Are you sure you want to delete the conversation history for "${activeThread?.name}"? This action cannot be undone.`}
                confirmText="Delete Conversation"
                variant="destructive"
                onConfirm={handleConfirmDelete}
                onClose={() => {
                    setDeleteModalOpen(false);
                    setEnquiryToDelete(null);
                }}
            />
        </AppLayout>
    );
}
