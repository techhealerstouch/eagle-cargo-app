import { usePage } from '@inertiajs/react';
import { Clock, Calendar, Coins } from 'lucide-react';
import { useEffect, useState } from 'react';

export function HeaderLocalization() {
    const { settings } = usePage().props as any;
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 1000); // Update every second for the clock

        return () => clearInterval(timer);
    }, []);

    if (!settings) {
return null;
}

    const timezone = settings.timezone || 'UTC';
    
    // Format time
    const timeString = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    }).format(now);

    // Format date based on system setting if possible, otherwise standard
    // Note: PHP format strings (d/m/Y) are different from JS. 
    // We'll use a standard long date format for the header to look professional.
    const dateString = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(now);

    return (
        <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 rounded-2xl bg-zinc-100/50 border border-zinc-200/50 backdrop-blur-sm mx-4 transition-all hover:bg-zinc-100 hover:border-zinc-300 group">
            <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-lg bg-white border border-zinc-200 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <Clock className="size-3.5 text-brand-rust" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 leading-none mb-0.5">System Time</span>
                    <span className="text-[11px] font-bold text-zinc-900 leading-none tabular-nums">{timeString}</span>
                </div>
            </div>

            <div className="h-6 w-px bg-zinc-200/60"></div>

            <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-lg bg-white border border-zinc-200 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <Calendar className="size-3.5 text-brand-rust" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 leading-none mb-0.5">Global Date</span>
                    <span className="text-[11px] font-bold text-zinc-900 leading-none">{dateString}</span>
                </div>
            </div>

            <div className="h-6 w-px bg-zinc-200/60"></div>

            <div className="flex items-center gap-2.5">
                <div className="size-7 rounded-lg bg-brand-rust/5 border border-brand-rust/20 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                    <Coins className="size-3.5 text-brand-rust" />
                </div>
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-brand-rust/60 leading-none mb-0.5">Currency</span>
                    <div className="flex items-center gap-1">
                        <span className="text-[11px] font-black text-brand-rust leading-none">{settings.currency || 'AUD'}</span>
                        <span className="text-[10px] font-medium text-zinc-400 leading-none">({settings.currencySymbol || '$'})</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
