import { router } from '@inertiajs/react';
import { sanitizeQueryParams } from '@/components/common/filter-query-utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface FilterSelectProps {
    label?: string;
    placeholder?: string;
    options: { label: string; value: string; count?: number }[];
    paramName: string;
    routeName: string;
    queryParams?: Record<string, any>;
    ariaLabel?: string;
}

export default function FilterSelect({
    label,
    placeholder = 'All',
    options,
    paramName,
    routeName,
    queryParams = {},
    ariaLabel,
}: FilterSelectProps) {
    const rawValue = queryParams[paramName];
    const value = rawValue === undefined || rawValue === null || rawValue === ''
        ? 'all'
        : String(rawValue);

    const handleSelect = (newValue: string) => {
        const params = sanitizeQueryParams({
            ...queryParams,
            [paramName]: newValue === 'all' ? undefined : newValue,
            page: 1,
        });

        router.get(routeName, params, {
            preserveState: true,
            replace: true,
        });
    };

    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-brand-text-mid/70 px-1">
                    <span className="h-px w-2 bg-brand-rust/20"></span>
                    {label}
                </span>
            )}
            <Select value={value} onValueChange={handleSelect}>
                <SelectTrigger
                    className="h-11 w-44 rounded-xl border-brand-warm/10 bg-brand-warm/5 transition-all hover:border-brand-warm/20 focus:bg-white focus:border-brand-rust/30 focus:ring-2 focus:ring-brand-rust/5 font-sans text-xs font-medium text-brand-text/80"
                    aria-label={ariaLabel ?? label ?? placeholder}
                >
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-brand-warm/10 bg-white/95 backdrop-blur-xl shadow-2xl shadow-brand-rust/5">
                    <SelectItem value="all" className="text-xs font-medium text-brand-text-mid/60 focus:bg-brand-rust/5 focus:text-brand-rust">
                        {placeholder}
                    </SelectItem>
                    <Separator className="my-1 bg-brand-warm/5" />
                    {options.map((option) => (
                        <SelectItem 
                            key={option.value} 
                            value={option.value}
                            className="text-xs font-medium focus:bg-brand-rust/5 focus:text-brand-rust"
                        >
                            <div className="flex items-center justify-between w-full gap-4">
                                <span>{option.label}</span>
                                {option.count !== undefined && (
                                    <span className="ml-auto font-mono text-xs opacity-40">
                                        {option.count}
                                    </span>
                                )}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

