import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import {
    Warehouse,
    Camera,
    MapPin,
    Package,
    Loader2,
    CheckCircle2,
    FileText,
    X,
    Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

interface Props {
    open: boolean;
    onClose: () => void;
    runsheetId: number;
    runsheetNumber?: string;
    collectedCount: number;
    totalStopsCount: number;
}

export default function WarehouseDropModal({
    open,
    onClose,
    runsheetId,
    runsheetNumber,
    collectedCount,
    totalStopsCount,
}: Props) {
    const [bay, setBay] = useState('Bay 1');
    const [customBay, setCustomBay] = useState('');
    const [notes, setNotes] = useState('');
    const [photo, setPhoto] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhoto(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const removePhoto = () => {
        setPhoto(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const finalBay = bay === 'Custom' ? customBay.trim() : bay;

        const formData = new FormData();
        if (finalBay) {
            formData.append('warehouse_drop_bay', finalBay);
        }
        if (notes.trim()) {
            formData.append('warehouse_drop_notes', notes.trim());
        }
        if (photo) {
            formData.append('warehouse_drop_photo', photo);
        }

        router.post(
            `/picker/runsheet/${runsheetId}/initialize-warehouse-drop`,
            formData,
            {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    toast.success('Warehouse drop-off initiated! Intake team notified.');
                    onClose();
                },
                onError: (errors) => {
                    toast.error(
                        errors.warehouse_drop_bay ||
                            errors.warehouse_drop_notes ||
                            errors.warehouse_drop_photo ||
                            'Failed to initiate warehouse drop-off.'
                    );
                },
                onFinish: () => setSubmitting(false),
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary dark:bg-brand-primary/20">
                        <Warehouse className="size-6" />
                    </div>
                    <DialogTitle className="text-center font-serif text-lg font-black text-brand-navy dark:text-white">
                        Initiate Warehouse Drop-off
                    </DialogTitle>
                    <DialogDescription className="text-center text-xs text-slate-500 dark:text-slate-400">
                        Handing over collected freight to the depot for intake inspection.
                    </DialogDescription>
                </DialogHeader>

                {/* Summary Card */}
                <div className="grid grid-cols-2 gap-3 rounded-2xl border border-brand-sand/60 bg-slate-50/70 p-3.5 text-center dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5 text-brand-primary font-black text-base">
                            <Package className="size-4" />
                            <span>{collectedCount}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Collected Boxes
                        </span>
                    </div>

                    <div className="flex flex-col items-center border-l border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-1.5 text-emerald-600 font-black text-base dark:text-emerald-400">
                            <CheckCircle2 className="size-4" />
                            <span>{totalStopsCount}</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Stops Completed
                        </span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-2 space-y-4">
                    {/* Bay / Dock Selector */}
                    <div>
                        <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
                            Unloading Bay / Dock
                        </label>
                        <select
                            value={bay}
                            onChange={(e) => setBay(e.target.value)}
                            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-brand-primary focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                        >
                            <option value="Bay 1">Bay 1 (Main Inward Dock)</option>
                            <option value="Bay 2">Bay 2 (Truck Unloading)</option>
                            <option value="Bay 3">Bay 3 (Express Staging)</option>
                            <option value="Loading Dock">Loading Dock A</option>
                            <option value="Cage Staging">Cage Staging / Security Bay</option>
                            <option value="Custom">Other (Specify Custom Location)</option>
                        </select>

                        {bay === 'Custom' && (
                            <input
                                type="text"
                                value={customBay}
                                onChange={(e) => setCustomBay(e.target.value)}
                                placeholder="e.g. Pallet Rack 4 / Roller Section B"
                                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-brand-primary focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                                required
                            />
                        )}
                    </div>

                    {/* Driver Handover Notes */}
                    <div>
                        <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
                            Driver Notes (Optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="e.g. 2 oversized boxes stacked on Pallet A, cash envelope handed to supervisor."
                            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-primary focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                        />
                    </div>

                    {/* Optional Handover Photo */}
                    <div>
                        <label className="block text-xs font-black text-slate-700 dark:text-slate-300">
                            Unloading Proof Photo (Optional)
                        </label>

                        {previewUrl ? (
                            <div className="relative mt-2 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                                <img
                                    src={previewUrl}
                                    alt="Drop-off Preview"
                                    className="h-36 w-full object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={removePhoto}
                                    className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-slate-900/80 text-white hover:bg-rose-600 transition-colors"
                                >
                                    <X className="size-4" />
                                </button>
                            </div>
                        ) : (
                            <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-4 transition-colors hover:border-brand-primary hover:bg-slate-100/60 dark:border-slate-800 dark:bg-slate-900/40">
                                <Camera className="size-6 text-slate-400" />
                                <span className="mt-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                                    Take photo of unloaded freight
                                </span>
                                <span className="text-[10px] text-slate-400">
                                    Tap to open camera or browse files
                                </span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handlePhotoChange}
                                    className="hidden"
                                />
                            </label>
                        )}
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex items-center gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || collectedCount === 0}
                            className="btn-primary flex-[2] flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-wider shadow-sm disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    <span>Submitting...</span>
                                </>
                            ) : (
                                <>
                                    <Warehouse className="size-4" />
                                    <span>Confirm Drop-Off</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
