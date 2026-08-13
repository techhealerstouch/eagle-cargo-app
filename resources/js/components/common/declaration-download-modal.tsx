import React, { useState } from 'react';
import { FileText, Plus, Minus, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface DeclarationDownloadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DeclarationDownloadModal({
    isOpen,
    onClose,
}: DeclarationDownloadModalProps) {
    const [boxCount, setBoxCount] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(false);

    const handleDownload = () => {
        setLoading(true);
        const url = `/declaration-form/blank?boxes=${boxCount}`;
        window.open(url, '_blank');
        setLoading(false);
        onClose();
    };

    const handleIncrement = () => {
        setBoxCount((prev) => Math.min(30, prev + 1));
    };

    const handleDecrement = () => {
        setBoxCount((prev) => Math.max(1, prev - 1));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseInt(e.target.value, 10);

        if (isNaN(val)) {
            setBoxCount(1);
        } else {
            setBoxCount(Math.max(1, Math.min(30, val)));
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md gap-0 p-0 overflow-hidden border-none rounded-3xl shadow-2xl bg-white dark:bg-zinc-950">
                <div className="p-6 sm:p-8 font-sans">
                    {/* Icon & Header */}
                    <div className="flex flex-col items-center text-center mb-6">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-rust/10 border border-brand-rust/20 mb-4 shadow-xs">
                            <FileText className="size-6 text-brand-rust" />
                        </div>
                        
                        <DialogHeader className="space-y-1.5 text-center">
                            <DialogTitle className="font-sans text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-50 tracking-tight">
                                Download Declaration Form
                            </DialogTitle>
                            <DialogDescription className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-xs">
                                Select how many box declaration pages you need in your PDF download.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    {/* Unified Quantity Control */}
                    <div className="space-y-4">
                        {/* Quick Preset Pills */}
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 text-center">
                                Number of Boxes
                            </span>
                            <div className="grid grid-cols-5 gap-1.5 p-1 bg-zinc-100/80 dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800">
                                {[1, 2, 3, 4].map((num) => {
                                    const isActive = boxCount === num;
                                    return (
                                        <button
                                            key={num}
                                            type="button"
                                            onClick={() => setBoxCount(num)}
                                            className={`py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                                                isActive
                                                    ? 'bg-white dark:bg-zinc-800 text-brand-rust shadow-xs border border-zinc-200/80 dark:border-zinc-700'
                                                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                                            }`}
                                        >
                                            {num}
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (boxCount <= 4) setBoxCount(5);
                                    }}
                                    className={`py-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                                        boxCount >= 5
                                            ? 'bg-white dark:bg-zinc-800 text-brand-rust shadow-xs border border-zinc-200/80 dark:border-zinc-700'
                                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                                    }`}
                                >
                                    5+
                                </button>
                            </div>
                        </div>

                        {/* Fine-tune Stepper */}
                        <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200/60 dark:border-zinc-800">
                            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                                Custom quantity
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleDecrement}
                                    disabled={boxCount <= 1}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-semibold transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                                >
                                    <Minus className="size-3.5" />
                                </button>
                                <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={boxCount}
                                    onChange={handleInputChange}
                                    className="w-12 h-8 text-center font-semibold text-sm text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-rust/40"
                                />
                                <button
                                    type="button"
                                    onClick={handleIncrement}
                                    disabled={boxCount >= 30}
                                    className="h-8 w-8 flex items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-semibold transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                                >
                                    <Plus className="size-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* PDF Summary Note */}
                        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-brand-rust/5 dark:bg-brand-rust/10 border border-brand-rust/15 text-xs text-zinc-600 dark:text-zinc-300">
                            <FileCheck className="size-4 text-brand-rust shrink-0" />
                            <span>
                                Will generate a PDF with <strong>{boxCount} {boxCount === 1 ? 'box page' : 'box pages'}</strong>.
                            </span>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <DialogFooter className="p-6 sm:p-8 pt-0 flex flex-col-reverse sm:flex-row gap-2.5 sm:justify-end">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        disabled={loading}
                        className="w-full sm:w-auto h-11 px-5 rounded-xl text-sm font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors border-0"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleDownload}
                        disabled={loading}
                        className="w-full sm:w-auto h-11 px-6 rounded-xl text-sm font-semibold text-white shadow-md shadow-brand-rust/15 transition-all hover:brightness-105 active:scale-[0.98] bg-brand-rust border-0"
                    >
                        {loading ? 'Generating...' : 'Download Form'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

