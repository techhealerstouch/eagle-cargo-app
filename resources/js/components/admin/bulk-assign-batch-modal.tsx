import { router } from '@inertiajs/react';
import { AlertTriangle } from 'lucide-react';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface BulkAssignBatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedIds: number[];
    selectedBoxes: any[];
    isGlobalSelection: boolean;
    activeBatches: any[];
    filters: any;
    onSuccessCallback?: () => void;
}

export default function BulkAssignBatchModal({
    isOpen,
    onClose,
    selectedIds,
    selectedBoxes,
    isGlobalSelection,
    activeBatches = [],
    filters,
    onSuccessCallback,
}: BulkAssignBatchModalProps) {
    const [batchId, setBatchId] = useState('');
    const [isAssigning, setIsAssigning] = useState(false);

    const ineligibleBoxes = React.useMemo(() => {
        if (!selectedBoxes || isGlobalSelection) return [];
        return selectedBoxes.filter((box) => {
            if (box.booking?.status === 'cancelled') return true;
            if (box.booking?.payment_status !== 'paid' && box.booking?.payment_status !== 'cash_collected') return true;
            
            const declStatus = box.booking?.declaration_form_status || '';
            if (!['submitted_online', 'physical_copy_received'].includes(declStatus)) {
                const hasData = box.booking?.declaration_data && Object.keys(box.booking.declaration_data).length > 0;
                const hasPath = !!box.booking?.declaration_form_path;
                if (!hasData && !hasPath) return true;
            }
            return false;
        });
    }, [selectedBoxes, isGlobalSelection]);

    const alreadyAssignedBoxes = React.useMemo(() => {
        if (!selectedBoxes || isGlobalSelection) return [];
        return selectedBoxes.filter(box => box.batch_id !== null);
    }, [selectedBoxes, isGlobalSelection]);

    const eligibleBoxesCount = React.useMemo(() => {
        if (isGlobalSelection) return null;
        const skippedIds = new Set([
            ...ineligibleBoxes.map(b => b.id),
            ...alreadyAssignedBoxes.map(b => b.id)
        ]);
        return selectedIds.length - skippedIds.size;
    }, [selectedIds, ineligibleBoxes, alreadyAssignedBoxes, isGlobalSelection]);

    useEffect(() => {
        if (isOpen) {
            setBatchId(activeBatches[0]?.id?.toString() || '');
        }
    }, [isOpen, activeBatches]);

    const handleAssign = () => {
        if (!batchId) return;

        setIsAssigning(true);
        router.post('/admin/boxes/bulk-assign-to-batch', {
            ids: selectedIds,
            select_all: isGlobalSelection,
            batch_id: parseInt(batchId, 10),
            status: filters.status || undefined,
            search: filters.search || undefined,
            area_id: filters.area_id || undefined,
        }, {
            onSuccess: (page) => {
                onClose();
                if (!page.props.flash?.error) {
                    onSuccessCallback?.();
                }
            },
            onError: () => {
                // validation errors handled by forms/inertia, flash handled globally
            },
            onFinish: () => setIsAssigning(false),
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md bg-white border-zinc-200/80 rounded-xl p-0 overflow-hidden shadow-2xl">
                <div className="bg-zinc-50 border-b border-zinc-200/80 p-5">
                    <DialogHeader>
                        <DialogTitle className="font-sans text-lg font-semibold text-zinc-900">Assign Boxes to Batch</DialogTitle>
                        <DialogDescription className="text-zinc-500 font-sans text-xs mt-0.5">
                            Bulk assign {isGlobalSelection ? 'all matching' : `${selectedIds.length}`} box(es) to a shipment container batch.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-5 space-y-4 text-xs">
                    {isGlobalSelection ? (
                        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                            <AlertTriangle className="size-4.5 text-amber-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs font-bold text-amber-900">Eligibility Check</p>
                                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                                    Boxes with missing customs declarations, unpaid balances, or that are already assigned to a batch will be automatically skipped during assignment.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {alreadyAssignedBoxes.length > 0 && (
                                <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-4">
                                    <AlertTriangle className="size-4.5 text-rose-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-rose-900">
                                            {alreadyAssignedBoxes.length} {alreadyAssignedBoxes.length === 1 ? 'box' : 'boxes'} already assigned
                                        </p>
                                        <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                                            The following boxes are already assigned to a batch and will be skipped:
                                            <br />
                                            <span className="font-mono mt-1 block">
                                                {alreadyAssignedBoxes.map(b => b.tracking_number).join(', ')}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            )}
                            
                            {ineligibleBoxes.length > 0 && (
                                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                                    <AlertTriangle className="size-4.5 text-amber-600 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-amber-900">
                                            {ineligibleBoxes.length} {ineligibleBoxes.length === 1 ? 'box' : 'boxes'} will be skipped
                                        </p>
                                        <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                                            The following boxes are missing customs declarations or have unpaid balances, and will not be assigned:
                                            <br />
                                            <span className="font-mono mt-1 block">
                                                {ineligibleBoxes.map(b => b.tracking_number).join(', ')}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="bulk-batch" className="text-xs font-semibold text-zinc-700">
                            Select Shipment Batch
                        </Label>
                        <select
                            id="bulk-batch"
                            title="Select batch"
                            className="flex h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                            value={batchId}
                            onChange={(e) => setBatchId(e.target.value)}
                        >
                            {activeBatches.map((batch) => (
                                <option key={batch.id} value={batch.id}>
                                    {batch.batch_number} ({batch.status})
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-zinc-400 italic">
                            * Assigning boxes to a batch will automatically advance their tracking status to In Transit.
                        </p>
                    </div>
                </div>

                <DialogFooter className="bg-zinc-50 border-t border-zinc-200/80 p-4 flex flex-row items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isAssigning}
                        className="h-9 rounded-lg px-4 text-xs font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleAssign}
                        disabled={isAssigning || !batchId || (eligibleBoxesCount !== null && eligibleBoxesCount === 0)}
                        className="h-9 rounded-lg px-4 text-xs font-medium bg-brand-rust text-white hover:bg-brand-rust/90 transition-colors shadow-2xs"
                    >
                        {isAssigning 
                            ? 'Assigning...' 
                            : (eligibleBoxesCount !== null 
                                ? `Assign ${eligibleBoxesCount} ${eligibleBoxesCount === 1 ? 'Box' : 'Boxes'}` 
                                : 'Assign Batch')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
