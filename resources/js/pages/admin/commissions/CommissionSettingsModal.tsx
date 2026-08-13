import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings } from 'lucide-react';

export default function CommissionSettingsModal({ 
    defaultType,
    defaultRates,
    distanceRate = 0,
    cancellationFee = 0,
    payoutMinimumThreshold = 0,
    isOpen, 
    onClose 
}: { 
    defaultType: string;
    defaultRates: any;
    distanceRate?: number | string;
    cancellationFee?: number | string;
    payoutMinimumThreshold?: number | string;
    isOpen: boolean; 
    onClose: () => void;
}) {
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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-brand-rust">
                        <Settings className="size-5" />
                        Global Commission Settings
                    </DialogTitle>
                    <DialogDescription>
                        Configure the default commission rates for all pickers in the system.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-6 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="commission-type" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Commission Type</Label>
                        <Select 
                            value={commissionType} 
                            onValueChange={setCommissionType}
                        >
                            <SelectTrigger id="commission-type">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="flat">Flat Rate</SelectItem>
                                <SelectItem value="size">Size Based</SelectItem>
                                <SelectItem value="percentage">Percentage Based</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-4 bg-brand-warm/5 p-4 rounded-xl border border-brand-warm/10">
                        {commissionType === 'flat' && (
                            <div className="grid gap-2">
                                <Label htmlFor="rate-amount" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Flat Amount ($)</Label>
                                <Input 
                                    id="rate-amount" 
                                    type="number" 
                                    step="0.01" 
                                    min="0"
                                    value={rates?.amount ?? ''} 
                                    onChange={(e) => updateRate('amount', e.target.value)} 
                                />
                                <p className="text-[10px] text-muted-foreground">The default amount a picker receives per collected box.</p>
                            </div>
                        )}

                        {commissionType === 'percentage' && (
                            <div className="grid gap-2">
                                <Label htmlFor="rate-percentage" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Percentage (%)</Label>
                                <Input 
                                    id="rate-percentage" 
                                    type="number" 
                                    step="0.1" 
                                    min="0"
                                    max="100"
                                    value={rates?.percentage ?? ''} 
                                    onChange={(e) => updateRate('percentage', e.target.value)} 
                                />
                                <p className="text-[10px] text-muted-foreground">Default percentage of the box's total charged price.</p>
                            </div>
                        )}

                        {commissionType === 'size' && (
                            <div className="grid gap-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Default Rates per Size ($)</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="rate-jumbo">Jumbo</Label>
                                        <Input 
                                            id="rate-jumbo" 
                                            type="number" 
                                            step="0.01"
                                            value={rates?.sizes?.Jumbo ?? ''} 
                                            onChange={(e) => updateRate('Jumbo', e.target.value, true)} 
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="rate-regular">Regular</Label>
                                        <Input 
                                            id="rate-regular" 
                                            type="number" 
                                            step="0.01"
                                            value={rates?.sizes?.Regular ?? ''} 
                                            onChange={(e) => updateRate('Regular', e.target.value, true)} 
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="rate-small">Small</Label>
                                        <Input 
                                            id="rate-small" 
                                            type="number" 
                                            step="0.01"
                                            value={rates?.sizes?.Small ?? ''} 
                                            onChange={(e) => updateRate('Small', e.target.value, true)} 
                                        />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="rate-default">Default (Other)</Label>
                                        <Input 
                                            id="rate-default" 
                                            type="number" 
                                            step="0.01"
                                            value={rates?.sizes?.default ?? ''} 
                                            onChange={(e) => updateRate('default', e.target.value, true)} 
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="grid gap-2 mt-4 pt-4 border-t border-brand-warm/10">
                            <Label htmlFor="distance-rate" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Distance Bonus Rate ($ per km)</Label>
                            <Input 
                                id="distance-rate" 
                                type="number" 
                                step="0.01" 
                                min="0"
                                value={distance === 0 ? '' : distance} 
                                onChange={(e) => setDistance(parseFloat(e.target.value) || 0)} 
                            />
                            <p className="text-[10px] text-muted-foreground">Bonus calculated via Haversine distance between picker and sender.</p>
                        </div>
                        
                        <div className="grid gap-2">
                            <Label htmlFor="cancellation-fee" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cancellation Flat Fee ($)</Label>
                            <Input 
                                id="cancellation-fee" 
                                type="number" 
                                step="0.01" 
                                min="0"
                                value={cancellation === 0 ? '' : cancellation} 
                                onChange={(e) => setCancellation(parseFloat(e.target.value) || 0)} 
                            />
                            <p className="text-[10px] text-muted-foreground">Amount paid to pickers if a box is cancelled after dispatch.</p>
                        </div>

                        <div className="grid gap-2 mt-4 pt-4 border-t border-brand-warm/10">
                            <Label htmlFor="payout-threshold" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Minimum Payout Threshold ($)</Label>
                            <Input 
                                id="payout-threshold" 
                                type="number" 
                                step="0.01" 
                                min="0"
                                value={threshold === 0 ? '' : threshold} 
                                onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)} 
                            />
                            <p className="text-[10px] text-muted-foreground">Pickers cannot be paid out until their pending balance meets this threshold. Helps save on Stripe fees.</p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={isProcessing}>
                        {isProcessing ? 'Saving...' : 'Save Settings'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
