import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeft, Save, Mail, Phone, Calendar, MessageSquare, ClipboardList } from 'lucide-react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface Enquiry {
    id: number;
    name: string;
    email: string;
    mobile: string | null;
    message: string;
    is_read: boolean;
    admin_notes: string | null;
    replied_at: string | null;
    created_at: string;
}

export default function EnquiriesShow({ enquiry }: { enquiry: Enquiry }) {
    const { data, setData, patch, processing, errors } = useForm({
        admin_notes: enquiry.admin_notes || '',
        replied_at: enquiry.replied_at
            ? new Date(enquiry.replied_at).toISOString().split('T')[0]
            : '',
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Enquiries', href: '/admin/enquiries' },
        { title: 'Details', href: '#' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(`/admin/enquiries/${enquiry.id}`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Enquiry from ${enquiry.name} | Admin`} />
            <div className="flex h-full flex-1 flex-col gap-8 p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-brand-warm/20 pb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/enquiries"
                            className="mt-1 rounded-xl p-2.5 bg-card border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-sm"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div className="flex items-center gap-4">
                            <Heading
                                eyebrow="Customer Support"
                                title={`Enquiry: ${enquiry.name}`}
                                description={`Communication received via the web portal on ${new Date(enquiry.created_at).toLocaleDateString()}.`}
                            />
                            {!enquiry.is_read && (
                                <span className="rounded-full bg-brand-rust/10 px-4 py-1.5 font-mono text-xs font-bold text-brand-rust tracking-tight border border-brand-rust/20 shadow-sm animate-pulse">
                                    UNREAD
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                    {/* Enquiry details content */}
                    <div className="space-y-8 lg:col-span-2">
                        <div className="card card-padding border-brand-warm/20 shadow-sm rounded-3xl bg-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-5">
                                <MessageSquare className="size-24 text-brand-rust" />
                            </div>
                            <div className="mb-6 flex items-center gap-3">
                                <div className="h-6 w-1 bg-brand-rust rounded-full"></div>
                                <h2 className="font-serif text-lg font-bold text-brand-rust uppercase tracking-tight">Customer Message</h2>
                            </div>
                            <div className="bg-brand-sand/5 rounded-2xl p-8 border border-brand-warm/10 italic text-brand-text leading-relaxed font-serif text-lg">
                                "{enquiry.message}"
                            </div>
                        </div>

                        <form
                            onSubmit={handleSubmit}
                            className="card card-padding border-brand-warm/20 shadow-sm rounded-3xl bg-white"
                        >
                            <div className="mb-8 flex items-center gap-3">
                                <div className="h-6 w-1 bg-brand-rust rounded-full"></div>
                                <h2 className="font-serif text-lg font-bold text-brand-rust uppercase tracking-tight">Support Resolution</h2>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="admin_notes" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Internal Notes</Label>
                                    <textarea
                                        id="admin_notes"
                                        className="min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all shadow-sm"
                                        value={data.admin_notes}
                                        onChange={(e) =>
                                            setData('admin_notes', e.target.value)
                                        }
                                        placeholder="Record investigation steps, phone conversations, or resolution status..."
                                    />
                                    {errors.admin_notes && (
                                        <p className="text-sm text-red-500 font-medium ml-1">
                                            {errors.admin_notes}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2 max-w-sm">
                                    <Label htmlFor="replied_at" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Response Validation Date</Label>
                                    <div className="relative">
                                        <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-brand-rust/30" />
                                           <input
                                            id="replied_at"
                                            type="date"
                                               title="Reply date"
                                            className="flex h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all shadow-sm"
                                            value={data.replied_at}
                                            onChange={(e) =>
                                                setData('replied_at', e.target.value)
                                            }
                                        />
                                    </div>
                                    {errors.replied_at && (
                                        <p className="text-sm text-red-500 font-medium ml-1">
                                            {errors.replied_at}
                                        </p>
                                    )}
                                </div>
                                <div className="flex justify-end pt-4 border-t border-brand-warm/10">
                                    <Button
                                        type="submit"
                                        disabled={processing}
                                        variant="success"
                                        className="flex items-center gap-3 px-10 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:shadow-none"
                                    >
                                        <Save className="size-4" />
                                        Save Reply
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Sidebar technical meta */}
                    <div className="space-y-6">
                        <div className="card border-brand-warm/20 shadow-sm rounded-3xl bg-white overflow-hidden h-fit">
                            <div className="bg-brand-warm/10 px-6 py-4 border-b border-brand-warm/10">
                                <h2 className="font-serif text-sm font-bold text-brand-rust uppercase tracking-widest">Metadata</h2>
                            </div>
                            <div className="p-6 space-y-6 text-sm">
                                <div>
                                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        Customer Persona
                                    </span>
                                    <div className="flex items-center gap-3 font-serif text-lg text-brand-text">
                                        <div className="size-8 rounded-full bg-brand-warm flex items-center justify-center text-brand-rust font-bold">
                                            {enquiry.name.charAt(0)}
                                        </div>
                                        {enquiry.name}
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-brand-warm/10">
                                    <div className="flex items-start gap-4">
                                        <div className="mt-1 p-2 rounded-lg bg-brand-sand/20 text-brand-rust">
                                            <Mail className="size-4" />
                                        </div>
                                        <div className="grid gap-1">
                                            <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">Verified Email</span>
                                            <a href={`mailto:${enquiry.email}`} className="font-mono text-brand-rust hover:underline">
                                                {enquiry.email}
                                            </a>
                                        </div>
                                    </div>

                                    {enquiry.mobile && (
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1 p-2 rounded-lg bg-brand-sand/20 text-brand-rust">
                                                <Phone className="size-4" />
                                            </div>
                                            <div className="grid gap-1">
                                                <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">Communication Terminal</span>
                                                <span className="font-mono">{enquiry.mobile}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-start gap-4">
                                        <div className="mt-1 p-2 rounded-lg bg-brand-sand/20 text-brand-rust">
                                            <Calendar className="size-4" />
                                        </div>
                                        <div className="grid gap-1">
                                            <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">Original Receipt</span>
                                            <span className="font-mono">{new Date(enquiry.created_at).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>

                                {enquiry.replied_at && (
                                    <div className="pt-6 border-t border-brand-warm/10">
                                        <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl text-green-800 border border-green-100">
                                            <ClipboardList className="size-4" />
                                            <span className="font-mono text-xs font-bold uppercase tracking-tighter">
                                                Resolved {new Date(enquiry.replied_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
