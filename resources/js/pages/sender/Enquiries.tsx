import { useState, useRef, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import { 
    Send, 
    MessageSquare, 
    Phone, 
    Mail, 
    RefreshCw, 
    Check, 
    CheckCheck, 
    Clock, 
    HelpCircle, 
    Package, 
    Sparkles, 
    Calendar, 
    ShieldCheck, 
    Headphones,
    AlertCircle,
    ChevronRight,
    MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { cn } from '@/lib/utils';

interface EnquiryItem {
    id: number;
    name: string;
    email: string;
    mobile?: string | null;
    message: string;
    is_read: boolean;
    read_at?: string | null;
    replied_at?: string | null;
    admin_notes?: string | null;
    created_at: string;
    updated_at?: string;
    _optimistic?: boolean;
}

interface ActiveBooking {
    id: number;
    reference_number: string;
    status: string;
    boxes_count: number;
}

interface SenderInfo {
    name: string;
    email: string;
    mobile?: string | null;
}

interface Props {
    enquiries: EnquiryItem[] | { data: EnquiryItem[] };
    activeBookings?: ActiveBooking[];
    sender?: SenderInfo;
    pageTitle?: string;
    breadcrumbs?: BreadcrumbItem[];
}

export default function Enquiries({
    enquiries,
    activeBookings = [],
    sender,
    pageTitle = 'Support Chat',
    breadcrumbs = []
}: Props) {
    const rawList = Array.isArray(enquiries) ? enquiries : enquiries?.data || [];
    const [messageText, setMessageText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [optimisticMessages, setOptimisticMessages] = useState<EnquiryItem[]>([]);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const defaultBreadcrumbs: BreadcrumbItem[] = breadcrumbs.length > 0 ? breadcrumbs : [
        { title: 'Home', href: '/dashboard' },
        { title: 'Support Chat', href: '/enquiries' }
    ];

    // Combine server enquiries and any pending optimistic messages
    const allEnquiries = [...rawList, ...optimisticMessages];

    const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    useEffect(() => {
        scrollToBottom('auto');
    }, []);

    useEffect(() => {
        scrollToBottom('smooth');
    }, [allEnquiries.length, optimisticMessages.length]);

    const formatTime = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    const formatDateHeader = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(today.getDate() - 1);

            if (date.toDateString() === today.toDateString()) {
                return 'Today';
            }
            if (date.toDateString() === yesterday.toDateString()) {
                return 'Yesterday';
            }
            return date.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    const handleSendMessage = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = messageText.trim();
        if (!trimmed || isSubmitting) return;

        setIsSubmitting(true);

        const tempId = Date.now();
        const optimisticItem: EnquiryItem = {
            id: tempId,
            name: sender?.name || 'You',
            email: sender?.email || '',
            mobile: sender?.mobile || null,
            message: trimmed,
            is_read: false,
            created_at: new Date().toISOString(),
            _optimistic: true,
        };

        setOptimisticMessages(prev => [...prev, optimisticItem]);
        setMessageText('');

        router.post('/enquiries', {
            message: trimmed
        }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
                setIsSubmitting(false);
                toast.success('Your message has been sent to our support desk.');
                setTimeout(() => scrollToBottom('smooth'), 100);
            },
            onError: (errors) => {
                setOptimisticMessages(prev => prev.filter(m => m.id !== tempId));
                setIsSubmitting(false);
                toast.error(errors.message || 'Failed to send message. Please try again.');
            }
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.reload({
            only: ['enquiries'],
            onFinish: () => {
                setIsRefreshing(false);
                toast.info('Chat messages updated.');
            }
        });
    };

    const handleQuickPrompt = (promptText: string) => {
        setMessageText(promptText);
        textareaRef.current?.focus();
    };

    const handleBookingTag = (refNumber: string) => {
        const prefix = `Regarding Booking #${refNumber}: `;
        const existingBookingRegex = /^(Regarding Booking #[^:]+:\s*)+/i;

        setMessageText(prev => {
            if (existingBookingRegex.test(prev)) {
                return prev.replace(existingBookingRegex, prefix);
            }
            return prev.trim() ? `${prefix}${prev}` : prefix;
        });
        textareaRef.current?.focus();
    };

    // Quick starter prompt suggestions
    const quickPrompts = [
        { label: '📦 Shipment Location', text: 'Hi! Could you please give me the latest tracking update on my shipment?' },
        { label: '📅 Sailing Schedule', text: 'When is the next sea cargo batch cut-off and departure date for Manila?' },
        { label: '🏠 Update Delivery Info', text: 'I need to update the delivery recipient address/contact number in the Philippines.' },
        { label: '📦 Request Empty Boxes', text: 'Good day! How do I request extra empty boxes delivered for packing?' },
    ];

    return (
        <AppLayout breadcrumbs={defaultBreadcrumbs}>
            <Head title={`Support Chat | Eagle Cargo`} />

            <div className="mx-auto max-w-5xl p-2 sm:p-4 md:p-6 lg:p-8 flex flex-col h-[calc(100vh-4.5rem)] min-h-[640px]">
                {/* Main Chat Frame */}
                <div className="flex flex-col flex-1 bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-2xl sm:rounded-3xl shadow-sm overflow-hidden">
                    
                    {/* Header */}
                    <div className="bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur-md p-4 sm:px-6 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-3.5 min-w-0">
                            {/* Avatar with live pulse dot */}
                            <div className="relative size-11 sm:size-12 rounded-2xl bg-gradient-to-br from-brand-rust to-[#c25430] text-white flex items-center justify-center shadow-xs shrink-0">
                                <Headphones className="size-6" />
                                <span className="absolute -bottom-0.5 -right-0.5 size-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-zinc-900 ring-2 ring-emerald-500/20 animate-pulse" />
                            </div>

                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h1 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight truncate">
                                        Eagle Cargo Support
                                    </h1>
                                    <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/50 px-2 py-0.5 rounded-full">
                                        <ShieldCheck className="size-3 text-emerald-600" />
                                        Verified
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                        <span className="size-1.5 rounded-full bg-emerald-500"></span>
                                        Online
                                    </span>
                                    <span>•</span>
                                    <span className="truncate">Typically responds in under 2 hours</span>
                                </div>
                            </div>
                        </div>

                        {/* Direct Contact Actions & Refresh */}
                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            <a
                                href="tel:+61406828471"
                                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors shadow-2xs"
                                title="Call Support"
                            >
                                <Phone className="size-3.5 text-brand-rust" />
                                <span>+61 406 828 471</span>
                            </a>

                            <a
                                href="mailto:support@eaglecargo.com.au"
                                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-colors shadow-2xs"
                                title="Email Support"
                            >
                                <Mail className="size-3.5 text-brand-rust" />
                                <span>Email Us</span>
                            </a>

                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className={cn(
                                    "p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-all shadow-2xs flex items-center gap-1.5",
                                    isRefreshing && "opacity-60 cursor-not-allowed"
                                )}
                                title="Refresh messages"
                            >
                                <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin text-brand-rust")} />
                                <span className="hidden sm:inline">Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* Messages Scroll Area */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-zinc-50/40 dark:bg-zinc-950/30">
                        {/* Welcoming Initial Support Greeting */}
                        <div className="flex items-start gap-3 max-w-[90%] sm:max-w-[78%]">
                            <div className="size-9 rounded-xl bg-brand-rust/10 border border-brand-rust/20 flex items-center justify-center text-brand-rust shrink-0 mt-0.5 shadow-2xs">
                                <Headphones className="size-4" />
                            </div>
                            <div className="flex flex-col items-start min-w-0">
                                <div className="flex items-center gap-2 mb-1 px-1">
                                    <span className="text-xs font-bold text-zinc-900 dark:text-white">Eagle Cargo Support</span>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-brand-rust/10 text-brand-rust rounded-full">
                                        Helpdesk
                                    </span>
                                </div>
                                <div className="bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-750 text-zinc-800 dark:text-zinc-200 px-4 py-3.5 rounded-2xl rounded-tl-xs shadow-2xs text-sm leading-relaxed space-y-2">
                                    <p>
                                        Mabuhay, <span className="font-semibold text-zinc-900 dark:text-white">{sender?.name || 'Valued Sender'}</span>! 👋
                                    </p>
                                    <p>
                                        Welcome to our direct customer enquiry chat. Ask anything about your box shipments, sailing dates, pickup schedules, or customs details. Our team is ready to assist you!
                                    </p>
                                </div>
                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 px-1">
                                    Support Desk
                                </span>
                            </div>
                        </div>

                        {/* Render All Historical & New Enquiries */}
                        {allEnquiries.map((enquiry, index) => {
                            const prevEnquiry = index > 0 ? allEnquiries[index - 1] : null;
                            const showDateHeader = !prevEnquiry || 
                                new Date(prevEnquiry.created_at).toDateString() !== new Date(enquiry.created_at).toDateString();

                            const isReplied = !!enquiry.admin_notes;
                            const isRead = enquiry.is_read;
                            const isOptimistic = enquiry._optimistic;

                            return (
                                <div key={enquiry.id || `opt-${index}`} className="space-y-4">
                                    {/* Date Divider */}
                                    {showDateHeader && (
                                        <div className="flex items-center justify-center my-4">
                                            <span className="px-3 py-1 bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[11px] font-semibold rounded-full shadow-2xs border border-zinc-200/50 dark:border-zinc-700/50">
                                                {formatDateHeader(enquiry.created_at)}
                                            </span>
                                        </div>
                                    )}

                                    {/* Sender's Message Bubble (Right) */}
                                    <div className="flex justify-end">
                                        <div className="flex flex-col items-end max-w-[88%] sm:max-w-[75%]">
                                            <div className="bg-gradient-to-r from-brand-rust to-[#c25430] text-white px-4 py-3 rounded-2xl rounded-tr-xs shadow-xs text-sm leading-relaxed whitespace-pre-wrap select-text">
                                                {enquiry.message}
                                            </div>

                                            {/* Message Status & Timestamp */}
                                            <div className="flex items-center gap-1.5 mt-1 px-1 text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
                                                <span>{formatTime(enquiry.created_at)}</span>

                                                {isOptimistic ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
                                                        <Clock className="size-3 animate-spin" /> Sending...
                                                    </span>
                                                ) : isReplied ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold ml-1">
                                                        <CheckCheck className="size-3.5 text-emerald-600" /> Replied
                                                    </span>
                                                ) : isRead ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 ml-1">
                                                        <CheckCheck className="size-3.5 text-blue-500" /> Seen by Support
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400 ml-1">
                                                        <Check className="size-3.5 text-zinc-400" /> Delivered • Pending response
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Support's Response Bubble (Left) if replied */}
                                    {isReplied && enquiry.admin_notes && (
                                        <div className="flex items-start gap-3 max-w-[90%] sm:max-w-[78%] animate-in fade-in-50 duration-300">
                                            <div className="size-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5 shadow-2xs">
                                                <MessageSquare className="size-4" />
                                            </div>
                                            <div className="flex flex-col items-start min-w-0">
                                                <div className="flex items-center gap-2 mb-1 px-1">
                                                    <span className="text-xs font-bold text-zinc-900 dark:text-white">Support Specialist</span>
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full">
                                                        Official Reply
                                                    </span>
                                                </div>
                                                <div className="bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-750 text-zinc-800 dark:text-zinc-200 px-4 py-3.5 rounded-2xl rounded-tl-xs shadow-2xs text-sm leading-relaxed whitespace-pre-wrap select-text">
                                                    {enquiry.admin_notes}
                                                </div>
                                                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 px-1">
                                                    {formatTime(enquiry.replied_at || enquiry.updated_at || enquiry.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Empty State when zero messages */}
                        {allEnquiries.length === 0 && (
                            <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl p-6 sm:p-8 text-center max-w-lg mx-auto shadow-2xs space-y-4 my-6">
                                <div className="size-12 rounded-2xl bg-brand-warm/60 dark:bg-zinc-800 flex items-center justify-center text-brand-rust mx-auto shadow-2xs">
                                    <Sparkles className="size-6" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-zinc-900 dark:text-white">Start your enquiry</h2>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                                        Type a message below or click one of our quick questions to get started right away.
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-left">
                                    {quickPrompts.map((item, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => handleQuickPrompt(item.text)}
                                            className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-750 text-zinc-700 dark:text-zinc-300 text-xs hover:border-brand-rust/50 hover:bg-brand-rust/5 transition-all group flex items-start gap-2 text-left"
                                        >
                                            <span className="shrink-0">{item.label.split(' ')[0]}</span>
                                            <span className="line-clamp-2 text-[11px] font-medium leading-snug group-hover:text-brand-rust transition-colors">
                                                {item.label.substring(2)}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Bottom Area: Context Bar + Chat Input */}
                    <div className="border-t border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 sm:p-4 space-y-2.5 shrink-0">
                        {/* Active Bookings Quick Reference Bar */}
                        {activeBookings.length > 0 && (
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
                                <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 shrink-0 flex items-center gap-1">
                                    <Package className="size-3.5 text-brand-rust" /> Tag Booking:
                                </span>
                                {activeBookings.map((b) => (
                                    <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => handleBookingTag(b.reference_number)}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-brand-rust/10 hover:text-brand-rust transition-all shrink-0 text-xs font-medium border border-zinc-200/60 dark:border-zinc-700"
                                        title={`Add #${b.reference_number} to your message`}
                                    >
                                        <span className="font-mono text-[11px] font-semibold">{b.reference_number}</span>
                                        <span className="text-[10px] text-zinc-400 uppercase tracking-tight">({b.status})</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Quick Prompt Pill Strip (for quick queries) */}
                        {allEnquiries.length > 0 && (
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
                                {quickPrompts.map((p, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleQuickPrompt(p.text)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-brand-rust/10 hover:text-brand-rust transition-colors text-[11px] font-medium shrink-0 border border-zinc-200/50 dark:border-zinc-700/50"
                                    >
                                        <span>{p.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Unified Modern Chat Composer */}
                        <form onSubmit={handleSendMessage} className="space-y-2">
                            <div className="relative rounded-2xl sm:rounded-3xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-950/60 focus-within:border-brand-rust focus-within:bg-white dark:focus-within:bg-zinc-900 focus-within:ring-2 focus-within:ring-brand-rust/20 transition-all shadow-xs overflow-hidden">
                                <textarea
                                    ref={textareaRef}
                                    value={messageText}
                                    onChange={(e) => setMessageText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type your message or enquiry here..."
                                    rows={2}
                                    disabled={isSubmitting}
                                    className="w-full resize-none border-0 bg-transparent p-3 sm:p-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-0 transition-all disabled:opacity-60"
                                />

                                <div className="flex items-center justify-between gap-3 px-3 sm:px-4 py-2 border-t border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-100/40 dark:bg-zinc-900/40">
                                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 hidden sm:inline-flex items-center gap-1.5">
                                        <span>Press</span>
                                        <kbd className="font-mono text-[10px] bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 shadow-2xs">Enter â†µ</kbd>
                                        <span>to send</span>
                                        <span className="text-zinc-300 dark:text-zinc-700">â€¢</span>
                                        <kbd className="font-mono text-[10px] bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 shadow-2xs">Shift + Enter</kbd>
                                        <span>for newline</span>
                                    </span>

                                    <button
                                        type="submit"
                                        disabled={!messageText.trim() || isSubmitting}
                                        className={cn(
                                            "ml-auto h-8 sm:h-9 px-4 sm:px-5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-95 shrink-0 cursor-pointer shadow-xs",
                                            messageText.trim()
                                                ? "bg-gradient-to-r from-brand-rust to-[#c25430] text-white hover:opacity-95 shadow-sm"
                                                : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed opacity-60"
                                        )}
                                    >
                                        {isSubmitting ? (
                                            <Clock className="size-3.5 animate-spin" />
                                        ) : (
                                            <>
                                                <span>Send</span>
                                                <Send className="size-3.5" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Trust Badge Footer */}
                            <div className="flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 px-1">
                                <span className="sm:hidden text-[10px]">
                                    Press Enter â†µ to send
                                </span>
                                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 ml-auto">
                                    Protected support channel â€¢ Eagle Cargo
                                </span>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
