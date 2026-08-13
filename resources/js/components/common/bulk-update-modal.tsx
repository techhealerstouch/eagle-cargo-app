import { router } from '@inertiajs/react';
import * as React from 'react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ArrowRight, Layers, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

export interface BulkUpdateAction {
    id: string;
    label: string;
    icon: React.ElementType;
    description: string;
    endpoint: string;
    method?: 'post' | 'put' | 'delete';
    // Get additional payload from internal form state
    getPayload?: (formState: any) => any;
    // Render the custom form inputs. Passes current state and state setter.
    renderForm?: (formState: any, setFormState: (state: any) => void) => React.ReactNode;
}

interface BulkUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    actions: BulkUpdateAction[];
    selectedIds: number[];
    isGlobalSelection: boolean;
    filters?: any;
    onSuccessCallback?: () => void;
}

export default function BulkUpdateModal({
    isOpen,
    onClose,
    title = 'Update Selected Items',
    description = 'Apply changes to multiple items at once. Select an action from the menu to configure.',
    actions,
    selectedIds,
    isGlobalSelection,
    filters,
    onSuccessCallback,
}: BulkUpdateModalProps) {
    const [activeActionId, setActiveActionId] = useState<string>(actions[0]?.id || '');
    const [formState, setFormState] = useState<Record<string, any>>({});
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (isOpen && actions.length > 0 && !activeActionId) {
            setActiveActionId(actions[0].id);
        }
        if (!isOpen) {
            setFormState({});
        }
    }, [isOpen, actions]);

    const activeAction = actions.find(a => a.id === activeActionId);
    const ActiveIcon = activeAction?.icon;

    const handleBulkUpdate = () => {
        if (!activeAction) return;
        
        setIsUpdating(true);

        const method = activeAction.method || 'post';
        
        let payload: any = {
            ids: selectedIds,
            select_all: isGlobalSelection,
            ...filters
        };

        if (activeAction.getPayload) {
            payload = {
                ...payload,
                ...activeAction.getPayload(formState)
            };
        }

        router.visit(activeAction.endpoint, {
            method: method,
            data: payload,
            onSuccess: () => {
                toast.success(`Successfully applied ${activeAction.label.toLowerCase()}`);
                onSuccessCallback?.();
                onClose();
            },
            onError: () => {
                toast.error(`Failed to apply ${activeAction.label.toLowerCase()}`);
            },
            onFinish: () => {
                setIsUpdating(false);
            }
        });
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isUpdating && !open && onClose()}>
            <DialogContent className="w-full max-w-3xl sm:max-w-3xl p-0 gap-0 overflow-hidden bg-white border border-zinc-200/90 shadow-2xl rounded-2xl">
                {/* Header */}
                <div className="p-5 sm:p-6 pr-12 border-b border-zinc-100 bg-gradient-to-r from-zinc-50/80 via-white to-zinc-50/30">
                    <DialogHeader>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="size-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center shadow-xs shrink-0">
                                    <Sparkles className="size-4 text-amber-300" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2.5">
                                        <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-zinc-900">
                                            {title}
                                        </DialogTitle>
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border shadow-2xs ${
                                            isGlobalSelection 
                                                ? 'bg-amber-50 text-amber-700 border-amber-200/80' 
                                                : 'bg-zinc-100 text-zinc-800 border-zinc-200/80'
                                        }`}>
                                            <Layers className="size-3 text-current opacity-70" />
                                            {isGlobalSelection ? 'All Filtered Items' : `${selectedIds.length} Selected`}
                                        </span>
                                    </div>
                                    <DialogDescription className="text-xs text-zinc-500 mt-1">
                                        {description}
                                    </DialogDescription>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="flex flex-col sm:flex-row min-h-[380px] max-h-[520px]">
                    {/* Left Sidebar Actions */}
                    <div className="w-full sm:w-64 border-r border-zinc-100 bg-zinc-50/60 p-3 shrink-0 flex flex-col">
                        <div className="px-2.5 py-1.5 mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Select Action</span>
                        </div>
                        <div className="space-y-1 overflow-y-auto flex-1">
                            {actions.map((action) => {
                                const Icon = action.icon;
                                const isActive = activeActionId === action.id;
                                return (
                                    <button
                                        key={action.id}
                                        type="button"
                                        onClick={() => setActiveActionId(action.id)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 text-left relative ${
                                            isActive 
                                                ? 'bg-white text-zinc-900 shadow-xs border border-zinc-200/90 font-semibold' 
                                                : 'text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900 border border-transparent'
                                        }`}
                                    >
                                        <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                            isActive ? 'bg-zinc-900 text-white' : 'bg-zinc-200/60 text-zinc-500'
                                        }`}>
                                            <Icon className="size-3.5" />
                                        </div>
                                        <span className="truncate flex-1">{action.label}</span>
                                        {isActive && <ArrowRight className="size-3 shrink-0 text-zinc-400" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right Content Area */}
                    <div className="flex-1 flex flex-col bg-white overflow-hidden">
                        <div className="p-6 flex-1 overflow-y-auto">
                            {activeAction && (
                                <div className="mb-5 flex items-start gap-3.5 pb-4 border-b border-zinc-100">
                                    {ActiveIcon && (
                                        <div className="size-9 rounded-xl bg-zinc-100/80 border border-zinc-200/60 flex items-center justify-center shrink-0 text-zinc-800 shadow-2xs">
                                            <ActiveIcon className="size-4 text-zinc-700" />
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="text-sm font-semibold text-zinc-900">{activeAction.label}</h3>
                                        <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{activeAction.description}</p>
                                    </div>
                                </div>
                            )}

                            {activeAction?.renderForm && activeAction.renderForm(formState, setFormState)}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-between gap-3 shrink-0">
                            <span className="text-[11px] text-zinc-400 font-medium hidden sm:inline-block">
                                {isGlobalSelection ? 'Targeting filtered dataset' : `Targeting ${selectedIds.length} item(s)`}
                            </span>
                            <div className="flex items-center gap-2.5 ml-auto">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onClose}
                                    className="text-xs h-9 px-4 font-medium border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 rounded-xl"
                                    disabled={isUpdating}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleBulkUpdate}
                                    disabled={isUpdating}
                                    className="text-xs h-9 px-5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-semibold shadow-xs transition-all flex items-center gap-2"
                                >
                                    {isUpdating ? (
                                        <>
                                            <span className="size-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            Applying...
                                        </>
                                    ) : (
                                        <>
                                            <span>Apply Updates</span>
                                            <ArrowRight className="size-3.5 text-zinc-400" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

