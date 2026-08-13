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
                        disabled={isAssigning || !batchId}
                        className="h-9 rounded-lg px-4 text-xs font-medium bg-brand-rust text-white hover:bg-brand-rust/90 transition-colors shadow-2xs"
                    >
                        {isAssigning ? 'Assigning...' : 'Assign Batch'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
