import { router } from '@inertiajs/react';
import { Filter, X, RotateCcw, Check } from 'lucide-react';
import { useState } from 'react';
import { sanitizeQueryParams } from '@/components/common/filter-query-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
    SheetClose,
} from '@/components/ui/sheet';

interface FilterOption {
    label: string;
    value: string;
}

interface FilterGroup {
    id: string;
    label: string;
    options: FilterOption[];
    type: 'single' | 'multiple';
}

interface AdvancedFilterPanelProps {
    routeName: string;
    queryParams: Record<string, any>;
    groups: FilterGroup[];
    onReset?: () => void;
}

export default function AdvancedFilterPanel({
    routeName,
    queryParams,
    groups,
    onReset,
}: AdvancedFilterPanelProps) {
    const [localParams, setLocalParams] = useState<Record<string, any>>(queryParams);

    const activeFilterCount = Object.entries(sanitizeQueryParams(queryParams)).filter(
        ([key]) => !['page', 'search'].includes(key)
    ).length;

    const handleApply = () => {
        router.get(routeName, sanitizeQueryParams({ ...localParams, page: 1 }), {
            preserveState: true,
            replace: true,
        });
    };

    const handleReset = () => {
        const resetParams = { ...queryParams };
        groups.forEach((g) => {
            delete resetParams[g.id];
        });
        setLocalParams(resetParams);
        router.get(routeName, sanitizeQueryParams({ ...resetParams, page: 1 }), {
            preserveState: true,
            replace: true,
        });

        if (onReset) {
onReset();
}
    };

    const toggleFilter = (groupId: string, value: string, type: 'single' | 'multiple') => {
        setLocalParams((prev) => {
            const current = prev[groupId];

            if (type === 'single') {
                return { ...prev, [groupId]: current === value ? undefined : value };
            } else {
                const currentArray = Array.isArray(current) ? current : current ? [current] : [];
                const nextArray = currentArray.includes(value)
                    ? currentArray.filter((v: string) => v !== value)
                    : [...currentArray, value];

                return { ...prev, [groupId]: nextArray.length > 0 ? nextArray : undefined };
            }
        });
    };

    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button
                    variant="outline"
                    className="relative flex items-center gap-2 rounded-xl border-brand-warm/20 bg-white px-4 font-sans text-xs font-bold transition-all hover:bg-brand-warm/10"
                >
                    <Filter className="size-4" />
                    Filters
                    {activeFilterCount > 0 && (
                        <Badge className="ml-1 h-5 min-w-5 justify-center rounded-full bg-brand-rust px-1 font-mono text-xs text-white">
                            {activeFilterCount}
                        </Badge>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md border-l border-brand-warm/20 bg-white/95 backdrop-blur-xl">
                <SheetHeader className="pb-6">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="font-serif text-2xl font-bold text-brand-rust">
                            Advanced Filters
                        </SheetTitle>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleReset}
                            className="flex items-center gap-2 text-xs font-bold text-brand-text-mid hover:text-brand-rust"
                        >
                            <RotateCcw className="size-3" />
                            Reset All
                        </Button>
                    </div>
                </SheetHeader>

                <div className="flex flex-col gap-8 py-4 overflow-y-auto max-h-[calc(100vh-200px)] px-1">
                    {groups.map((group) => (
                        <div key={group.id} className="flex flex-col gap-4">
                            <h3 className="text-xs font-medium text-brand-text-mid">
                                {group.label}
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                {group.options.map((option) => {
                                    const isSelected = group.type === 'single'
                                        ? localParams[group.id] === option.value
                                        : (Array.isArray(localParams[group.id]) 
                                            ? localParams[group.id].includes(option.value)
                                            : localParams[group.id] === option.value);

                                    return (
                                        <button
                                            key={option.value}
                                            onClick={() => toggleFilter(group.id, option.value, group.type)}
                                            className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                                                isSelected
                                                    ? 'border-brand-rust/50 bg-brand-rust/5 ring-1 ring-brand-rust/20'
                                                    : 'border-brand-warm/10 bg-brand-warm/5 hover:border-brand-warm/30 hover:bg-brand-warm/10'
                                            }`}
                                        >
                                            <span className={`text-xs font-bold ${isSelected ? 'text-brand-rust' : 'text-brand-text'}`}>
                                                {option.label}
                                            </span>
                                            {isSelected && <Check className="size-3 text-brand-rust" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    
                    <div className="flex flex-col gap-4">
                        <h3 className="text-xs font-medium text-brand-text-mid">
                            Date Range
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-bold text-zinc-500">From</Label>
                                <input 
                                    type="date" 
                                    className="rounded-lg border border-brand-warm/20 bg-brand-warm/5 px-3 py-2 text-xs font-mono focus:border-brand-rust focus:ring-1 focus:ring-brand-rust"
                                    value={localParams.start_date || ''}
                                    onChange={(e) => setLocalParams(p => ({ ...p, start_date: e.target.value }))}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-xs font-bold text-zinc-500">To</Label>
                                <input 
                                    type="date" 
                                    className="rounded-lg border border-brand-warm/20 bg-brand-warm/5 px-3 py-2 text-xs font-mono focus:border-brand-rust focus:ring-1 focus:ring-brand-rust"
                                    value={localParams.end_date || ''}
                                    onChange={(e) => setLocalParams(p => ({ ...p, end_date: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <SheetFooter className="absolute bottom-0 left-0 right-0 border-t border-brand-warm/20 bg-white p-6">
                    <SheetClose asChild>
                        <Button
                            onClick={handleApply}
                            className="w-full rounded-xl bg-brand-rust py-6 font-sans text-xs font-bold text-white shadow-lg shadow-brand-rust/20 transition-all hover:bg-brand-rust/90 active:scale-[0.98]"
                        >
                            Apply Filters
                        </Button>
                    </SheetClose>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

