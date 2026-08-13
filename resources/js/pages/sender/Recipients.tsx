import { Head, Link, router, useForm } from '@inertiajs/react';
import { Search, PlusCircle, Edit2, Trash2, MapPin, Phone, Mail, Package } from 'lucide-react';
import { useEffect, useState } from 'react';
import ConfirmModal from '@/components/common/confirm-modal';
import Heading from '@/components/common/heading';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

export default function Recipients({ recipients, filters = {} }: any) {
    const { delete: destroy } = useForm();
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Home', href: '/dashboard' },
        { title: 'Recipients', href: '/recipients' }
    ];

    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [recipientToDelete, setRecipientToDelete] = useState<number | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const deleteRecipient = (id: number) => {
        setRecipientToDelete(id);
        setIsConfirmModalOpen(true);
    };

    const handleConfirmDelete = () => {
        if (!recipientToDelete) return;

        setIsProcessing(true);
        destroy(`/recipients/${recipientToDelete}`, {
            onSuccess: () => {
                setIsConfirmModalOpen(false);
                setRecipientToDelete(null);
            },
            onFinish: () => setIsProcessing(false),
        });
    };

    useEffect(() => {
        if (searchTerm === (filters.search || '')) return;

        const timeout = window.setTimeout(() => {
            router.get('/recipients', searchTerm ? { search: searchTerm } : {}, {
                preserveState: true,
                replace: true,
                only: ['recipients', 'filters'],
            });
        }, 300);

        return () => window.clearTimeout(timeout);
    }, [filters.search, searchTerm]);

    const recipientList = recipients?.data || [];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="My Recipients" />

            <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-8 md:space-y-10">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-b border-zinc-100 dark:border-zinc-800 pb-10">
                    <Heading
                        eyebrow="Address Book"
                        title="My Recipients"
                        description="Manage your frequent shipping destinations and contacts."
                    />
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative flex-1 md:w-80 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-white transition-colors" />
                            <input
                                type="text"
                                placeholder="Search by name, city..."
                                className="w-full pl-11 pr-4 h-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-950 focus:border-zinc-300 dark:focus:border-zinc-700 transition-all shadow-sm placeholder:text-zinc-400 text-zinc-900 dark:text-zinc-100"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {recipientList.length > 0 ? (
                        recipientList.map((recipient: any) => (
                            <div key={recipient.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative group flex flex-col h-full">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="pr-10">
                                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white break-words">{recipient.name}</h3>
                                        <div className="flex items-center gap-2 mt-1 text-xs font-medium text-brand-rust">
                                            <Package className="w-3 h-3" />
                                            <span>{recipient.boxes_count} boxes shipped</span>
                                        </div>
                                    </div>
                                    <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Link
                                            href={`/recipients/${recipient.id}/edit`}
                                            className="p-2 text-zinc-400 hover:text-blue-600 bg-zinc-50 hover:bg-blue-50 dark:bg-zinc-800 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </Link>
                                        <button
                                            onClick={() => deleteRecipient(recipient.id)}
                                            disabled={recipient.boxes_count > 0}
                                            className="p-2 text-zinc-400 hover:text-red-600 bg-zinc-50 hover:bg-red-50 dark:bg-zinc-800 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            title={recipient.boxes_count > 0 ? "Cannot delete recipient with shipment history" : "Delete recipient"}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="space-y-3 mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                    <div className="flex items-start gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                                        <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                                        <span>
                                            {recipient.address}<br/>
                                            {recipient.city}, {recipient.province} {recipient.zip_code}
                                            {recipient.area && <span className="block mt-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{recipient.area.name}</span>}
                                        </span>
                                    </div>
                                    {recipient.phone_number && (
                                        <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                                            <Phone className="w-4 h-4 shrink-0" />
                                            <span>{recipient.phone_number}</span>
                                        </div>
                                    )}
                                    {recipient.email && (
                                        <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                                            <Mail className="w-4 h-4 shrink-0" />
                                            <span>{recipient.email}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl">
                            <div className="mx-auto w-16 h-16 bg-zinc-50 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
                                <Search className="w-6 h-6 text-zinc-400" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">No recipients found</h3>
                            <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                                {searchTerm ? "We couldn't find any recipients matching your search." : "You haven't saved any recipients yet. They will be saved automatically when you book a shipment."}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Delete Recipient"
                description="Are you sure you want to delete this recipient? This action cannot be undone."
                confirmText="Delete Recipient"
                loading={isProcessing}
                variant="destructive"
            />
        </AppLayout>
    );
}
