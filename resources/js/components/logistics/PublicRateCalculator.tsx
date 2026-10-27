import React, { useState, useMemo } from 'react';
import { Link } from '@inertiajs/react';
import { 
    Calculator, 
    Package, 
    MapPin, 
    ArrowRight, 
    Calendar, 
    Sparkles, 
    ShieldCheck, 
    CheckCircle2, 
    Info, 
    Clock, 
    Truck,
    HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface BoxType {
    id: number;
    name: string;
    dimensions?: string | null;
    is_active?: boolean;
}

export interface Area {
    id: number;
    name: string;
    is_active?: boolean;
}

export interface Province {
    id: number;
    name: string;
    area_id?: number | null;
    is_active?: boolean;
}

export interface PickupZone {
    id: number;
    name: string;
    code?: string;
    suburbs?: Array<{ id: number; name: string; postcode?: string } | string>;
}

export interface Suburb {
    id: number;
    name: string;
    postcode?: string;
    pickup_zone_id?: number;
}

export interface BoxPrice {
    id?: number;
    pickup_zone_id: number;
    area_id: number;
    box_type_id: number;
    price: number | string;
}

export interface PublicRateCalculatorProps {
    areas?: Area[];
    provinces?: Province[];
    boxTypes?: BoxType[];
    boxPrices?: BoxPrice[];
    pickupZones?: PickupZone[];
    suburbs?: Suburb[];
    isGuest?: boolean;
    compact?: boolean;
    className?: string;
}

export default function PublicRateCalculator({
    areas = [],
    provinces = [],
    boxTypes = [],
    boxPrices = [],
    pickupZones = [],
    suburbs = [],
    isGuest = true,
    compact = false,
    className = '',
}: PublicRateCalculatorProps) {
    // 1. Origin selection (Victorian Suburb / Postcode)
    const [suburbSearch, setSuburbSearch] = useState('');
    const [selectedSuburb, setSelectedSuburb] = useState<Suburb | null>(null);
    const [isSuburbDropdownOpen, setIsSuburbDropdownOpen] = useState(false);

    // Filter active suburbs
    const filteredSuburbs = useMemo(() => {
        const query = suburbSearch.trim().toLowerCase();
        if (!query) {
            return (suburbs || []).slice(0, 15);
        }
        return (suburbs || [])
            .filter((s) => 
                s.name.toLowerCase().includes(query) || 
                (s.postcode && s.postcode.includes(query))
            )
            .slice(0, 15);
    }, [suburbs, suburbSearch]);

    // Resolved Pickup Zone
    const resolvedPickupZone = useMemo(() => {
        if (!selectedSuburb) {
            // Default to first zone (usually Metro Melbourne) if available
            return pickupZones[0] || null;
        }

        const zoneId = selectedSuburb.pickup_zone_id;
        if (zoneId) {
            const found = pickupZones.find((z) => z.id === zoneId);
            if (found) return found;
        }

        // Fallback match by suburb name in pickup zone suburbs list
        const lowerName = selectedSuburb.name.toLowerCase().trim();
        for (const zone of pickupZones) {
            if (Array.isArray(zone.suburbs)) {
                const match = zone.suburbs.some((s) => {
                    const name = typeof s === 'string' ? s : s.name;
                    return name.toLowerCase().trim() === lowerName;
                });
                if (match) return zone;
            }
        }

        return pickupZones[0] || null;
    }, [selectedSuburb, pickupZones]);

    // 2. Box Type selection
    const activeBoxTypes = useMemo(() => {
        const standard = (boxTypes || []).filter((bt) => 
            !bt.name.toLowerCase().includes('custom')
        );
        return standard.length > 0 ? standard : boxTypes;
    }, [boxTypes]);

    const [selectedBoxTypeId, setSelectedBoxTypeId] = useState<number | null>(() => {
        // Default to Jumbo box if available, otherwise first
        const jumbo = activeBoxTypes.find((b) => b.name.toLowerCase().includes('jumbo'));
        return jumbo?.id ?? (activeBoxTypes[0]?.id || null);
    });

    const selectedBoxType = useMemo(() => {
        return activeBoxTypes.find((b) => b.id === selectedBoxTypeId) || activeBoxTypes[0] || null;
    }, [activeBoxTypes, selectedBoxTypeId]);

    // 3. Destination Selection (Province-driven, Area auto-derived)
    const sortedProvinces = useMemo(() => {
        if (!provinces || provinces.length === 0) return [];
        return [...provinces].sort((a, b) => {
            const isAMetro = (a.name || '').toLowerCase().includes('metro manila');
            const isBMetro = (b.name || '').toLowerCase().includes('metro manila');
            if (isAMetro && !isBMetro) return -1;
            if (!isAMetro && isBMetro) return 1;
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [provinces]);

    const [selectedProvinceId, setSelectedProvinceId] = useState<number | null>(() => {
        if (!provinces || provinces.length === 0) return null;
        const manila = provinces.find((p) => (p.name || '').toLowerCase().includes('metro manila') || (p.name || '').toLowerCase().includes('manila'));
        return manila?.id ?? (provinces[0]?.id || null);
    });

    const selectedProvince = useMemo(() => {
        if (!selectedProvinceId) return null;
        return (provinces || []).find((p) => p.id === selectedProvinceId) || null;
    }, [provinces, selectedProvinceId]);

    const [fallbackAreaId, setFallbackAreaId] = useState<number | null>(() => {
        const manila = (areas || []).find((a) => a.name.toLowerCase().includes('manila'));
        return manila?.id ?? (areas[0]?.id || null);
    });

    const selectedAreaId = useMemo(() => {
        if (selectedProvince?.area_id) {
            return Number(selectedProvince.area_id);
        }
        return fallbackAreaId;
    }, [selectedProvince, fallbackAreaId]);

    const selectedArea = useMemo(() => {
        return (areas || []).find((a) => a.id === selectedAreaId) || areas[0] || null;
    }, [areas, selectedAreaId]);

    // 4. Rate Lookup
    const calculatedRate = useMemo(() => {
        if (!selectedBoxTypeId || !selectedAreaId || !resolvedPickupZone) {
            return null;
        }

        const match = (boxPrices || []).find((bp) => 
            Number(bp.box_type_id) === Number(selectedBoxTypeId) &&
            Number(bp.area_id) === Number(selectedAreaId) &&
            Number(bp.pickup_zone_id) === Number(resolvedPickupZone.id)
        );

        if (match && Number(match.price) > 0) {
            return Number(match.price);
        }

        // Fallback: check across any pickup zone if zone-specific rate not found
        const fallback = (boxPrices || []).find((bp) => 
            Number(bp.box_type_id) === Number(selectedBoxTypeId) &&
            Number(bp.area_id) === Number(selectedAreaId) &&
            Number(bp.price) > 0
        );

        return fallback ? Number(fallback.price) : 115; // Realistic Australian average for Jumbo to Manila
    }, [selectedBoxTypeId, selectedAreaId, resolvedPickupZone, boxPrices]);

    // Estimated ocean shipping timeline
    const estimatedTimeline = useMemo(() => {
        const areaName = selectedArea?.name?.toLowerCase() || '';
        if (areaName.includes('manila')) return '4 - 6 weeks';
        if (areaName.includes('luzon')) return '5 - 7 weeks';
        if (areaName.includes('visayas')) return '6 - 8 weeks';
        if (areaName.includes('mindanao')) return '6 - 8 weeks';
        return '6 - 9 weeks';
    }, [selectedArea]);

    // Deposit amount (usually $10-$20 on empty box delivery)
    const depositAmount = 10;
    const balanceOnPickup = calculatedRate ? Math.max(0, calculatedRate - depositAmount) : null;

    // Booking URL with prefilled parameters
    const bookingUrl = useMemo(() => {
        const baseUrl = isGuest ? '/guest/book' : '/book';
        const params = new URLSearchParams();

        if (selectedSuburb) {
            params.set('suburb', selectedSuburb.name);
            if (selectedSuburb.postcode) params.set('postcode', selectedSuburb.postcode);
            params.set('state', 'VIC');
        }
        if (resolvedPickupZone) {
            params.set('pickup_zone_id', String(resolvedPickupZone.id));
        }
        if (selectedBoxTypeId) {
            params.set('box_type_id', String(selectedBoxTypeId));
        }
        if (selectedAreaId) {
            params.set('area_id', String(selectedAreaId));
        }
        if (selectedProvince) {
            params.set('province', selectedProvince.name);
        } else if (selectedAreaId) {
            const matchingProvs = provinces.filter((p) => Number(p.area_id) === Number(selectedAreaId));
            if (matchingProvs.length === 1) {
                params.set('province', matchingProvs[0].name);
            } else if (selectedArea) {
                const nameMatch = provinces.find(
                    (p) => p.name.trim().toLowerCase() === selectedArea.name.trim().toLowerCase()
                );
                if (nameMatch) {
                    params.set('province', nameMatch.name);
                }
            }
        }

        const queryString = params.toString();
        return queryString ? `${baseUrl}?${queryString}` : baseUrl;
    }, [isGuest, selectedSuburb, resolvedPickupZone, selectedBoxTypeId, selectedAreaId, selectedProvince, provinces, selectedArea]);

    return (
        <div className={cn(
            "w-full rounded-3xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.12)] p-6 sm:p-8 text-left transition-all",
            className
        )}>
            {/* Header Badge & Title */}
            <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/40 text-xs font-bold text-[#c2410c] dark:text-orange-400 mb-1.5 shadow-2xs">
                        <Calculator className="size-3.5" />
                        <span>Instant Shipping Estimator</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Calculate Box Rate
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
                        Door-to-door sea freight from Victoria to anywhere in the Philippines
                    </p>
                </div>

                <div className="hidden sm:flex size-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 items-center justify-center text-slate-600 dark:text-zinc-300">
                    <Truck className="size-6" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Columns: Selection Controls */}
                <div className="lg:col-span-7 space-y-5">
                    {/* 1. Origin Suburb Input */}
                    <div className="relative">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-1.5">
                            1. Pickup Origin (Victoria Suburb or Postcode)
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={selectedSuburb ? `${selectedSuburb.name} (VIC ${selectedSuburb.postcode || ''})` : suburbSearch}
                                onChange={(e) => {
                                    setSelectedSuburb(null);
                                    setSuburbSearch(e.target.value);
                                    setIsSuburbDropdownOpen(true);
                                }}
                                onFocus={() => setIsSuburbDropdownOpen(true)}
                                placeholder="e.g. Melbourne, Richmond, Geelong, Ballarat..."
                                className="w-full h-11 px-4 pl-10 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-sm font-medium text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] transition-all"
                            />
                            <MapPin className="size-4 text-slate-400 absolute left-3.5 top-3.5" />
                            {selectedSuburb && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedSuburb(null);
                                        setSuburbSearch('');
                                    }}
                                    className="absolute right-3 top-3 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 font-semibold"
                                >
                                    Change
                                </button>
                            )}
                        </div>

                        {/* Autocomplete Dropdown */}
                        {isSuburbDropdownOpen && !selectedSuburb && (
                            <div className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-xl py-1 text-sm">
                                {filteredSuburbs.length > 0 ? (
                                    filteredSuburbs.map((sub) => (
                                        <button
                                            key={sub.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedSuburb(sub);
                                                setIsSuburbDropdownOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800 flex items-center justify-between text-slate-700 dark:text-zinc-200 transition-colors"
                                        >
                                            <span className="font-medium">{sub.name}</span>
                                            <span className="text-xs text-slate-400 dark:text-zinc-500">
                                                VIC {sub.postcode || ''}
                                            </span>
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-4 py-2.5 text-xs text-slate-500 text-center">
                                        No suburb found. All Victoria areas serviced!
                                    </div>
                                )}
                            </div>
                        )}

                        {resolvedPickupZone && (
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1">
                                <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                                <span>Zone: <strong className="text-slate-700 dark:text-zinc-300">{resolvedPickupZone.name}</strong> (Doorstep Van Collection)</span>
                            </p>
                        )}
                    </div>

                    {/* 2. Box Size Selector */}
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                            2. Select Balikbayan Box Size
                        </label>
                        <div className="grid grid-cols-3 gap-2.5">
                            {activeBoxTypes.slice(0, 3).map((box) => {
                                const isSelected = selectedBoxTypeId === box.id;
                                const isJumbo = box.name.toLowerCase().includes('jumbo');

                                return (
                                    <button
                                        key={box.id}
                                        type="button"
                                        onClick={() => setSelectedBoxTypeId(box.id)}
                                        className={cn(
                                            "relative flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer",
                                            isSelected 
                                                ? "bg-orange-50/70 dark:bg-orange-950/30 border-[#c2410c] text-slate-900 dark:text-white shadow-xs ring-1 ring-[#c2410c]" 
                                                : "bg-slate-50/80 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                                        )}
                                    >
                                        {isJumbo && (
                                            <span className="absolute -top-2 px-2 py-0.5 rounded-full bg-[#c2410c] text-white text-[9px] font-bold uppercase tracking-wider shadow-2xs">
                                                Top Choice
                                            </span>
                                        )}
                                        <Package className={cn(
                                            "size-5 mb-1.5",
                                            isSelected ? "text-[#c2410c] dark:text-orange-400" : "text-slate-500"
                                        )} />
                                        <span className="text-xs font-bold">{box.name}</span>
                                        <span className="text-[10px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                            {box.dimensions ? `${box.dimensions}"` : 'Standard'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 3. Destination in the Philippines */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                                3. Destination in the Philippines
                            </label>
                            {selectedArea && (
                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                                    Zone: {selectedArea.name}
                                </span>
                            )}
                        </div>
                        {sortedProvinces && sortedProvinces.length > 0 ? (
                            <div>
                                <select
                                    value={selectedProvinceId || ''}
                                    onChange={(e) => setSelectedProvinceId(e.target.value ? Number(e.target.value) : null)}
                                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs sm:text-sm font-medium text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] transition-all cursor-pointer"
                                >
                                    <option value="" disabled>Select Philippine Province...</option>
                                    {sortedProvinces.map((prov) => (
                                        <option key={prov.id} value={prov.id}>
                                            {prov.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <div>
                                <select
                                    value={fallbackAreaId || ''}
                                    onChange={(e) => setFallbackAreaId(Number(e.target.value))}
                                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 text-xs sm:text-sm font-medium text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-[#c2410c]/30 focus:border-[#c2410c] transition-all cursor-pointer"
                                >
                                    {(areas || []).map((area) => (
                                        <option key={area.id} value={area.id}>
                                            {area.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Dynamic Price Summary Card */}
                <div className="lg:col-span-5 flex flex-col justify-between h-full bg-slate-50 dark:bg-zinc-800/60 rounded-2xl p-5 sm:p-6 border border-slate-200/80 dark:border-zinc-700/80">
                    <div>
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-700">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                Total Estimated Freight
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/30">
                                Door-to-Door All In
                            </span>
                        </div>

                        {/* Big Price Display */}
                        <div className="my-5 text-center sm:text-left">
                            <div className="flex items-baseline justify-center sm:justify-start gap-1">
                                <span className="text-2xl font-bold text-slate-500 dark:text-zinc-400">$</span>
                                <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                                    {calculatedRate !== null ? calculatedRate : '---'}
                                </span>
                                <span className="text-sm font-bold text-slate-500 dark:text-zinc-400 ml-1">AUD</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                                For {selectedBoxType?.name || 'Box'} to {selectedProvince?.name || selectedArea?.name || 'Philippines'}
                            </p>
                        </div>

                        {/* Breakdown Itemization */}
                        <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-zinc-700 text-xs">
                            <div className="flex justify-between text-slate-600 dark:text-zinc-300">
                                <span>Deposit on Box Delivery:</span>
                                <span className="font-semibold">${depositAmount} AUD</span>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-zinc-300">
                                <span>Balance upon Sealed Pickup:</span>
                                <span className="font-semibold">${balanceOnPickup !== null ? balanceOnPickup : '---'} AUD</span>
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-zinc-300">
                                <span>Ocean Transit Window:</span>
                                <span className="font-semibold text-slate-800 dark:text-zinc-100 flex items-center gap-1">
                                    <Clock className="size-3 text-slate-400" />
                                    {estimatedTimeline}
                                </span>
                            </div>
                        </div>

                        {/* Value Inclusions */}
                        <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-zinc-700 space-y-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>Includes Philippine BOC customs clearance</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span>Includes tamper-evident strapping & cargo insurance</span>
                            </div>
                        </div>
                    </div>

                    {/* Book Now Button */}
                    <div className="mt-6 pt-3">
                        <Button
                            asChild
                            size="lg"
                            className="w-full h-12 rounded-xl bg-[#c2410c] hover:bg-[#ea580c] text-white font-bold text-sm shadow-md inline-flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                        >
                            <Link href={bookingUrl} prefetch>
                                <span>Book This Box Now</span>
                                <ArrowRight className="size-4" />
                            </Link>
                        </Button>
                        <p className="text-[10px] text-center text-slate-400 dark:text-zinc-500 mt-2">
                            No immediate credit card required &bull; Pay deposit upon box delivery
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
