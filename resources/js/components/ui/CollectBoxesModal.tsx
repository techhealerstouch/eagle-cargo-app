import { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { Camera, CheckCircle, Hash, Package, X, QrCode } from 'lucide-react';

interface CollectBoxesModalProps {
    open: boolean;
    onClose: () => void;
    boxes: { id: number; tracking_number: string; serial_number?: string | null }[];
    runsheetId: number;
}

export default function CollectBoxesModal({
    open,
    onClose,
    boxes,
    runsheetId,
}: CollectBoxesModalProps) {
    const { errors } = usePage().props as { errors: Record<string, string> };

    const [pickupProof, setPickupProof] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Reset state when modal opens/closes or boxes change
    useEffect(() => {
        if (open) {
            setPickupProof(null);
            setSubmitting(false);
        }
    }, [open, boxes]);

    const canSubmit = pickupProof !== null && !submitting;

    const handleSubmit = () => {
        if (!canSubmit) return;

        setSubmitting(true);

        const payload: Record<string, any> = {
            pickup_proof: pickupProof,
        };

        // Flatten boxes array for FormData compatibility
        boxes.forEach((box, i) => {
            payload[`boxes[${i}][id]`] = box.id;
        });

        router.post(`/picker/runsheet/${runsheetId}/collect-boxes`, payload, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setPickupProof(null);
                setSubmitting(false);
                onClose();
            },
            onFinish: () => setSubmitting(false),
        });
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-brand-sand/50 bg-white shadow-2xl flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    type="button"
                    onClick={onClose}
                    title="Close modal"
                    className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-zinc-500 shadow-sm transition-all hover:bg-zinc-100 hover:text-zinc-800"
                >
                    <X className="size-4" />
                </button>

                {/* Content */}
                <div className="flex flex-col h-full overflow-hidden">
                    {/* Header */}
                    <div className="px-6 pt-5 pb-3 shrink-0">
                        <div className="mb-1 flex items-center gap-2">
                            <Package className="size-5 text-brand-primary" />
                            <h3 className="font-serif text-xl font-black text-brand-navy">
                                Collect Boxes
                            </h3>
                        </div>
                        <p className="text-sm text-brand-text-mid">
                            Verify the pre-allocated serial numbers and upload a pickup proof photo.
                        </p>
                    </div>

                    {/* Scrollable Box list */}
                    <div className="px-6 overflow-y-auto">
                        <div className="mb-4 rounded-xl border border-brand-sand/50 divide-y divide-brand-warm/50 bg-brand-sand/5">
                            {boxes.map((box) => (
                                <div key={box.id} className="px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="size-8 rounded-full bg-brand-primary/10 flex items-center justify-center">
                                            <Hash className="size-4 text-brand-primary" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] uppercase font-bold tracking-wider text-brand-text/50">Tracking No.</span>
                                            <span className="text-sm font-bold text-brand-navy">
                                                {box.tracking_number}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[10px] uppercase font-bold tracking-wider text-brand-text/50">Serial Number</span>
                                            {box.serial_number ? (
                                                <span className="text-sm font-mono font-medium text-brand-primary bg-brand-primary/5 px-2 py-0.5 rounded border border-brand-primary/20">
                                                    {box.serial_number}
                                                </span>
                                            ) : (
                                                <span className="text-xs italic text-brand-text/40">Not allocated</span>
                                            )}
                                        </div>
                                        <QrCode className="size-4 text-brand-text/30" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Fixed Footer Area */}
                    <div className="px-6 pb-6 shrink-0">
                        {/* Pickup Proof Photo */}
                        <div className="mb-5">
                            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-brand-text-mid">
                                Pickup Proof Photo <span className="text-red-500">*</span>
                            </label>
                            <div className="group relative h-45 w-full rounded-2xl border-2 border-dashed border-brand-sand/50 bg-brand-warm/10 flex flex-col items-center justify-center overflow-hidden transition-all hover:border-brand-navy/30">
                                {pickupProof ? (
                                    <div className="relative w-full h-full">
                                        <img
                                            src={URL.createObjectURL(pickupProof)}
                                            className="w-full h-full object-cover"
                                            alt="Pickup proof preview"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setPickupProof(null)}
                                            title="Remove pickup proof photo"
                                            className="absolute top-3 right-3 size-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-all active:scale-90"
                                        >
                                            <X className="size-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="p-3 rounded-2xl bg-white shadow-lg mb-2 group-hover:scale-110 transition-transform">
                                            <Camera className="size-6 text-brand-navy" />
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-brand-text">
                                            Snap Pickup Photo
                                        </p>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) =>
                                                setPickupProof(e.target.files?.[0] ?? null)
                                            }
                                            className="absolute inset-0 cursor-pointer opacity-0"
                                            title="Upload pickup proof photo"
                                        />
                                    </>
                                )}
                            </div>
                            {errors.pickup_proof && (
                                <p className="mt-1 text-xs font-bold text-red-600">
                                    {errors.pickup_proof}
                                </p>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="flex-1 rounded-2xl border border-brand-sand bg-white px-4 py-3 text-xs font-bold uppercase tracking-widest text-brand-text-mid transition-all hover:bg-zinc-50 active:scale-95"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!canSubmit}
                                className="flex flex-2 items-center justify-center gap-2 rounded-2xl btn-primary px-6 py-3 text-xs font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-60"
                            >
                                {submitting ? (
                                    <>
                                        <span className="animate-spin">⏳</span>
                                        Submitting…
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="size-4" />
                                        Confirm Collection
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
