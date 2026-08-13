import { Head, Link, useForm } from '@inertiajs/react';
import { CheckCircle2, MapPin, Pencil, Plus, ArrowLeft, ShieldCheck, Flag, Activity, Navigation, Warehouse } from 'lucide-react';
import { useState } from 'react';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import admin from '@/routes/admin';

interface Area {
    id: number;
    name: string;
}

interface Milestone {
    id: number;
    area_id: number;
    name: string;
    location: string | null;
    sequence_order: number;
    is_final_delivery: boolean;
    is_warehouse_handoff: boolean;
}

interface Props {
    area: Area;
    milestones: Milestone[];
}

export default function AreaMilestonesIndex({ area, milestones }: Props) {
    const { t } = useTranslations();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);

    const breadcrumbs = [
        { title: t('ui.common.settings', 'Settings'), href: admin.areas.index().url },
        { title: t('ui.area_milestones.breadcrumbs.areas', 'Delivery Areas'), href: admin.areas.index().url },
        { title: t('ui.area_milestones.breadcrumbs.nodes', ':area Route Stops', { area: area.name }), href: '#' },
    ];

    const { data, setData, post, put, processing, reset, errors } = useForm({
        name: '',
        location: '',
        sequence_order: (milestones.length + 1).toString(),
        is_final_delivery: false,
        is_warehouse_handoff: false,
    });

    const openCreateDialog = () => {
        setEditingMilestone(null);
        reset();
        setData('sequence_order', (milestones.length + 1).toString());
        setIsDialogOpen(true);
    };

    const openEditDialog = (milestone: Milestone) => {
        setEditingMilestone(milestone);
        setData({
            name: milestone.name,
            location: milestone.location || '',
            sequence_order: milestone.sequence_order.toString(),
            is_final_delivery: !!milestone.is_final_delivery,
            is_warehouse_handoff: !!milestone.is_warehouse_handoff,
        });
        setIsDialogOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (editingMilestone) {
            put(admin.areas.milestones.update(editingMilestone.id).url, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    reset();
                },
            });
        } else {
            post(admin.areas.milestones.store(area.id).url, {
                onSuccess: () => {
                    setIsDialogOpen(false);
                    reset();
                },
            });
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <SettingsLayout>
                <Head title={t('ui.area_milestones.head_title', ':area Route Stops | Admin', { area: area.name })} />

                <div className="space-y-10 p-1">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b border-brand-warm/20 pb-8">
                        <div className="flex items-center gap-4">
                            <Link
                                href={admin.areas.index().url}
                                className="mt-1 rounded-xl p-2.5 bg-card border border-border text-muted-foreground transition-all hover:bg-muted/50 hover:text-foreground shadow-sm"
                            >
                                <ArrowLeft className="size-5" />
                            </Link>
                            <Heading
                                eyebrow={t('ui.area_milestones.eyebrow', 'Route Setup')}
                                title={t('ui.area_milestones.title', ':area Route Stops', { area: area.name })}
                                description={t('ui.area_milestones.description', 'Define route stops and delivery sequence for shipments in :area.', { area: area.name })}
                            />
                        </div>
                        <button
                            onClick={openCreateDialog}
                            className="bg-brand-rust text-white hover:opacity-95 px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-brand-rust/20 transition-all active:scale-95 flex items-center gap-3"
                        >
                            <Plus className="size-4" /> {t('ui.area_milestones.add_stop', 'Add Stop')}
                        </button>
                    </div>

                    <div className="space-y-6 relative ml-6">
                        <div className="absolute top-0 bottom-0 left-[-2rem] w-[2px] bg-brand-warm/20 hidden md:block"></div>

                        {milestones.length > 0 ? (
                            milestones.map((milestone) => (
                                <div
                                    key={milestone.id}
                                    className="group relative flex items-center gap-6 p-5 rounded-2xl border border-brand-warm/20 bg-white shadow hover:shadow-md transition-all hover:border-brand-rust/30"
                                >
                                    <div className="absolute left-[-2.3rem] top-1/2 -translate-y-1/2 size-3 rounded-full bg-white border-[2px] border-brand-rust z-10 shadow-sm transition-transform group-hover:scale-125 hidden md:block"></div>

                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-warm/10 text-brand-rust font-serif text-lg font-black border border-brand-rust/10 shadow-inner">
                                        {milestone.sequence_order.toString().padStart(2, '0')}
                                    </div>

                                    <div className="flex-1">
                                        <div className="flex items-center gap-4">
                                            <h4 className="font-serif text-lg font-bold text-zinc-900 tracking-tight">{milestone.name}</h4>
                                            {milestone.is_final_delivery && (
                                                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-brand-secondary/10 text-brand-rust border border-brand-secondary/20 shadow-sm animate-pulse">
                                                    <Flag className="size-3" /> {t('ui.area_milestones.final_stop_badge', 'Final Stop')}
                                                </span>
                                            )}
                                            {milestone.is_warehouse_handoff && (
                                                <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-700 border border-blue-500/20 shadow-sm">
                                                    <Warehouse className="size-3" /> {t('ui.area_milestones.handoff_badge', 'Warehouse Handoff')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-3">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-brand-warm/5 px-3 py-1 rounded-lg border border-brand-warm/10">
                                                <Navigation className="size-3 text-brand-rust/50" />
                                                {milestone.location || t('ui.area_milestones.location_not_set', 'Location not specified')}
                                            </div>
                                            <div className="h-1 w-1 rounded-full bg-brand-warm/40"></div>
                                            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{t('ui.area_milestones.area_badge', ':area Area', { area: area.name })}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                        <button
                                            onClick={() => openEditDialog(milestone)}
                                            className="p-3 rounded-xl border border-brand-warm/20 hover:bg-brand-rust hover:text-white transition-all text-brand-rust shadow-sm"
                                            title={t('ui.area_milestones.edit_stop_title', 'Edit stop')}
                                        >
                                            <Pencil className="size-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-2xl bg-brand-warm/[0.03] border-brand-warm/10 relative overflow-hidden">
                                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,var(--color-brand-rust)_0%,transparent_70%)]"></div>
                                <div className="size-16 rounded-xl bg-brand-warm/10 flex items-center justify-center mb-6 border border-brand-warm/20 shadow-inner">
                                    <MapPin className="size-6 text-brand-rust/30" />
                                </div>
                                <p className="text-brand-rust/60 text-lg font-serif italic text-center max-w-sm font-bold tracking-tight">{t('ui.area_milestones.empty_title', 'No route stops added yet.')}</p>
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mt-3">{t('ui.area_milestones.empty_subtitle', 'Add your first route stop to begin planning.')}</p>
                                <button
                                    onClick={openCreateDialog}
                                    className="mt-10 bg-white border-2 border-brand-rust/20 text-brand-rust px-8 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-brand-rust hover:text-white transition-all shadow-xl shadow-brand-rust/5 active:scale-95"
                                >
                                    {t('ui.area_milestones.empty_cta', 'Add First Stop')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="sm:max-w-4xl lg:max-w-5xl border-brand-warm/30 rounded-[2.5rem] p-0 overflow-hidden bg-white shadow-2xl">
                        <form onSubmit={handleSubmit}>
                            <div className="bg-brand-warm/5 p-8 border-b border-brand-warm/10 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-1 bg-brand-rust rounded-full"></div>
                                    <h2 className="font-serif text-2xl font-bold text-brand-rust uppercase tracking-tight">
                                        {editingMilestone
                                            ? t('ui.area_milestones.dialog.edit_title', 'Edit Route Stop')
                                            : t('ui.area_milestones.dialog.create_title', 'Add Route Stop')}
                                    </h2>
                                </div>
                                <div className="p-3 bg-white rounded-2xl border border-brand-warm/20 shadow-sm">
                                    <Activity className="size-5 text-brand-rust" />
                                </div>
                            </div>

                            <div className="p-10 space-y-8">
                                <div className="grid grid-cols-4 gap-8">
                                    <div className="col-span-3 space-y-3">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">{t('ui.area_milestones.dialog.stop_name', 'Stop Name')}</Label>
                                        <div className="relative">
                                            <Activity className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                            <Input
                                                value={data.name}
                                                onChange={(e) => setData('name', e.target.value)}
                                                placeholder={t('ui.area_milestones.dialog.stop_name_placeholder', 'e.g. Main Sorting Hub')}
                                                className="h-12 rounded-xl border-brand-warm/20 bg-white pl-11 pr-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all"
                                                required
                                            />
                                        </div>
                                        {errors.name && <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.name}</p>}
                                    </div>
                                    <div className="space-y-3">
                                        <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">{t('ui.area_milestones.dialog.stop_order', 'Stop Order')}</Label>
                                        <Input
                                            type="number"
                                            value={data.sequence_order}
                                            onChange={(e) => setData('sequence_order', e.target.value)}
                                            className="h-12 rounded-xl border-brand-warm/20 bg-white px-4 text-center font-mono font-black text-brand-rust focus:ring-brand-rust/20 focus:border-brand-rust transition-all"
                                            required
                                        />
                                        {errors.sequence_order && <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.sequence_order}</p>}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">{t('ui.area_milestones.dialog.stop_location', 'Stop Location')}</Label>
                                    <div className="relative">
                                        <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-brand-rust/40" />
                                        <Input
                                            value={data.location}
                                            onChange={(e) => setData('location', e.target.value)}
                                            placeholder={t('ui.area_milestones.dialog.stop_location_placeholder', 'e.g. Near Main Gate, Dock 2')}
                                            className="h-12 rounded-xl border-brand-warm/20 bg-white pl-11 pr-4 font-bold focus:ring-brand-rust/20 focus:border-brand-rust transition-all"
                                        />
                                    </div>
                                    {errors.location && <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.location}</p>}
                                </div>

                                <div className="flex items-center gap-5 p-6 rounded-[2rem] bg-brand-warm/[0.03] border-2 border-brand-warm/10 group cursor-pointer hover:border-brand-rust/20 transition-all" onClick={() => setData('is_final_delivery', !data.is_final_delivery)}>
                                    <Checkbox
                                        id="is_final"
                                        checked={data.is_final_delivery}
                                        onCheckedChange={(checked) => setData('is_final_delivery', !!checked)}
                                        className="size-6 rounded-lg border-2 border-brand-rust data-[state=checked]:bg-brand-rust data-[state=checked]:border-brand-rust shadow-sm transition-all"
                                    />
                                    <div className="space-y-1">
                                        <label
                                            htmlFor="is_final"
                                            className="text-[11px] font-black uppercase tracking-[0.25em] text-brand-rust leading-none cursor-pointer"
                                        >
                                            {t('ui.area_milestones.dialog.final_delivery_label', 'Final delivery stop')}
                                        </label>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">{t('ui.area_milestones.dialog.final_delivery_desc', 'Mark this stop as the final delivery point for this area.')}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-5 p-6 rounded-[2rem] bg-blue-500/[0.03] border-2 border-blue-500/10 group cursor-pointer hover:border-blue-500/30 transition-all" onClick={() => setData('is_warehouse_handoff', !data.is_warehouse_handoff)}>
                                    <Checkbox
                                        id="is_warehouse_handoff"
                                        checked={data.is_warehouse_handoff}
                                        onCheckedChange={(checked) => setData('is_warehouse_handoff', !!checked)}
                                        className="size-6 rounded-lg border-2 border-blue-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 shadow-sm transition-all"
                                    />
                                    <div className="space-y-1">
                                        <label
                                            htmlFor="is_warehouse_handoff"
                                            className="text-[11px] font-black uppercase tracking-[0.25em] text-blue-700 leading-none cursor-pointer"
                                        >
                                            {t('ui.area_milestones.dialog.warehouse_handoff_label', 'Warehouse handoff milestone')}
                                        </label>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">{t('ui.area_milestones.dialog.warehouse_handoff_desc', 'Use this milestone to mark boxes as ready for courier assignment.')}</p>
                                    </div>
                                </div>

                                {errors.is_warehouse_handoff && (
                                    <p className="text-[11px] font-bold text-red-500 ml-1 uppercase tracking-wider">{errors.is_warehouse_handoff}</p>
                                )}
                            </div>

                            <div className="bg-brand-warm/5 p-8 flex justify-end gap-4 border-t border-brand-warm/10">
                                <button
                                    type="button"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="px-8 h-12 flex items-center justify-center rounded-xl border-2 border-brand-warm/20 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-brand-warm/5 transition-all text-muted-foreground"
                                >
                                    {t('ui.area_milestones.dialog.cancel', 'Cancel')}
                                </button>
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    variant="success"
                                    className="px-10 h-12 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-3"
                                >
                                    <ShieldCheck className="size-4" />
                                    {editingMilestone
                                        ? t('ui.area_milestones.dialog.edit_submit', 'Save Changes')
                                        : t('ui.area_milestones.dialog.create_submit', 'Add Stop')}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </SettingsLayout>
        </AppLayout>
    );
}

