import { Head, router } from '@inertiajs/react';
import { useState, useCallback, useEffect } from 'react';
import { DollarSign, Check, Loader2, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import admin from '@/routes/admin';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface PickupZone {
    id: number;
    name: string;
}

interface Area {
    id: number;
    name: string;
}

interface BoxType {
    id: number;
    name: string;
    dimensions: string | null;
}

interface PriceEntry {
    id: number;
    pickup_zone_id: number;
    area_id: number;
    box_type_id: number;
    price: number | string;
}

interface Props {
    pickupZones: PickupZone[];
    areas: Area[];
    boxTypes: BoxType[];
    prices: PriceEntry[];
}

type PriceMap = Record<string, PriceEntry>;

function buildKey(zoneId: number, areaId: number, boxTypeId: number) {
    return `${zoneId}-${areaId}-${boxTypeId}`;
}

function buildPriceMap(prices: PriceEntry[]): PriceMap {
    const map: PriceMap = {};
    prices.forEach(p => {
        map[buildKey(p.pickup_zone_id, p.area_id, p.box_type_id)] = p;
    });
    return map;
}

interface PriceCellProps {
    zoneId: number;
    areaId: number;
    boxTypeId: number;
    zoneName: string;
    areaName: string;
    boxTypeName: string;
    priceMap: PriceMap;
    onSave: (zoneId: number, areaId: number, boxTypeId: number, value: string, existing?: PriceEntry) => Promise<void>;
}

function getSuggestedPrice(zoneName: string, areaName: string, boxTypeName: string): string {
    const isJumbo = boxTypeName.toLowerCase().includes('jumbo');
    if (!isJumbo) return '0.00'; // Define rates primarily for Jumbo

    const z = zoneName.toLowerCase();
    const a = areaName.toLowerCase();

    let group = 'metro';
    if (z.includes('ballarat') || z.includes('geelong') || z.includes('kyneton')) group = 'ballarat';
    else if (z.includes('shepparton') || z.includes('gippsland') || z.includes('bendigo')) group = 'shepparton';
    else if (z.includes('western') || z.includes('victoria')) group = 'western';

    const rates: Record<string, Record<string, string>> = {
        metro: { manila: '95.00', outer: '105.00', ncr: '105.00', luzon: '105.00', visayas: '130.00', mindanao: '140.00', inter: '150.00' },
        ballarat: { manila: '110.00', outer: '120.00', ncr: '120.00', luzon: '120.00', visayas: '140.00', mindanao: '150.00', inter: '160.00' },
        shepparton: { manila: '140.00', outer: '150.00', ncr: '150.00', luzon: '150.00', visayas: '175.00', mindanao: '185.00', inter: '200.00' },
        western: { manila: '150.00', outer: '150.00', ncr: '150.00', luzon: '160.00', visayas: '180.00', mindanao: '190.00', inter: '220.00' },
    };

    const zoneRates = rates[group];
    
    if (a.includes('manila')) return zoneRates.manila;
    if (a.includes('outer') || a.includes('ncr')) return zoneRates.outer;
    if (a.includes('luzon')) return zoneRates.luzon;
    if (a.includes('visayas')) return zoneRates.visayas;
    if (a.includes('mindanao')) return zoneRates.mindanao;
    if (a.includes('inter')) return zoneRates.inter;

    return '0.00';
}

function PriceCell({ zoneId, areaId, boxTypeId, zoneName, areaName, boxTypeName, priceMap, onSave }: PriceCellProps) {
    const key = buildKey(zoneId, areaId, boxTypeId);
    const existing = priceMap[key];
    const suggestedPrice = getSuggestedPrice(zoneName, areaName, boxTypeName);
    const [editing, setEditing] = useState(false);
    const [inputVal, setInputVal] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const displayPrice = existing ? Number(existing.price).toFixed(2) : null;

    const startEdit = () => {
        if (saving) return;
        setInputVal(displayPrice ?? suggestedPrice);
        setEditing(true);
    };

    const save = async () => {
        if (saving) return;
        const trimmed = inputVal.trim();
        if (trimmed === '' || isNaN(Number(trimmed))) {
            setEditing(false);
            return;
        }
        if (existing && Number(trimmed) === Number(existing.price)) {
            setEditing(false);
            return;
        }
        setEditing(false);
        setSaving(true);
        try {
            await onSave(zoneId, areaId, boxTypeId, trimmed, existing);
            setSaved(true);
            setTimeout(() => setSaved(false), 1500);
        } catch {
            setInputVal(displayPrice ?? suggestedPrice);
        } finally {
            setSaving(false);
        }
    };

    if (editing) {
        return (
            <td className="px-3 py-2 text-center">
                <div className="flex items-center gap-1 justify-center">
                    <span className="text-xs text-zinc-400">$</span>
                    <input
                        autoFocus
                        type="number"
                        step="0.01"
                        min="0"
                        value={inputVal}
                        onChange={e => setInputVal(e.target.value)}
                        onBlur={save}
                        onKeyDown={e => {
                            if (e.key === 'Enter') save();
                            if (e.key === 'Escape') setEditing(false);
                        }}
                        className="w-20 h-7 text-xs text-center rounded border border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-blue-50 font-medium"
                    />
                </div>
            </td>
        );
    }

    return (
        <td
            className="px-3 py-2 text-center cursor-pointer group"
            onClick={startEdit}
            title="Click to edit price"
        >
            {saving ? (
                <span className="flex items-center justify-center gap-1">
                    <Loader2 className="size-3 animate-spin text-blue-500" />
                </span>
            ) : saved ? (
                <span className="flex items-center justify-center gap-1 text-emerald-600">
                    <Check className="size-3" />
                    <span className="text-xs font-medium">${Number(inputVal).toFixed(2)}</span>
                </span>
            ) : displayPrice ? (
                <span className="text-xs font-semibold text-zinc-800 group-hover:text-blue-600 transition-colors">
                    ${displayPrice}
                </span>
            ) : (
                <span className="text-xs text-zinc-400 group-hover:text-blue-500 transition-colors" title={`Suggested: $${suggestedPrice}`}>
                    ${suggestedPrice}
                </span>
            )}
        </td>
    );
}

export default function BookingRatesIndex({ pickupZones, areas, boxTypes, prices }: Props) {
    const [priceMap, setPriceMap] = useState<PriceMap>(() => buildPriceMap(prices));
    const [activeZoneId, setActiveZoneId] = useState<number | null>(() => pickupZones[0]?.id ?? null);
    const [copyFromZoneId, setCopyFromZoneId] = useState<string>('');
    const [isCopying, setIsCopying] = useState(false);
    const [canUndoZoneId, setCanUndoZoneId] = useState<number | null>(null);

    useEffect(() => {
        setPriceMap(buildPriceMap(prices));
    }, [prices]);

    const activeZone = pickupZones.find(z => z.id === activeZoneId) || pickupZones[0];

    const handleCopy = () => {
        if (!copyFromZoneId || !activeZoneId) return;
        setIsCopying(true);
        router.post('/admin/box-prices/copy', {
            from_zone_id: copyFromZoneId,
            to_zone_id: activeZoneId,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setCanUndoZoneId(activeZoneId);
                toast.success('Rates copied successfully.', {
                    action: {
                        label: 'Undo',
                        onClick: () => handleUndo(activeZoneId)
                    }
                });
                setCopyFromZoneId('');
            },
            onError: () => toast.error('Failed to copy rates.'),
            onFinish: () => setIsCopying(false),
        });
    };

    const handleUndo = (zoneId: number) => {
        setIsCopying(true);
        router.post('/admin/box-prices/undo-copy', {
            zone_id: zoneId,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Copy action undone.');
                setCanUndoZoneId(null);
            },
            onError: () => toast.error('Failed to undo.'),
            onFinish: () => setIsCopying(false),
        });
    };

    const handleSave = useCallback(async (
        zoneId: number,
        areaId: number,
        boxTypeId: number,
        value: string,
        existing?: PriceEntry
    ) => {
        const key = buildKey(zoneId, areaId, boxTypeId);

        const optimistic: PriceEntry = existing && existing.id > 0
            ? { ...existing, price: value }
            : { id: existing?.id ?? -Date.now(), pickup_zone_id: zoneId, area_id: areaId, box_type_id: boxTypeId, price: value };

        setPriceMap(prev => ({ ...prev, [key]: optimistic }));

        try {
            if (existing && existing.id > 0) {
                const res = await fetch(admin.boxPrices.update(existing.id).url, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({ price: value }),
                });
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    const msg = errorData?.message || 'Failed to update price';
                    throw new Error(msg);
                }
                const json = await res.json();
                setPriceMap(prev => ({ ...prev, [key]: json.price }));
            } else {
                const res = await fetch(admin.boxPrices.store().url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ?? '',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({
                        pickup_zone_id: zoneId,
                        area_id: areaId,
                        box_type_id: boxTypeId,
                        price: value,
                    }),
                });
                if (!res.ok) {
                    const errorData = await res.json().catch(() => ({}));
                    const msg = errorData?.message || 'Failed to save price';
                    throw new Error(msg);
                }
                const json = await res.json();
                setPriceMap(prev => ({ ...prev, [key]: json.price }));
            }
        } catch (error: any) {
            // Revert on failure
            setPriceMap(prev => {
                const next = { ...prev };
                if (existing && existing.id > 0) {
                    next[key] = existing;
                } else {
                    delete next[key];
                }
                return next;
            });
            toast.error(error instanceof Error ? error.message : 'Failed to save price. Please try again.');
            throw error;
        }
    }, []);

    const breadcrumbs = [
        { title: 'Settings', href: admin.bookingRates.index().url },
        { title: 'Booking Rates', href: admin.bookingRates.index().url },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Booking Rates" />
            <SettingsLayout
                eyebrow="Operations"
                title="Booking Rates"
                description="Manage shipping prices by pickup area, destination area, and box size. Click any cell to edit."
            >
                <div className="space-y-6">
                    {/* Legend */}
                    <div className="flex items-center gap-4 text-xs text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-2.5">
                        <DollarSign className="size-3.5 text-zinc-400 shrink-0" />
                        <span>Click any price cell to edit inline. Press <kbd className="px-1 py-0.5 rounded bg-zinc-200 text-zinc-700 font-mono text-[10px]">Enter</kbd> to save or <kbd className="px-1 py-0.5 rounded bg-zinc-200 text-zinc-700 font-mono text-[10px]">Esc</kbd> to cancel.</span>
                        <span className="ml-auto text-zinc-400 italic">Prices are in AUD ($)</span>
                    </div>

                    {/* Zone Tabs */}
                    {pickupZones.length > 0 && (
                        <div className="flex border-b border-zinc-200 gap-2 overflow-x-auto">
                            {pickupZones.map(zone => {
                                const isActive = activeZone?.id === zone.id;
                                return (
                                    <button
                                        key={zone.id}
                                        type="button"
                                        onClick={() => setActiveZoneId(zone.id)}
                                        className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                                            isActive
                                                ? 'border-zinc-900 text-zinc-900 font-semibold'
                                                : 'border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300'
                                        }`}
                                    >
                                        {zone.name}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Active Zone Table */}
                    {activeZone && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3">
                                <h3 className="text-sm font-medium text-zinc-800">
                                    Rates for {activeZone.name}
                                </h3>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-medium text-zinc-600">Copy rates from:</span>
                                    <Select 
                                        value={copyFromZoneId} 
                                        onValueChange={setCopyFromZoneId}
                                    >
                                        <SelectTrigger className="w-[200px] h-8 text-xs bg-white">
                                            <SelectValue placeholder="Select zone..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {pickupZones.filter(z => z.id !== activeZone.id).map(z => (
                                                <SelectItem key={z.id} value={z.id.toString()}>
                                                    {z.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button 
                                        type="button" 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-8 text-xs"
                                        disabled={!copyFromZoneId || isCopying}
                                        onClick={handleCopy}
                                    >
                                        {isCopying ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Copy className="size-3.5 mr-1.5" />}
                                        Copy Rates
                                    </Button>
                                    {canUndoZoneId === activeZone.id && (
                                        <Button 
                                            type="button" 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-8 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                            onClick={() => handleUndo(activeZone.id)}
                                            disabled={isCopying}
                                        >
                                            Undo Copy
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-xs">
                                <div className="overflow-x-auto">
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-zinc-50 border-b border-zinc-200">
                                            <th className="px-4 py-2.5 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider w-48">
                                                Destination Area
                                            </th>
                                            {boxTypes.map(bt => (
                                                <th
                                                    key={bt.id}
                                                    className="px-3 py-2.5 text-center text-xs font-semibold text-zinc-500 uppercase tracking-wider min-w-[110px]"
                                                >
                                                    <div>{bt.name}</div>
                                                    {bt.dimensions && (
                                                        <div className="text-[10px] font-normal text-zinc-400 normal-case tracking-normal mt-0.5">
                                                            {bt.dimensions}
                                                        </div>
                                                    )}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {areas.map((area, idx) => (
                                            <tr
                                                key={area.id}
                                                className={idx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/50'}
                                            >
                                                <td className="px-4 py-2.5 text-xs font-medium text-zinc-800 border-r border-zinc-100">
                                                    {area.name}
                                                </td>
                                                {boxTypes.map(bt => (
                                                    <PriceCell
                                                        key={bt.id}
                                                        zoneId={activeZone.id}
                                                        areaId={area.id}
                                                        boxTypeId={bt.id}
                                                        zoneName={activeZone.name}
                                                        areaName={area.name}
                                                        boxTypeName={bt.name}
                                                        priceMap={priceMap}
                                                        onSave={handleSave}
                                                    />
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    )}

                    {pickupZones.length === 0 && (
                        <div className="text-center py-16 text-zinc-400">
                            <DollarSign className="size-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-medium">No active pickup areas configured.</p>
                            <p className="text-xs mt-1">Add pickup areas first, then return here to set rates.</p>
                        </div>
                    )}
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
