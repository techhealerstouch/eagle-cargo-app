import React from 'react';
import { router } from '@inertiajs/react';
import { ClipboardList, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface DeclarationPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookingId: number | string | null;
}

export default function DeclarationPromptModal({
    isOpen,
    onClose,
    bookingId,
}: DeclarationPromptModalProps) {
    const handleProceed = () => {
        if (bookingId) {
            router.visit(`/track/declaration/${bookingId}`);
        }
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md gap-0 p-0 overflow-hidden border-none rounded-3xl shadow-2xl bg-white dark:bg-zinc-950">
                <div className="p-8 pb-6 font-sans">
                    <div className="flex flex-col items-center text-center">
                        {/* Success Badge */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded-full mb-6">
                            <Check className="size-3.5 stroke-[2.5]" />
                            Booking Successful
                        </div>

                        {/* Premium Icon Badge */}
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 mb-5 shadow-xs">
                            <ClipboardList className="size-6 text-brand-rust" />
                        </div>
                        
                        <DialogHeader className="space-y-2">
                            <DialogTitle className="font-sans text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                Customs Declaration Required
                            </DialogTitle>
                            <DialogDescription className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-sm pt-1">
                                To ensure smooth customs clearance and avoid any shipment delays, please fill up the declaration form for your balikbayan box.
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                </div>

                <DialogFooter className="p-8 pt-0 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        className="w-full sm:w-auto h-11 px-5 rounded-xl text-sm font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors border-0 shadow-none focus-visible:ring-0"
                    >
                        Skip for Now
                    </Button>
                    <Button
                        type="button"
                        onClick={handleProceed}
                        className="w-full sm:w-auto h-11 px-6 rounded-xl text-sm font-semibold text-white shadow-md shadow-brand-rust/10 transition-all hover:brightness-105 active:scale-[0.98] bg-brand-rust flex items-center justify-center gap-2 border-0"
                    >
                        Proceed to Form <ArrowRight className="size-4" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

