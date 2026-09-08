import { router } from '@inertiajs/react';
import {
    AlertOctagon,
    AlertTriangle,
    CheckCircle2,
    CreditCard,
    FileText,
    Info,
    Layers,
    Package,
    XCircle,
} from 'lucide-react';
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';

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

const IN_TRANSIT_STATUSES = [
    'in_transit',
    'arrived',
    'for_checking_unloading',
    'unloaded_manila',
    'for_delivery_scheduling',
    'en_route_roro',
    'out_for_delivery',
];

function TruncatedBoxChips({
    boxes,
    color = 'zinc',
}: {
    boxes: any[];
    color?: 'rose' | 'amber' | 'zinc' | 'sky' | 'red';
}) {
    const [expanded, setExpanded] = useState(false);
    const initialLimit = 8;
    const hasMore = boxes.length > initialLimit;
    const displayed = expanded ? boxes : boxes.slice(0, initialLimit);
    const remainingCount = boxes.length - initialLimit;

    const colorClasses = {
        rose: 'bg-rose-100/90 text-rose-900 border-rose-200/90 hover:bg-rose-200/80',
        amber: 'bg-amber-100/90 text-amber-900 border-amber-200/90 hover:bg-amber-200/80',
        zinc: 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200/80',
        sky: 'bg-sky-100/90 text-sky-900 border-sky-200/90 hover:bg-sky-200/80',
        red: 'bg-red-100/90 text-red-900 border-red-200/90 hover:bg-red-200/80',
    }[color];

    return (
        <div className="mt-2">
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                {displayed.map((b) => (
                    <span
                        key={b.id || b.tracking_number}
                        className={`inline-flex items-center px-2 py-0.5 rounded-md font-mono text-[11px] font-medium border transition-colors shadow-2xs ${colorClasses}`}
                    >
                        {b.tracking_number}
                    </span>
                ))}
            </div>
            {hasMore && (
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    className="text-[11px] font-semibold mt-1.5 underline hover:opacity-80 transition-opacity cursor-pointer text-zinc-600 dark:text-zinc-400"
                >
                    {expanded ? 'Show fewer boxes' : `+${remainingCount} more boxes...`}
                </button>
            )}
        </div>
    );
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
    const [confirmInTransit, setConfirmInTransit] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setBatchId(activeBatches[0]?.id?.toString() || '');
            setConfirmInTransit(false);
        }
    }, [isOpen, activeBatches]);

    const selectedBatch = useMemo(() => {
        return activeBatches.find((b) => b.id?.toString() === batchId);
    }, [activeBatches, batchId]);

    const parsedBatchId = useMemo(() => {
        return parseInt(batchId, 10);
    }, [batchId]);

    // Categorize issues
    const {
        cancelledBoxes,
        unpaidBoxes,
        missingDeclBoxes,
        alreadyInBatchBoxes,
        eligibleBoxes,
        inTransitOrBeyondBoxes,
    } = useMemo(() => {
        if (!selectedBoxes || isGlobalSelection) {
            return {
                cancelledBoxes: [],
                unpaidBoxes: [],
                missingDeclBoxes: [],
                alreadyInBatchBoxes: [],
                eligibleBoxes: [],
                inTransitOrBeyondBoxes: [],
            };
        }

        const cancelled: any[] = [];
        const unpaid: any[] = [];
        const missingDecl: any[] = [];
        const inBatch: any[] = [];
        const eligible: any[] = [];
        const inTransit: any[] = [];

        selectedBoxes.forEach((box) => {
            if (box.booking?.status === 'cancelled') {
                cancelled.push(box);
                return;
            }

            if (
                box.booking?.payment_status !== 'paid' &&
                box.booking?.payment_status !== 'cash_collected'
            ) {
                unpaid.push(box);
                return;
            }

            const declStatus = box.booking?.declaration_form_status || '';
            const isDeclValid =
                ['submitted_online', 'physical_copy_received'].includes(declStatus) ||
                (box.booking?.declaration_data &&
                    Object.keys(box.booking.declaration_data).length > 0) ||
                !!box.booking?.declaration_form_path;

            if (!isDeclValid) {
                missingDecl.push(box);
                return;
            }

            if (
                parsedBatchId &&
                (box.batch_id === parsedBatchId || box.batch?.id === parsedBatchId)
            ) {
                inBatch.push(box);
                return;
            }

            eligible.push(box);

            if (IN_TRANSIT_STATUSES.includes(box.status)) {
                inTransit.push(box);
            }
        });

        return {
            cancelledBoxes: cancelled,
            unpaidBoxes: unpaid,
            missingDeclBoxes: missingDecl,
            alreadyInBatchBoxes: inBatch,
            eligibleBoxes: eligible,
            inTransitOrBeyondBoxes: inTransit,
        };
    }, [selectedBoxes, isGlobalSelection, parsedBatchId]);

    const totalSelected = isGlobalSelection ? 0 : selectedBoxes?.length || selectedIds.length;
    const eligibleCount = isGlobalSelection ? null : eligibleBoxes.length;
    const totalSkipped = isGlobalSelection
        ? 0
        : cancelledBoxes.length +
          unpaidBoxes.length +
          missingDeclBoxes.length +
          alreadyInBatchBoxes.length;

    // Capacity calculation
    const batchCapacity = selectedBatch?.capacity_boxes ?? 0;
    const batchCurrentCount = selectedBatch?.current_box_count ?? 0;
    const remainingCapacity = Math.max(0, batchCapacity - batchCurrentCount);
    const hasCapacityWarning =
        batchCapacity > 0 &&
        eligibleCount !== null &&
        eligibleCount > remainingCapacity;

    const hasInTransitWarning = inTransitOrBeyondBoxes.length > 0;
    const isConfirmDisabled = hasInTransitWarning && !confirmInTransit;

    const handleAssign = () => {
        if (!batchId) return;

        setIsAssigning(true);
        router.post(
            '/admin/boxes/bulk-assign-to-batch',
            {
                ids: selectedIds,
                select_all: isGlobalSelection,
                batch_id: parsedBatchId,
                status: filters.status || undefined,
                search: filters.search || undefined,
                area_id: filters.area_id || undefined,
            },
            {
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
            }
        );
    };

    // Action button dynamic label
    const getActionButtonLabel = () => {
        if (isAssigning) return 'Assigning...';
        if (isGlobalSelection) return 'Assign Matching Boxes to Batch';
        if (eligibleCount === 0) return 'No Eligible Boxes to Assign';
        if (totalSkipped === 0) {
            return `Assign ${eligibleCount} ${eligibleCount === 1 ? 'Box' : 'Boxes'} to Batch`;
        }
        return `Assign ${eligibleCount} Eligible ${eligibleCount === 1 ? 'Box' : 'Boxes'} (${totalSkipped} Skipped)`;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-xl md:max-w-2xl bg-white border-zinc-200/80 rounded-xl p-0 overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
                <div className="bg-zinc-50 border-b border-zinc-200/80 p-5 shrink-0">
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-2xs">
                                <Package className="size-4" />
                            </span>
                            <div>
                                <DialogTitle className="font-sans text-lg font-semibold text-zinc-900">
                                    Assign Boxes to Container Batch
                                </DialogTitle>
                                <DialogDescription className="text-zinc-500 font-sans text-xs mt-0.5">
                                    {isGlobalSelection
                                        ? 'Bulk assign all matching boxes across pages to a shipment container.'
                                        : `Assign and load ${selectedIds.length} selected ${selectedIds.length === 1 ? 'box' : 'boxes'} into a container batch.`}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
                    {/* Global Selection Mode Notice */}
                    {isGlobalSelection && (
                        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-2xs">
                            <AlertTriangle className="size-4.5 text-amber-600 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-xs font-bold text-amber-900">Global Selection Mode Active</p>
                                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                                    You have selected all matching boxes across multiple pages. The server will automatically filter out boxes with missing customs declarations, unpaid balances, cancelled bookings, or that are already loaded in this batch.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Proportional Progress Distribution Bar */}
                    {!isGlobalSelection && totalSelected > 0 && (
                        <div className="space-y-2 rounded-xl border border-zinc-200/80 bg-zinc-50/60 p-3.5 shadow-2xs">
                            <div className="flex items-center justify-between text-xs font-semibold text-zinc-700">
                                <span className="flex items-center gap-1.5">
                                    <Layers className="size-3.5 text-zinc-500" />
                                    Selection Breakdown ({totalSelected} Total)
                                </span>
                                <span className="text-[11px] font-mono text-zinc-500">
                                    {eligibleBoxes.length} eligible / {totalSkipped} skipped
                                </span>
                            </div>

                            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-200/80">
                                {eligibleBoxes.length > 0 && (
                                    <div
                                        style={{ width: `${(eligibleBoxes.length / totalSelected) * 100}%` }}
                                        className="bg-emerald-500 transition-all duration-300"
                                        title={`Eligible: ${eligibleBoxes.length}`}
                                    />
                                )}
                                {alreadyInBatchBoxes.length > 0 && (
                                    <div
                                        style={{ width: `${(alreadyInBatchBoxes.length / totalSelected) * 100}%` }}
                                        className="bg-sky-500 transition-all duration-300"
                                        title={`Already in Batch: ${alreadyInBatchBoxes.length}`}
                                    />
                                )}
                                {unpaidBoxes.length > 0 && (
                                    <div
                                        style={{ width: `${(unpaidBoxes.length / totalSelected) * 100}%` }}
                                        className="bg-rose-500 transition-all duration-300"
                                        title={`Payment Pending: ${unpaidBoxes.length}`}
                                    />
                                )}
                                {missingDeclBoxes.length > 0 && (
                                    <div
                                        style={{ width: `${(missingDeclBoxes.length / totalSelected) * 100}%` }}
                                        className="bg-amber-500 transition-all duration-300"
                                        title={`Missing Declaration: ${missingDeclBoxes.length}`}
                                    />
                                )}
                                {cancelledBoxes.length > 0 && (
                                    <div
                                        style={{ width: `${(cancelledBoxes.length / totalSelected) * 100}%` }}
                                        className="bg-zinc-400 transition-all duration-300"
                                        title={`Cancelled: ${cancelledBoxes.length}`}
                                    />
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-[11px] text-zinc-600">
                                {eligibleBoxes.length > 0 && (
                                    <span className="inline-flex items-center gap-1">
                                        <span className="size-2 rounded-full bg-emerald-500" />
                                        <span>Eligible: <strong>{eligibleBoxes.length}</strong></span>
                                    </span>
                                )}
                                {alreadyInBatchBoxes.length > 0 && (
                                    <span className="inline-flex items-center gap-1">
                                        <span className="size-2 rounded-full bg-sky-500" />
                                        <span>Already Loaded: <strong>{alreadyInBatchBoxes.length}</strong></span>
                                    </span>
                                )}
                                {unpaidBoxes.length > 0 && (
                                    <span className="inline-flex items-center gap-1">
                                        <span className="size-2 rounded-full bg-rose-500" />
                                        <span>Unpaid: <strong>{unpaidBoxes.length}</strong></span>
                                    </span>
                                )}
                                {missingDeclBoxes.length > 0 && (
                                    <span className="inline-flex items-center gap-1">
                                        <span className="size-2 rounded-full bg-amber-500" />
                                        <span>Missing Decl: <strong>{missingDeclBoxes.length}</strong></span>
                                    </span>
                                )}
                                {cancelledBoxes.length > 0 && (
                                    <span className="inline-flex items-center gap-1">
                                        <span className="size-2 rounded-full bg-zinc-400" />
                                        <span>Cancelled: <strong>{cancelledBoxes.length}</strong></span>
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Severe Warning: In-Transit Reassignment */}
                    {!isGlobalSelection && hasInTransitWarning && (
                        <div className="rounded-xl border border-red-300 bg-red-50/80 p-4 shadow-2xs space-y-2">
                            <div className="flex items-start gap-3">
                                <AlertOctagon className="size-4.5 text-red-600 mt-0.5 shrink-0" />
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-red-950">
                                        Severe Warning: {inTransitOrBeyondBoxes.length} {inTransitOrBeyondBoxes.length === 1 ? 'Box is' : 'Boxes are'} Already In Transit
                                    </p>
                                    <p className="text-[11px] text-red-800 leading-relaxed">
                                        The following boxes are already in transit or out for delivery. Reassigning them will update their container batch while preserving their current shipping progress:
                                    </p>
                                    <TruncatedBoxChips boxes={inTransitOrBeyondBoxes} color="red" />
                                </div>
                            </div>
                            <div className="pt-2 border-t border-red-200/80">
                                <label className="flex items-start gap-2.5 cursor-pointer text-[11px] font-semibold text-red-900 select-none">
                                    <input
                                        type="checkbox"
                                        checked={confirmInTransit}
                                        onChange={(e) => setConfirmInTransit(e.target.checked)}
                                        className="size-4 rounded border-red-300 text-red-600 focus:ring-red-500 mt-0.5 cursor-pointer"
                                    />
                                    <span>I understand that transferring in-transit boxes will re-route their assigned batch and create an audit log.</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Categorized Issues Section */}
                    {!isGlobalSelection && (
                        <div className="space-y-3">
                            {/* Payment Pending */}
                            {unpaidBoxes.length > 0 && (
                                <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 shadow-2xs">
                                    <CreditCard className="size-4 text-rose-600 mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-rose-900">
                                            {unpaidBoxes.length} {unpaidBoxes.length === 1 ? 'Box' : 'Boxes'} with Payment Pending
                                        </p>
                                        <p className="text-[11px] text-rose-800 mt-0.5 leading-relaxed">
                                            Payment must be completed (or marked as Cash Collected) before boxes can be loaded into a container batch. These boxes will be skipped:
                                        </p>
                                        <TruncatedBoxChips boxes={unpaidBoxes} color="rose" />
                                    </div>
                                </div>
                            )}

                            {/* Missing Customs Declaration */}
                            {missingDeclBoxes.length > 0 && (
                                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 shadow-2xs">
                                    <FileText className="size-4 text-amber-600 mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-amber-900">
                                            {missingDeclBoxes.length} {missingDeclBoxes.length === 1 ? 'Box' : 'Boxes'} Missing Customs Declaration
                                        </p>
                                        <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                                            Customs declarations (packing list / itemized inventory) must be submitted or physical copies received before assignment:
                                        </p>
                                        <TruncatedBoxChips boxes={missingDeclBoxes} color="amber" />
                                    </div>
                                </div>
                            )}

                            {/* Already in This Batch */}
                            {alreadyInBatchBoxes.length > 0 && (
                                <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/80 p-3.5 shadow-2xs">
                                    <Info className="size-4 text-sky-600 mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-sky-900">
                                            {alreadyInBatchBoxes.length} {alreadyInBatchBoxes.length === 1 ? 'Box' : 'Boxes'} Already in this Batch
                                        </p>
                                        <p className="text-[11px] text-sky-800 mt-0.5 leading-relaxed">
                                            The following boxes are already assigned to the selected shipment container and will be skipped:
                                        </p>
                                        <TruncatedBoxChips boxes={alreadyInBatchBoxes} color="sky" />
                                    </div>
                                </div>
                            )}

                            {/* Cancelled Booking */}
                            {cancelledBoxes.length > 0 && (
                                <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-100/80 p-3.5 shadow-2xs">
                                    <XCircle className="size-4 text-zinc-500 mt-0.5 shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-zinc-800">
                                            {cancelledBoxes.length} {cancelledBoxes.length === 1 ? 'Box' : 'Boxes'} from Cancelled Bookings
                                        </p>
                                        <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">
                                            These boxes belong to cancelled bookings and cannot be assigned to any batch:
                                        </p>
                                        <TruncatedBoxChips boxes={cancelledBoxes} color="zinc" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Batch Selection Form */}
                    <div className="space-y-3 pt-1">
                        <div className="space-y-2">
                            <Label htmlFor="bulk-batch" className="text-xs font-semibold text-zinc-700 flex items-center justify-between">
                                <span>Select Target Shipment Batch</span>
                                {selectedBatch && (
                                    <span className="text-[11px] font-normal text-zinc-500">
                                        Capacity: {batchCurrentCount} / {batchCapacity || '∞'} boxes
                                    </span>
                                )}
                            </Label>
                            <select
                                id="bulk-batch"
                                title="Select batch"
                                className="flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 shadow-2xs transition-all"
                                value={batchId}
                                onChange={(e) => setBatchId(e.target.value)}
                            >
                                {activeBatches.map((batch) => (
                                    <option key={batch.id} value={batch.id}>
                                        {batch.batch_number} — {batch.branch_name || 'Main Hub'} ({batch.status})
                                        {batch.capacity_boxes ? ` [${batch.current_box_count || 0}/${batch.capacity_boxes}]` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Live Capacity Warning */}
                        {hasCapacityWarning && (
                            <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
                                <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-xs font-semibold">Container Capacity Limit Warning</p>
                                    <p className="text-[11px] text-amber-800 mt-0.5">
                                        Batch <strong>{selectedBatch?.batch_number}</strong> has only <strong>{remainingCapacity}</strong> slots remaining ({batchCurrentCount}/{batchCapacity}), but you are attempting to assign <strong>{eligibleCount}</strong> eligible boxes.
                                    </p>
                                </div>
                            </div>
                        )}

                        <p className="text-[11px] text-zinc-500 italic bg-zinc-50 rounded-lg p-2.5 border border-zinc-200/60">
                            * Assigning boxes to a batch will advance fresh boxes to <strong>Loaded to Container</strong> status. Boxes already in transit will retain their current shipping progress.
                        </p>
                    </div>
                </div>

                <DialogFooter className="bg-zinc-50 border-t border-zinc-200/80 p-4 flex flex-row items-center justify-between gap-2 shrink-0">
                    <div className="text-[11px] text-zinc-500">
                        {!isGlobalSelection && eligibleCount !== null && (
                            <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="size-3.5 text-emerald-600" />
                                <span><strong>{eligibleCount}</strong> boxes ready to load</span>
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
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
                            disabled={
                                isAssigning ||
                                !batchId ||
                                (eligibleCount !== null && eligibleCount === 0) ||
                                isConfirmDisabled
                            }
                            className="h-9 rounded-lg px-4 text-xs font-medium bg-brand-rust text-white hover:bg-brand-rust/90 transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {getActionButtonLabel()}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

