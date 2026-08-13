import { usePage, router } from '@inertiajs/react';
import { useEchoNotification } from '@laravel/echo-react';
import { useState } from 'react';
import { ClipboardList, Coins, X } from 'lucide-react';

export function PickerAssignmentModal() {
    const { auth } = usePage<any>().props;
    const userId = auth?.user?.id;
    const userRole = auth?.user?.role;

    const [isOpen, setIsOpen] = useState(false);
    const [assignment, setAssignment] = useState<{
        title: string;
        message: string;
        url: string;
        runsheet_id: number;
    } | null>(null);

    // Only pickers should listen and trigger this modal
    useEchoNotification(
        userId && userRole === 'picker' ? `App.Models.User.${userId}` : '',
        (notification: any) => {
            const type = notification.data?.type;
            if (type === 'runsheet_assigned') {
                setAssignment({
                    title: notification.data?.title ?? 'New Runsheet Assigned',
                    message: notification.data?.message ?? 'You have a new runsheet assignment.',
                    url: notification.data?.url ?? '/picker/runsheets',
                    runsheet_id: notification.data?.runsheet_id
                });
                setIsOpen(true);
            }
        }
    );

    if (!isOpen || !assignment) return null;

    const handleView = () => {
        setIsOpen(false);
        router.visit(assignment.url);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop with premium blur */}
            <div 
                className="fixed inset-0 bg-brand-navy/60 backdrop-blur-md transition-opacity" 
                onClick={() => setIsOpen(false)} 
            />
            
            {/* Modal Body */}
            <div className="relative z-10 w-full max-w-md scale-100 rounded-3xl border border-brand-sand bg-white p-6 shadow-2xl transition-all dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in zoom-in-95 duration-200">
                {/* Close Button */}
                <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="absolute right-4 top-4 rounded-full p-1 text-brand-text-light hover:bg-brand-warm/30 hover:text-brand-text transition-colors dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                    <X className="size-5" />
                </button>

                {/* Content */}
                <div className="flex flex-col items-center text-center">
                    {/* Premium Commission/Assignment Icon Container */}
                    <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                        <div className="relative">
                            <ClipboardList className="size-8" />
                            <div className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-900">
                                <Coins className="size-3.5" />
                            </div>
                        </div>
                    </div>

                    <h3 className="font-serif text-xl font-black text-brand-navy dark:text-white">
                        {assignment.title}
                    </h3>
                    
                    <p className="mt-2 text-sm leading-relaxed text-brand-text-mid dark:text-zinc-400">
                        {assignment.message}
                    </p>

                    <div className="mt-4 rounded-2xl bg-emerald-500/10 p-3 text-xs font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                        💰 Pick up this runsheet to start earning commission!
                    </div>

                    {/* Actions */}
                    <div className="mt-6 flex w-full gap-3">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="flex-1 rounded-2xl border border-brand-sand bg-white px-4 py-3 text-xs font-bold uppercase tracking-widest text-brand-text-mid transition-all hover:bg-zinc-50 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 cursor-pointer"
                        >
                            Dismiss
                        </button>
                        <button
                            type="button"
                            onClick={handleView}
                            className="flex-1 rounded-2xl btn-primary px-4 py-3 text-xs font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 cursor-pointer text-white"
                        >
                            View Runsheet
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
