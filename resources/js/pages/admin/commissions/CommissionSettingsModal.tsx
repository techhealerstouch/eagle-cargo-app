import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
    Sliders, 
    DollarSign, 
    Percent, 
    Layers, 
    MapPin, 
    ShieldCheck, 
    AlertCircle, 
    Package, 
    Check,
    Coins,
    Ban,
    RefreshCw
} from 'lucide-react';

interface Props {
    defaultType: string;
    defaultRates: any;
    distanceRate?: number | string;
    cancellationFee?: number | string;
    payoutMinimumThreshold?: number | string;
    isOpen: boolean;
    onClose: () => void;
}

export default function CommissionSettingsModal({ 
    defaultType,
    defaultRates,
    distanceRate = 0,
    cancellationFee = 0,
    payoutMinimumThreshold = 0,
    isOpen, 
    onClose 
}: Props) {
    const [commissionType, setCommissionType] = useState(defaultType || 'flat');
    const [rates, setRates] = useState<any>({});
    const [distance, setDistance] = useState(distanceRate || 0);
    const [cancellation, setCancellation] = useState(cancellationFee || 0);
    const [threshold, setThreshold] = useState(payoutMinimumThreshold || 0);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setCommissionType(defaultType || 'flat');
            setRates(defaultRates || { amount: 5.0 });
            setDistance(distanceRate || 0);
            setCancellation(cancellationFee || 0);
            setThreshold(payoutMinimumThreshold || 0);
        }
    }, [isOpen, defaultType, defaultRates, distanceRate, cancellationFee, payoutMinimumThreshold]);

    const handleSave = () => {
        setIsProcessing(true);
        router.put('/admin/commissions/settings', {
            commission_type: commissionType,
            commission_rates: rates,
            distance_rate_per_km: distance,
            cancellation_flat_fee: cancellation,
            payout_minimum_threshold: threshold
        }, {
            onSuccess: () => {
                setIsProcessing(false);
                onClose();
            },
            onError: () => setIsProcessing(false)
        });
    };

    const updateRate = (key: string, value: string, isSize: boolean = false) => {
        const numValue = parseFloat(value) || 0;
        if (isSize) {
            setRates({ ...rates, sizes: { ...rates?.sizes, [key]: numValue } });
        } else {
            setRates({ ...rates, [key]: numValue });
        }
    };

    const commissionModels = [
        {
            id: 'flat',
            name: 'Flat Rate',
            desc: 'Fixed dollar amount per collected cargo box.',
            icon: DollarSign,
            badge: 'Most Popular',
            color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        },
        {
            id: 'size',
            name: 'Size Tiered',
            desc: 'Custom rates tailored per box dimension.',
            icon: Layers,
            badge: 'Variable',
            color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
        },
        {
            id: 'percentage',
            name: 'Percentage',
            desc: 'Fixed % of total collected box freight charge.',
            icon: Percent,
            badge: 'Revenue Share',
            color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20',
        },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-2xl border-border/80 shadow-xl">
                {/* Modal Header */}
                <div className="p-6 border-b border-border/60 bg-muted/20">
                    <DialogHeader className="space-y-1.5">
                        <div className="flex items-center gap-3">
                            <div className="size-11 rounded-xl bg-brand-rust/10 text-brand-rust flex items-center justify-center shrink-0 border border-brand-rust/20">
                                <Sliders className="size-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                                    Global Commission Rules
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    Configure base earning rates, distance bonuses, and payout limits for pickers across the platform.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="p-6 space-y-6">
                    {/* Section 1: Earning Model Selection */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Default Commission Model
                            </Label>
                            <span className="text-[11px] text-muted-foreground">
                                Applied when a picker has no custom rate
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {commissionModels.map((model) => {
                                const isSelected = commissionType === model.id;
                                const Icon = model.icon;

                                return (
                                    <button
                                        type="button"
                                        key={model.id}
                                        onClick={() => setCommissionType(model.id)}
                                        className={`relative p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 ${
                                            isSelected
                                                ? 'border-brand-rust bg-brand-rust/[0.04] dark:bg-brand-rust/[0.08] ring-1 ring-brand-rust shadow-xs'
                                                : 'border-border/70 hover:border-border bg-card hover:bg-muted/30'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between w-full">
                                            <div className={`size-8 rounded-lg flex items-center justify-center ${model.color}`}>
                                                <Icon className="size-4" />
                                            </div>
                                            {isSelected ? (
                                                <div className="size-5 rounded-full bg-brand-rust text-white flex items-center justify-center shadow-2xs">
                                                    <Check className="size-3 stroke-[3]" />
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-medium text-muted-foreground">
                                                    {model.badge}
                                                </span>
                                            )}
                                        </div>

                                        <div>
                                            <p className="text-sm font-bold text-foreground">
                                                {model.name}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                                                {model.desc}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Section 2: Rate Inputs Based on Selected Model */}
                    <div className="rounded-xl border border-border/80 bg-card p-4 space-y-4 shadow-2xs">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                            <Coins className="size-4 text-brand-rust" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                                Rate Parameters ({commissionModels.find(m => m.id === commissionType)?.name})
                            </h4>
                        </div>

                        {commissionType === 'flat' && (
                            <div className="space-y-2">
                                <Label htmlFor="rate-amount" className="text-xs font-semibold text-foreground">
                                    Flat Rate per Box (AUD)
                                </Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                                        $
                                    </span>
                                    <Input 
                                        id="rate-amount" 
                                        type="number" 
                                        step="0.01" 
                                        min="0"
                                        placeholder="5.00"
                                        value={rates?.amount ?? ''} 
                                        onChange={(e) => updateRate('amount', e.target.value)} 
                                        className="pl-8 h-10 font-semibold text-sm"
                                    />
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Standard flat payment credited to the picker for each collected box marked on their runsheet.
                                </p>
                            </div>
                        )}

                        {commissionType === 'percentage' && (
                            <div className="space-y-2">
                                <Label htmlFor="rate-percentage" className="text-xs font-semibold text-foreground">
                                    Commission Percentage (%)
                                </Label>
                                <div className="relative">
                                    <Input 
                                        id="rate-percentage" 
                                        type="number" 
                                        step="0.1" 
                                        min="0" 
                                        max="100"
                                        placeholder="10.0"
                                        value={rates?.percentage ?? ''} 
                                        onChange={(e) => updateRate('percentage', e.target.value)} 
                                        className="pr-8 h-10 font-semibold text-sm"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                                        %
                                    </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground">
                                    Calculated as a share of the box invoice freight charge before taxes and discounts.
                                </p>
                            </div>
                        )}

                        {commissionType === 'size' && (
                            <div className="space-y-3">
                                <p className="text-[11px] text-muted-foreground">
                                    Define specific compensation rates based on box dimensions and capacity tiers:
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="rate-jumbo" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <Package className="size-3.5 text-brand-rust" /> Jumbo Box
                                            </Label>
                                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">Large</Badge>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">$</span>
                                            <Input 
                                                id="rate-jumbo" 
                                                type="number" 
                                                step="0.01"
                                                placeholder="6.00"
                                                value={rates?.sizes?.Jumbo ?? ''} 
                                                onChange={(e) => updateRate('Jumbo', e.target.value, true)} 
                                                className="pl-7 h-9 text-xs font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="rate-regular" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <Package className="size-3.5 text-blue-600" /> Regular Box
                                            </Label>
                                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">Standard</Badge>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">$</span>
                                            <Input 
                                                id="rate-regular" 
                                                type="number" 
                                                step="0.01"
                                                placeholder="5.00"
                                                value={rates?.sizes?.Regular ?? ''} 
                                                onChange={(e) => updateRate('Regular', e.target.value, true)} 
                                                className="pl-7 h-9 text-xs font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="rate-small" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <Package className="size-3.5 text-amber-600" /> Small Box
                                            </Label>
                                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">Compact</Badge>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">$</span>
                                            <Input 
                                                id="rate-small" 
                                                type="number" 
                                                step="0.01"
                                                placeholder="4.00"
                                                value={rates?.sizes?.Small ?? ''} 
                                                onChange={(e) => updateRate('Small', e.target.value, true)} 
                                                className="pl-7 h-9 text-xs font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="p-3 rounded-lg border border-border/70 bg-muted/20 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="rate-default" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                <Package className="size-3.5 text-zinc-500" /> Custom / Other
                                            </Label>
                                            <Badge variant="outline" className="text-[10px] py-0 px-1.5">Fallback</Badge>
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">$</span>
                                            <Input 
                                                id="rate-default" 
                                                type="number" 
                                                step="0.01"
                                                placeholder="5.00"
                                                value={rates?.sizes?.default ?? ''} 
                                                onChange={(e) => updateRate('default', e.target.value, true)} 
                                                className="pl-7 h-9 text-xs font-medium"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section 3: Distance & Operational Rules */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2.5 shadow-2xs">
                            <div className="flex items-center gap-2">
                                <div className="size-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                    <MapPin className="size-3.5" />
                                </div>
                                <Label htmlFor="distance-rate" className="text-xs font-bold text-foreground">
                                    Distance Rate ($ / km)
                                </Label>
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">$</span>
                                <Input 
                                    id="distance-rate" 
                                    type="number" 
                                    step="0.01" 
                                    min="0" 
                                    placeholder="0.00"
                                    value={distance === 0 ? '' : distance} 
                                    onChange={(e) => setDistance(parseFloat(e.target.value) || 0)} 
                                    className="pl-7 h-9 text-xs"
                                />
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                                Haversine radial distance bonus credited for longer transit pickup routes.
                            </p>
                        </div>

                        <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2.5 shadow-2xs">
                            <div className="flex items-center gap-2">
                                <div className="size-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                    <Ban className="size-3.5" />
                                </div>
                                <Label htmlFor="cancellation-fee" className="text-xs font-bold text-foreground">
                                    Cancellation Fee ($)
                                </Label>
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">$</span>
                                <Input 
                                    id="cancellation-fee" 
                                    type="number" 
                                    step="0.01" 
                                    min="0" 
                                    placeholder="0.00"
                                    value={cancellation === 0 ? '' : cancellation} 
                                    onChange={(e) => setCancellation(parseFloat(e.target.value) || 0)} 
                                    className="pl-7 h-9 text-xs"
                                />
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                                Compensation disbursed to a picker if a booking is cancelled after runsheet dispatch.
                            </p>
                        </div>
                    </div>

                    {/* Section 4: Payout Safeguards & Threshold */}
                    <div className="p-4 rounded-xl border border-border/80 bg-card space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="size-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                                    <ShieldCheck className="size-3.5" />
                                </div>
                                <Label htmlFor="payout-threshold" className="text-xs font-bold text-foreground">
                                    Minimum Payout Threshold ($)
                                </Label>
                            </div>
                            <Badge variant="outline" className="text-[10px] text-purple-600 dark:text-purple-400 border-purple-500/20 bg-purple-500/5 font-semibold">
                                Stripe Fee Protection
                            </Badge>
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">$</span>
                            <Input 
                                id="payout-threshold" 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                placeholder="0.00"
                                value={threshold === 0 ? '' : threshold} 
                                onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)} 
                                className="pl-7 h-9 text-xs font-medium"
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Pickers cannot be paid out until their unsettled ledger balance reaches this value. Setting a threshold helps minimize overhead and micro-transaction fees on Stripe payouts.
                        </p>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 px-6 border-t border-border/60 bg-muted/20 flex items-center justify-end gap-3">
                    <Button 
                        type="button"
                        variant="outline" 
                        onClick={onClose} 
                        disabled={isProcessing}
                        className="h-10 px-5 rounded-xl text-sm font-semibold border-border/80 hover:bg-muted/60 transition-all"
                    >
                        Cancel
                    </Button>
                    <Button 
                        type="button"
                        onClick={handleSave} 
                        disabled={isProcessing}
                        className="h-10 px-6 rounded-xl text-sm font-semibold bg-brand-rust hover:bg-brand-rust/90 text-white shadow-md shadow-brand-rust/20 transition-all flex items-center gap-2"
                    >
                        {isProcessing ? (
                            <>
                                <RefreshCw className="size-4 animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <>
                                <Check className="size-4" />
                                <span>Save Settings</span>
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
