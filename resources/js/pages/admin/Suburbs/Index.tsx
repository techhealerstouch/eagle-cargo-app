import { Head, useForm, router } from '@inertiajs/react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { debounce } from 'lodash';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import ConfirmModal from '@/components/common/confirm-modal';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import admin from '@/routes/admin';

interface PickupZone {
    id: number;
    name: string;
}

interface Suburb {
    id: number;
    name: string;
    postcode: string | null;
    pickup_zone_id: number | null;
    is_active: boolean;
    pickup_zone?: PickupZone;
}

interface Props {
    suburbs: {
        data: Suburb[];
        current_page: number;
        last_page: number;
        links: any[];
        total: number;
    };
    pickupZones: PickupZone[];
    filters: {
        search?: string;
        pickup_zone_id?: string;
    };
}

export default function SuburbsIndex({ suburbs, pickupZones, filters }: Props) {
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSuburb, setEditingSuburb] = useState<Suburb | null>(null);
    const [suburbToDelete, setSuburbToDelete] = useState<Suburb | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        name: '',
        postcode: '',
        pickup_zone_id: '' as string | number,
        is_active: true,
    });

    const debouncedSearch = useCallback(
        debounce((query: string) => {
            router.get(admin.suburbs.index().url, {
                search: query,
                pickup_zone_id: filters.pickup_zone_id,
            }, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }, 300),
        [filters.pickup_zone_id]
    );

    useEffect(() => {
        if (searchTerm !== filters.search) {
            debouncedSearch(searchTerm);
        }
    }, [searchTerm, debouncedSearch, filters.search]);

    const openCreateDialog = () => {
        clearErrors();
        setEditingSuburb(null);
        setData({
            name: '',
            postcode: '',
            pickup_zone_id: '',
            is_active: true,
        });
        setIsDialogOpen(true);
    };

    const openEditDialog = (suburb: Suburb) => {
        clearErrors();
        setEditingSuburb(suburb);
        setData({
            name: suburb.name,
            postcode: suburb.postcode || '',
            pickup_zone_id: suburb.pickup_zone_id || '',
            is_active: !!suburb.is_active,
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingSuburb) {
            put(admin.suburbs.update(editingSuburb.id).url, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    reset();
                },
            });
        } else {
            post(admin.suburbs.store().url, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    reset();
                },
            });
        }
    };

    const confirmDelete = (suburb: Suburb) => {
        setSuburbToDelete(suburb);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = () => {
        if (!suburbToDelete) return;

        router.delete(admin.suburbs.destroy(suburbToDelete.id).url, {
            onSuccess: () => {
                setIsDeleteModalOpen(false);
                setSuburbToDelete(null);
                toast.success('Suburb deleted successfully.');
            },
        });
    };

    const handlePageChange = (url: string | null) => {
        if (!url) return;
        router.get(url, {
            search: searchTerm,
            pickup_zone_id: filters.pickup_zone_id,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Suburbs', href: '/admin/suburbs' }]}>
            <SettingsLayout
                eyebrow="Operations"
                title="Suburbs"
                description="Manage the list of all suburbs in the system and their assigned pickup areas."
                actions={
                    <button
                        onClick={openCreateDialog}
                        className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-black flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                        <Plus className="size-3.5" />
                        Add Suburb
                    </button>
                }
            >
                <div className="rounded-xl border border-zinc-200/80 bg-white shadow-2xs overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-zinc-100 flex flex-wrap items-center gap-3 bg-zinc-50/50">
                        <div className="relative flex-1 min-w-[240px] max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                            <Input
                                placeholder="Search by suburb name or postcode..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-9 text-xs bg-white"
                            />
                        </div>
                        <select
                            value={filters.pickup_zone_id || ''}
                            onChange={(e) => {
                                router.get(admin.suburbs.index().url, {
                                    search: searchTerm,
                                    pickup_zone_id: e.target.value || undefined,
                                }, { preserveState: true, preserveScroll: true });
                            }}
                            className="h-9 px-3 rounded-md border border-zinc-200 bg-white text-xs text-zinc-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-brand-rust font-medium"
                        >
                            <option value="">All Zones (Assigned & Unassigned)</option>
                            <option value="unassigned">⚠️ Unassigned Suburbs Only</option>
                            {pickupZones.map(zone => (
                                <option key={zone.id} value={zone.id}>{zone.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="overflow-auto max-h-[600px]">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-zinc-50 border-b border-zinc-200 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-4 font-medium text-zinc-500 text-xs uppercase tracking-wider">Suburb</th>
                                    <th className="px-6 py-4 font-medium text-zinc-500 text-xs uppercase tracking-wider">Postcode</th>
                                    <th className="px-6 py-4 font-medium text-zinc-500 text-xs uppercase tracking-wider">Assigned Zone</th>
                                    <th className="px-6 py-4 font-medium text-zinc-500 text-xs uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 bg-white">
                                {suburbs.data.map((suburb) => (
                                    <tr key={suburb.id} className="hover:bg-zinc-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-zinc-900">{suburb.name}</div>
                                        </td>
                                        <td className="px-6 py-4 text-zinc-600">
                                            {suburb.postcode || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {suburb.pickup_zone ? (
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200">
                                                    {suburb.pickup_zone.name}
                                                </span>
                                            ) : (
                                                <span className="text-zinc-400 text-xs italic">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right space-x-1">
                                            <button
                                                onClick={() => openEditDialog(suburb)}
                                                className="p-2 text-zinc-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors inline-flex items-center justify-center"
                                                title="Edit Suburb"
                                            >
                                                <Pencil className="size-4" />
                                            </button>
                                            <button
                                                onClick={() => confirmDelete(suburb)}
                                                className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center justify-center"
                                                title="Delete Suburb"
                                            >
                                                <Trash2 className="size-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {suburbs.data.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">
                                            No suburbs found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {suburbs.last_page > 1 && (
                        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between">
                            <span className="text-xs text-zinc-500">
                                Showing {((suburbs.current_page - 1) * 50) + 1} to {Math.min(suburbs.current_page * 50, suburbs.total)} of {suburbs.total} entries
                            </span>
                            <div className="flex gap-1">
                                {suburbs.links.map((link, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handlePageChange(link.url)}
                                        disabled={!link.url || link.active}
                                        className={`px-3 py-1 text-xs rounded-md border ${
                                            link.active
                                                ? 'bg-zinc-900 text-white border-zinc-900'
                                                : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50'
                                        } ${!link.url ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-white">
                        <div className="p-6 border-b border-zinc-100">
                            <DialogTitle className="text-lg font-semibold text-zinc-900">
                                {editingSuburb ? 'Edit Suburb' : 'Add New Suburb'}
                            </DialogTitle>
                            <DialogDescription className="text-sm text-zinc-500 mt-1">
                                Fill in the details below to {editingSuburb ? 'update the' : 'create a'} suburb.
                            </DialogDescription>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="name">Suburb Name *</Label>
                                <Input
                                    id="name"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    placeholder="e.g. Melbourne CBD"
                                    autoFocus
                                />
                                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="postcode">Postcode</Label>
                                <Input
                                    id="postcode"
                                    value={data.postcode}
                                    onChange={(e) => setData('postcode', e.target.value)}
                                    placeholder="e.g. 3000"
                                />
                                {errors.postcode && <p className="text-xs text-red-500">{errors.postcode}</p>}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="pickup_zone_id">Assign to Pickup Area</Label>
                                <select
                                    id="pickup_zone_id"
                                    value={data.pickup_zone_id}
                                    onChange={(e) => setData('pickup_zone_id', e.target.value)}
                                    className="flex h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-rust disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <option value="">-- Unassigned --</option>
                                    {pickupZones.map(zone => (
                                        <option key={zone.id} value={zone.id}>{zone.name}</option>
                                    ))}
                                </select>
                                {errors.pickup_zone_id && <p className="text-xs text-red-500">{errors.pickup_zone_id}</p>}
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-100">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={processing} className="bg-zinc-900 text-white hover:bg-black">
                                    Save Suburb
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                <ConfirmModal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onConfirm={handleDelete}
                    title="Delete Suburb"
                    description={`Are you sure you want to delete ${suburbToDelete?.name}? This action cannot be undone.`}
                    confirmText="Delete Suburb"
                    variant="destructive"
                />
            </SettingsLayout>
        </AppLayout>
    );
}
