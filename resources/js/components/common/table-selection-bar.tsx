import { X, Trash2, CheckCircle, Ban, Printer, Sparkles } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';

interface TableSelectionBarProps {
    selectedCount: number;
    totalCount?: number;
    isGlobalSelection?: boolean;
    onToggleGlobal?: (isGlobal: boolean) => void;
    onClear: () => void;
    actions?: {
        label: string;
        icon: React.ElementType;
        onClick: () => void;
        variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
        disabled?: boolean;
    }[];
    children?: React.ReactNode;
}

export default function TableSelectionBar({
    selectedCount,
    totalCount,
    isGlobalSelection,
    onToggleGlobal,
    onClear,
    actions = [],
    children
}: TableSelectionBarProps) {
    if (selectedCount === 0) {
        return null;
    }

    const showGlobalPrompt = totalCount && totalCount > selectedCount && !isGlobalSelection;

    return (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex flex-col items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-200">
            {showGlobalPrompt && (
                <div className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white shadow-md flex items-center gap-2">
                    <span>{selectedCount} item(s) selected on this page.</span>
                    <button
                        type="button"
                        onClick={() => onToggleGlobal?.(true)}
                        className="underline text-brand-sand hover:text-white font-semibold transition-colors"
                    >
                        Select all {totalCount} items across all pages
                    </button>
                </div>
            )}

            {isGlobalSelection && (
                <div className="rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-medium text-white shadow-md flex items-center gap-2">
                    <span>All {totalCount} items across all pages are selected.</span>
                    <button
                        type="button"
                        onClick={() => onToggleGlobal?.(false)}
                        className="underline text-emerald-100 hover:text-white font-semibold transition-colors"
                    >
                        Clear global selection
                    </button>
                </div>
            )}

            <div className="flex items-center gap-4 rounded-xl border border-zinc-200/90 bg-white/95 px-4 py-2.5 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-3 border-r border-zinc-200/80 pr-4">
                    <button
                        type="button"
                        onClick={onClear}
                        title="Clear selection"
                        aria-label="Clear selection"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                    >
                        <X className="size-4" aria-hidden="true" />
                    </button>
                    <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-semibold text-zinc-900">
                            {isGlobalSelection ? totalCount : selectedCount}
                        </span>
                        <span className="text-zinc-500 font-medium">
                            {isGlobalSelection ? 'Total Selected' : 'Selected'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {children}
                    {actions.map((action, index) => (
                        <Button
                            key={index}
                            variant={action.variant || 'outline'}
                            size="sm"
                            onClick={action.onClick}
                            disabled={action.disabled}
                            className="flex items-center gap-1.5 rounded-lg h-8 px-3 text-xs font-medium shadow-2xs transition-all"
                        >
                            <action.icon className="size-3.5" />
                            <span>{action.label}</span>
                        </Button>
                    ))}
                </div>
            </div>
        </div>
    );
}
