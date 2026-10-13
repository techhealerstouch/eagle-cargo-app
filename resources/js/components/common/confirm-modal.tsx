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
    children?: React.ReactNode;
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
    children,
}: ConfirmModalProps) {
    const getVariantStyles = () => {
        switch (variant) {
            case 'destructive':
                return {
                    icon: <Trash2 className="size-4 text-red-600 dark:text-red-400" />,
                    bg: 'bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-800/60',
                    button: 'bg-red-600 text-white hover:bg-red-700 shadow-2xs',
                };
            case 'warning':
                return {
                    icon: <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />,
                    bg: 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60',
                    button: 'bg-amber-600 text-white hover:bg-amber-700 shadow-2xs',
                };
            case 'success':
                return {
                    icon: <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />,
                    bg: 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60',
                    button: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs',
                };
            default:
                return {
                    icon: <HelpCircle className="size-4 text-brand-rust" />,
                    bg: 'bg-brand-rust/5 dark:bg-zinc-800 border border-brand-rust/20 dark:border-zinc-700',
                    button: 'bg-brand-rust text-white dark:text-zinc-950 hover:bg-brand-rust/90 shadow-2xs',
                };
        }
    };

    const styles = getVariantStyles();
    const displayIcon = customIcon || styles.icon;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md p-6 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl gap-5">
                <div className="flex items-start gap-3.5">
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', styles.bg)}>
                        {displayIcon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <DialogHeader>
                            <DialogTitle className="font-sans text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                                {title}
                            </DialogTitle>
                            {subtitle && (
                                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                                    {subtitle}
                                </p>
                            )}

                            {bannerText && (
                                <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 p-2.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                                    {bannerIcon}
                                    <span>{bannerText}</span>
                                </div>
                            )}

                            <DialogDescription className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 font-normal">
                                {description}
                            </DialogDescription>
                        </DialogHeader>

                        {children && (
                            <div className="mt-3.5 w-full">
                                {children}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
                    <Button
                        type="button"
                        variant={cancelButtonVariant}
                        onClick={onClose}
                        disabled={loading}
                        className="h-9 rounded-lg px-4 text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
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
