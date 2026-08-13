import { AlertCircle, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UnsavedChangesBarProps {
    isDirty: boolean;
    processing?: boolean;
    onReset: () => void;
    onSubmit?: () => void;
    title?: string;
    description?: string;
    className?: string;
}

export default function UnsavedChangesBar({
    isDirty,
    processing = false,
    onReset,
    onSubmit,
    title = 'You have unsaved changes',
    description = 'Don\'t forget to save your updates before leaving this page.',
    className,
}: UnsavedChangesBarProps) {
    if (!isDirty) {
        return null;
    }

    return (
        <div
            className={cn(
                'fixed bottom-6 left-1/2 z-50 w-[92%] max-w-3xl -translate-x-1/2 animate-in fade-in slide-in-from-bottom-6 duration-300',
                className,
            )}
        >
            <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-zinc-900/95 p-4 shadow-2xl backdrop-blur-md dark:border-amber-400/20 dark:bg-zinc-950/95 sm:flex-row sm:px-6 sm:py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
                        <AlertCircle className="h-5 w-5 animate-pulse" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-white">
                            {title}
                        </h4>
                        <p className="text-xs text-zinc-400">
                            {description}
                        </p>
                    </div>
                </div>

                <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={processing}
                        onClick={() => onReset()}
                        className="h-9 gap-2 rounded-xl text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white dark:hover:bg-zinc-800"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Discard
                    </Button>
                    <Button
                        type={onSubmit ? 'button' : 'submit'}
                        size="sm"
                        disabled={processing}
                        onClick={() => onSubmit?.()}
                        className="h-9 gap-2 rounded-xl bg-amber-500 px-5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 dark:bg-amber-500 dark:text-zinc-950 dark:hover:bg-amber-400"
                    >
                        <Save className="h-3.5 w-3.5" />
                        {processing ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
