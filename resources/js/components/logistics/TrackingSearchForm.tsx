import { Search, X } from 'lucide-react';
import React from 'react';
import { Button } from '@/components/ui/button';

interface TrackingSearchFormProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (e: React.FormEvent) => void;
    onClear: () => void;
    onRecentClick: (num: string) => void;
    processing: boolean;
    errors?: { tracking_number?: string };
    recentSearches: string[];
    hasResult: boolean;
}

export const TrackingSearchForm: React.FC<TrackingSearchFormProps> = ({
    value,
    onChange,
    onSubmit,
    onClear,
    onRecentClick,
    processing,
    errors,
    recentSearches,
    hasResult
}) => {
    return (
        <div className="space-y-4">
            <form onSubmit={onSubmit} className="w-full max-w-2xl">
                <div className="relative flex items-center gap-3">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-focus-within:text-zinc-900 dark:group-focus-within:text-zinc-100 transition-colors" />
                        <input
                            type="text"
                            placeholder="Tracking ID or Booking Ref (e.g. BK-2026-013)"
                            className="w-full pl-11 pr-10 h-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-zinc-100 dark:focus:ring-zinc-950 focus:border-zinc-300 dark:focus:border-zinc-700 transition-all shadow-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-500 text-zinc-900 dark:text-zinc-100 font-mono"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            required
                            aria-label="Tracking number or booking reference"
                            aria-describedby={errors?.tracking_number ? "tracking-error" : undefined}
                        />
                        {value && (
                            <button
                                type="button"
                                onClick={onClear}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                                title="Clear search"
                            >
                                <X className="size-4" />
                            </button>
                        )}
                    </div>
                    <Button
                        type="submit"
                        disabled={processing}
                        className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 h-12 px-4 md:px-8 rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-xl shadow-zinc-200 dark:shadow-none active:scale-95 min-w-[80px] md:min-w-[100px]"
                    >
                        {processing ? (
                            <div className="flex items-center gap-2">
                                <div className="size-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span className="hidden sm:inline">Searching...</span>
                            </div>
                        ) : 'Track'}
                    </Button>
                </div>
                {errors?.tracking_number && (
                    <p id="tracking-error" className="mt-2 text-xs font-bold text-red-500">{errors.tracking_number}</p>
                )}
            </form>

            {!hasResult && recentSearches.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 animate-in fade-in slide-in-from-top-2 duration-500">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mr-1 shrink-0">Recent:</span>
                    {recentSearches.map((num) => (
                        <button
                            key={num}
                            onClick={() => onRecentClick(num)}
                            className="px-3 py-1 rounded-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono font-bold text-zinc-650 dark:text-zinc-300 hover:border-zinc-900 dark:hover:border-zinc-100 hover:bg-white dark:hover:bg-zinc-800 transition-all active:scale-95 shrink-0"
                        >
                            {num}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
