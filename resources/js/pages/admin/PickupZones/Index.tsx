import { Head, useForm, router } from '@inertiajs/react';
import { MapPin, Pencil, Plus, Trash2, Search, Check, Clock, CalendarDays, CalendarX, Globe } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import SearchFilter from '@/components/common/search-filter';
import ConfirmModal from '@/components/common/confirm-modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import admin from '@/routes/admin';

interface Suburb {
    id: number;
    name: string;
    pickup_zone_id: number | null;
}

interface PickupWindow {
    id: string;
    label: string;
    days: string[];
    time_start: string;
    time_end: string;
    weeks_of_month?: number[];
    enabled: boolean;
}

interface PickupZone {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    lead_time_days: number | null;
    pickup_windows: PickupWindow[] | null;
    blackout_dates: string[] | null;
    suburbs?: Suburb[];
}

interface Props {
    pickupZones: PickupZone[];
    allSuburbs: Suburb[];
}

export default function PickupZonesIndex({ pickupZones, allSuburbs }: Props) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingZone, setEditingZone] = useState<PickupZone | null>(null);
    const [zoneToDelete, setZoneToDelete] = useState<PickupZone | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'details' | 'suburbs' | 'schedule'>('details');

    const [suburbSearch, setSuburbSearch] = useState('');

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        name: '',
        description: '',
        is_active: true,
        lead_time_days: null as number | null,
        pickup_windows: [] as PickupWindow[],
        blackout_dates: [] as string[],
        suburb_ids: [] as number[],
    });

    const openCreateDialog = () => {
        clearErrors();
        setEditingZone(null);
        setActiveTab('details');
        setData({
            name: '',
            description: '',
            is_active: true,
            lead_time_days: null,
            pickup_windows: [],
            blackout_dates: [],
            suburb_ids: [],
        });
        setIsDialogOpen(true);
    };

    const openEditDialog = (zone: PickupZone) => {
        clearErrors();
        setEditingZone(zone);
        setActiveTab('details');
        setData({
            name: zone.name,
            description: zone.description || '',
            is_active: !!zone.is_active,
            lead_time_days: zone.lead_time_days,
            pickup_windows: zone.pickup_windows || [],
            blackout_dates: zone.blackout_dates || [],
            suburb_ids: zone.suburbs ? zone.suburbs.map(s => s.id) : [],
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingZone) {
            put(admin.pickupZones.update(editingZone.id).url, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    reset();
                },
            });
        } else {
            post(admin.pickupZones.store().url, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    reset();
                },
            });
        }
    };

    const confirmDelete = (zone: PickupZone) => {
        setZoneToDelete(zone);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = () => {
        if (!zoneToDelete) return;

        router.delete(admin.pickupZones.destroy(zoneToDelete.id).url, {
            onSuccess: () => {
                setIsDeleteModalOpen(false);
                setZoneToDelete(null);
                toast.success('Pickup Area deleted successfully.');
            },
        });
    };

    const filteredSuburbs = useMemo(() => {
        return allSuburbs.filter(s => {
            const matchesSearch = s.name.toLowerCase().includes(suburbSearch.toLowerCase().trim());
            return matchesSearch;
        });
    }, [allSuburbs, suburbSearch]);

    return (
        <AppLayout breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Pickup Areas', href: '/admin/pickup-zones' }]}>
            <SettingsLayout
                eyebrow="Operations"
                title="Pickup Areas"
                description="Manage pickup areas, covered suburbs, and scheduling settings."
                actions={
                    <button
                        onClick={openCreateDialog}
                        className="h-9 px-4 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-black flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                        <Plus className="size-3.5" />
                        Add Pickup Area
                    </button>
                }
            >
                <div className="rounded-xl border border-zinc-200/80 bg-white shadow-2xs overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-zinc-50 border-b border-zinc-200">
                            <tr>
                                <th className="px-6 py-4 font-medium text-zinc-500 text-xs uppercase tracking-wider">Pickup Area</th>
                                <th className="px-6 py-4 font-medium text-zinc-500 text-xs uppercase tracking-wider whitespace-nowrap">Covered Suburbs</th>
                                <th className="px-6 py-4 font-medium text-zinc-500 text-xs uppercase tracking-wider whitespace-nowrap">Status</th>
                                <th className="px-6 py-4 font-medium text-zinc-500 text-xs uppercase tracking-wider text-right whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                            {pickupZones.map((zone) => (
                                <tr key={zone.id} className="hover:bg-zinc-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-zinc-900">{zone.name}</div>
                                        {zone.description && (
                                            <div className="text-xs text-zinc-500 mt-1 max-w-md whitespace-normal">{zone.description}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-zinc-600 text-sm">
                                            {zone.suburbs?.length || 0} Suburbs
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${zone.is_active
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                                        }`}>
                                            {zone.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-1 whitespace-nowrap">
                                        <button
                                            onClick={() => openEditDialog(zone)}
                                            className="p-2 text-zinc-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors inline-flex items-center justify-center"
                                            title="Edit Pickup Area"
                                        >
                                            <Pencil className="size-4" />
                                        </button>
                                        <button
                                            onClick={() => confirmDelete(zone)}
                                            className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center justify-center"
                                            title="Delete Pickup Area"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-zinc-50">
                        <div className="p-6 pb-0 border-b border-zinc-200 bg-white">
                            <DialogTitle className="text-lg font-semibold text-zinc-900">
                                {editingZone ? `Edit Pickup Area: ${editingZone.name}` : 'Create New Pickup Area'}
                            </DialogTitle>
                            <DialogDescription className="text-sm text-zinc-500 mt-1">
                                Configure pickup area details and covered suburbs.
                            </DialogDescription>

                            <div className="flex gap-6 mt-6 border-b border-transparent">
                                {[
                                    { id: 'details', label: '1. Details', icon: MapPin },
                                    { id: 'suburbs', label: `2. Covered Suburbs (${data.suburb_ids.length})`, icon: Globe },
                                ].map((tab) => {
                                    const Icon = tab.icon;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
                                                activeTab === tab.id
                                                    ? 'border-brand-rust text-brand-rust'
                                                    : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                                            }`}
                                        >
                                            <Icon className="size-4" />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="p-6 max-h-[60vh] overflow-y-auto">
                                {activeTab === 'details' && (
                                    <div className="space-y-6 max-w-xl">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="name">Pickup Area Name</Label>
                                            <Input
                                                id="name"
                                                value={data.name}
                                                onChange={(e) => setData('name', e.target.value)}
                                                placeholder="e.g. Metro Areas"
                                            />
                                            {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="description">Description (Optional)</Label>
                                            <textarea
                                                id="description"
                                                value={data.description}
                                                onChange={(e) => setData('description', e.target.value)}
                                                className="w-full min-h-[100px] text-sm p-3 border border-zinc-200 rounded-lg focus:ring-1 focus:ring-brand-rust focus:border-brand-rust"
                                                placeholder="Additional details about this zone..."
                                            />
                                        </div>

                                        <div className="flex items-center gap-2.5">
                                            <Checkbox
                                                id="is_active"
                                                checked={data.is_active}
                                                onCheckedChange={(checked) => setData('is_active', checked as boolean)}
                                            />
                                            <Label htmlFor="is_active" className="cursor-pointer">Pickup area is active and available for bookings</Label>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'suburbs' && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="relative flex-1 max-w-md">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" />
                                                <Input
                                                    placeholder="Search suburb..."
                                                    value={suburbSearch}
                                                    onChange={(e) => setSuburbSearch(e.target.value)}
                                                    className="pl-9 bg-white"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-zinc-200 min-h-[300px] content-start">
                                            {filteredSuburbs.map((suburb) => {
                                                const isSelected = data.suburb_ids.includes(suburb.id);
                                                return (
                                                    <label
                                                        key={suburb.id}
                                                        className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                                                            isSelected 
                                                                ? 'border-brand-rust/30 bg-brand-rust/5' 
                                                                : 'border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50'
                                                        }`}
                                                    >
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    setData('suburb_ids', [...data.suburb_ids, suburb.id]);
                                                                } else {
                                                                    setData('suburb_ids', data.suburb_ids.filter(id => id !== suburb.id));
                                                                }
                                                            }}
                                                            className="mt-0.5"
                                                        />
                                                        <span className="text-sm font-medium text-zinc-700 truncate select-none">
                                                            {suburb.name}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                            
                                            {filteredSuburbs.length === 0 && (
                                                <div className="col-span-full py-8 text-center text-zinc-500 text-sm">
                                                    No suburbs found matching your search.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 bg-white border-t border-zinc-100 flex justify-end gap-3 rounded-b-xl">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={processing} className="bg-zinc-900 text-white hover:bg-black">
                                    Save Changes
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>

                <ConfirmModal
                    isOpen={isDeleteModalOpen}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onConfirm={handleDelete}
                    title="Delete Pickup Area"
                    description={`Are you sure you want to delete ${zoneToDelete?.name}? This action cannot be undone.`}
                    confirmText="Delete Pickup Area"
                    variant="destructive"
                />
            </SettingsLayout>
        </AppLayout>
    );
}
