import { Head, Link, useForm } from '@inertiajs/react';
import { Save, ArrowLeft } from 'lucide-react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface ShippingUpdate {
    id: number;
    type: string;
    title: string;
    body: string;
    is_published: boolean;
}

export default function ShippingUpdatesEdit({
    update,
}: {
    update: ShippingUpdate;
}) {
    const { data, setData, put, processing, errors } = useForm({
        type: update.type,
        title: update.title,
        body: update.body,
        is_published: update.is_published,
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Shipping Updates', href: '/admin/shipping-updates' },
        { title: 'Edit Notice', href: `/admin/shipping-updates/${update.id}/edit` },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(`/admin/shipping-updates/${update.id}`);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Edit Shipping Update | Admin" />
            <div className="flex h-full flex-1 flex-col gap-4 p-8">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-brand-warm/20 pb-8">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/admin/shipping-updates"
                            className="mt-1 rounded-xl p-2.5 bg-card border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-sm"
                        >
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div className="flex items-center gap-4">
                            <Heading
                                eyebrow="Shipping Updates"
                                title="Edit Official Notice"
                                description="Update this shipping notice or change its publish status."
                            />
                            <span className="rounded-full bg-brand-warm/30 px-4 py-1.5 font-mono text-xs font-bold text-brand-rust tracking-tight border border-brand-rust/10 shadow-sm">
                                {update.title}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 max-w-3xl mx-auto w-full flex-1 card card-padding border-brand-warm/20 shadow-sm rounded-3xl bg-white">
                    <div className="mb-10 flex items-center gap-3">
                        <div className="h-10 w-1 bg-brand-rust rounded-full"></div>
                        <h2 className="font-serif text-xl font-bold text-brand-rust uppercase tracking-tight">Edit Notice</h2>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="type" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Update Type</Label>
                                <select
                                    id="type"
                                    title="Select type"
                                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all shadow-sm"
                                    value={data.type}
                                    onChange={(e) =>
                                        setData('type', e.target.value)
                                    }
                                >
                                    <option value="info">Information</option>
                                    <option value="alert">Urgent Alert</option>
                                    <option value="success">Resolved Update</option>
                                </select>
                                {errors.type && (
                                    <p className="text-sm text-red-500 font-medium ml-1">
                                        {errors.type}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="title" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Headline</Label>
                                <Input
                                    id="title"
                                    value={data.title}
                                    onChange={(e) =>
                                        setData('title', e.target.value)
                                    }
                                    className="h-11 shadow-sm"
                                />
                                {errors.title && (
                                    <p className="text-sm text-red-500 font-medium ml-1">
                                        {errors.title}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="body" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Details</Label>
                                <textarea
                                    id="body"
                                    title="Update details"
                                    className="min-h-40 w-full rounded-md border border-input bg-brand-sand/10 px-3 py-2 text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all shadow-sm"
                                    value={data.body}
                                    onChange={(e) =>
                                        setData('body', e.target.value)
                                    }
                                />
                                {errors.body && (
                                    <p className="text-sm text-red-500 font-medium ml-1">
                                        {errors.body}
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-4 p-4 rounded-xl bg-brand-warm/10 border border-brand-rust/10 group cursor-pointer md:col-span-2" onClick={() => setData('is_published', !data.is_published)}>
                                <input
                                    id="is_published"
                                    type="checkbox"
                                    title="Publish this notice"
                                    className="h-5 w-5 cursor-pointer rounded border-brand-warm accent-brand-rust"
                                    checked={data.is_published}
                                    onChange={(e) =>
                                        setData(
                                            'is_published',
                                            e.target.checked,
                                        )
                                    }
                                />
                                <div className="grid gap-1.5 leading-none">
                                    <Label
                                        htmlFor="is_published"
                                        className="text-sm font-bold text-brand-rust leading-none cursor-pointer"
                                    >
                                        Publish This Notice
                                    </Label>
                                    <p className="text-[10px] text-brand-text/50 uppercase tracking-tighter">
                                        Visible to all users once saved as published.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 border-t border-brand-warm/10 pt-10">
                            <Link
                                href="/admin/shipping-updates"
                                className="btn-outline px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95"
                            >
                                Discard
                            </Link>
                            <Button
                                type="submit"
                                disabled={processing}
                                variant="success"
                                className="flex items-center gap-3 px-10 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:shadow-none"
                            >
                                <Save className="size-4" />
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}
