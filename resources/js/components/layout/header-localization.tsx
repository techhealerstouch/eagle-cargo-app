import { usePage } from '@inertiajs/react';
import { Clock, Calendar, Coins } from 'lucide-react';
import { useEffect, useState } from 'react';

export function HeaderLocalization() {
    const { settings } = usePage().props as any;
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    if (!settings) {
        return null;
    }

    const timezone = settings.timezone || 'UTC';

    const timeString = new Intl.DateTimeFormat('en-AU', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    }).format(now);

    const dateString = new Intl.DateTimeFormat('en-AU', {
        timeZone: timezone,
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }).format(now);

    const currencyCode = settings.currency || 'AUD';
    const currencySymbol = settings.currencySymbol || '$';

    return (
        <div 
            className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100/70 dark:bg-zinc-900/70 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs backdrop-blur-md transition-all hover:border-zinc-300 dark:hover:border-zinc-700 select-none shrink-0"
            title={`Timezone: ${timezone} | Base Currency: ${currencyCode}`}
        >
            {/* System Time */}
            <div className="flex items-center gap-1.5 text-xs text-foreground font-semibold" title={`System Time (${timezone})`}>
                <Clock className="size-3 text-brand-rust shrink-0" />
                <span className="tabular-nums tracking-tight">{timeString}</span>
            </div>

            {/* Divider (visible on xl+ when date is displayed) */}
            <span className="hidden xl:inline-block h-3.5 w-px bg-zinc-200 dark:bg-zinc-700"></span>

            {/* Global Date (shows on xl+) */}
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-muted-foreground font-medium" title="Global Date">
                <Calendar className="size-3 text-brand-rust shrink-0" />
                <span className="whitespace-nowrap">{dateString}</span>
            </div>

            {/* Divider */}
            <span className="h-3.5 w-px bg-zinc-200 dark:bg-zinc-700"></span>

            {/* Currency */}
            <div className="flex items-center gap-1 text-xs font-bold text-brand-rust" title={`Currency: ${currencyCode} (${currencySymbol})`}>
                <Coins className="size-3 shrink-0" />
                <span>{currencyCode}</span>
                <span className="text-[10px] font-normal text-muted-foreground">({currencySymbol})</span>
            </div>
        </div>
    );
}
