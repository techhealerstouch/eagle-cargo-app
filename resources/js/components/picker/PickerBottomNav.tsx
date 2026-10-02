import { Link, usePage } from '@inertiajs/react';
import { LayoutDashboard, ClipboardList, QrCode, Wallet, Settings } from 'lucide-react';
import React from 'react';

export function PickerBottomNav() {
    const { url } = usePage();

    const tabs = [
        {
            name: 'Dashboard',
            href: '/picker/dashboard',
            icon: LayoutDashboard,
            isActive: url === '/picker/dashboard' || url === '/picker',
        },
        {
            name: 'Runsheets',
            href: '/picker/runsheets',
            icon: ClipboardList,
            isActive: url.startsWith('/picker/runsheet'),
        },
        {
            name: 'Scan',
            href: '/picker/scan',
            icon: QrCode,
            isCenter: true,
            isActive: url.startsWith('/picker/scan'),
        },
        {
            name: 'Earnings',
            href: '/picker/earnings',
            icon: Wallet,
            isActive: url.startsWith('/picker/earnings'),
        },
        {
            name: 'Payouts',
            href: '/picker/payout-settings',
            icon: Settings,
            isActive: url.startsWith('/picker/payout-settings'),
        },
    ];

    return (
        <nav
            aria-label="Mobile Navigation"
            className="fixed bottom-0 left-0 right-0 z-40 block md:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
            <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
                {tabs.map((tab) => {
                    const Icon = tab.icon;

                    if (tab.isCenter) {
                        return (
                            <Link
                                key={tab.name}
                                href={tab.href}
                                className="group relative -mt-6 flex flex-col items-center focus:outline-none"
                            >
                                <div
                                    className={`flex size-14 items-center justify-center rounded-full bg-gradient-to-tr from-brand-navy via-slate-900 to-brand-primary text-white shadow-xl shadow-brand-navy/30 ring-4 ring-white transition-all group-active:scale-90 dark:ring-slate-950 ${
                                        tab.isActive
                                            ? 'ring-brand-primary shadow-brand-primary/40'
                                            : ''
                                    }`}
                                >
                                    <Icon className="size-6 text-white animate-pulse" />
                                </div>
                                <span
                                    className={`mt-1 text-[10px] font-black uppercase tracking-wider ${
                                        tab.isActive
                                            ? 'text-brand-primary font-black'
                                            : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                >
                                    {tab.name}
                                </span>
                            </Link>
                        );
                    }

                    return (
                        <Link
                            key={tab.name}
                            href={tab.href}
                            className={`relative flex flex-1 flex-col items-center justify-center py-2 transition-all active:scale-95 ${
                                tab.isActive
                                    ? 'text-brand-primary dark:text-brand-warm font-black'
                                    : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 font-semibold'
                            }`}
                        >
                            <div className="relative">
                                <Icon className={`size-5 transition-transform ${tab.isActive ? 'scale-110' : ''}`} />
                                {tab.isActive && (
                                    <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand-primary" />
                                )}
                            </div>
                            <span className="mt-1 text-[10px] uppercase tracking-wider">
                                {tab.name}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
