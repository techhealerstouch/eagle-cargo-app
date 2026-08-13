import { AlertTriangle, Trash2, HelpCircle, CheckCircle2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'destructive' | 'warning' | 'primary' | 'success';
    loading?: boolean;
    subtitle?: string;
    bannerText?: string;
    bannerIcon?: React.ReactNode;
    customIcon?: React.ReactNode;
    flatFooter?: boolean;
    cancelButtonVariant?: 'ghost' | 'outline';
}

export default function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'primary',
    loading = false,
    subtitle,
    bannerText,
    bannerIcon,
    customIcon,
    cancelButtonVariant = 'outline',
}: ConfirmModalProps) {
    const getVariantStyles = () => {
        switch (variant) {
            case 'destructive':
                return {
                    icon: <Trash2 className="size-4 text-red-600" />,
                    bg: 'bg-red-50 border border-red-200/80',
                    button: 'bg-red-600 text-white hover:bg-red-700 shadow-2xs',
                };
            case 'warning':
                return {
                    icon: <AlertTriangle className="size-4 text-amber-600" />,
                    bg: 'bg-amber-50 border border-amber-200/80',
                    button: 'bg-amber-600 text-white hover:bg-amber-700 shadow-2xs',
                };
            case 'success':
                return {
                    icon: <CheckCircle2 className="size-4 text-emerald-600" />,
                    bg: 'bg-emerald-50 border border-emerald-200/80',
                    button: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs',
                };
            default:
                return {
                    icon: <HelpCircle className="size-4 text-brand-rust" />,
                    bg: 'bg-brand-rust/5 border border-brand-rust/20',
                    button: 'bg-brand-rust text-white hover:bg-brand-rust/90 shadow-2xs',
                };
        }
    };

    const styles = getVariantStyles();
    const displayIcon = customIcon || styles.icon;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md p-6 rounded-xl border border-zinc-200/80 bg-white shadow-xl gap-5">
                <div className="flex items-start gap-3.5">
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', styles.bg)}>
                        {displayIcon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <DialogHeader>
                            <DialogTitle className="font-sans text-base font-semibold text-zinc-900 tracking-tight">
                                {title}
                            </DialogTitle>
                            {subtitle && (
                                <p className="mt-0.5 text-xs text-zinc-500">
                                    {subtitle}
                                </p>
                            )}

                            {bannerText && (
                                <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-medium text-emerald-800">
                                    {bannerIcon}
                                    <span>{bannerText}</span>
                                </div>
                            )}

                            <DialogDescription className="mt-2 text-xs leading-relaxed text-zinc-600 font-normal">
                                {description}
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                </div>

                <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
                    <Button
                        type="button"
                        variant={cancelButtonVariant}
                        onClick={onClose}
                        disabled={loading}
                        className="h-9 rounded-lg px-4 text-xs font-medium border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className={cn(
                            'h-9 rounded-lg px-4 text-xs font-medium text-white transition-colors',
                            styles.button
                        )}
                    >
                        {loading ? 'Processing...' : confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
