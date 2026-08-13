import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DollarSign, Percent, Box, Code, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface CommissionFormState {
    flatAmount: string;
    percentageRate: string;
    sizeJumbo: string;
    sizeRegular: string;
    sizeSmall: string;
}

interface CommissionCalculatorFormProps {
    commissionType: string;
    setCommissionType: (type: string) => void;
    commissionRates: string;
    setCommissionRates: (rates: string) => void;
    commissionForm: CommissionFormState;
    handleCommissionChange: (key: keyof CommissionFormState, value: string) => void;
    rawJsonMode: boolean;
    setRawJsonMode: (mode: boolean) => void;
}

export default function CommissionCalculatorForm({
    commissionType,
    setCommissionType,
    commissionRates,
    setCommissionRates,
    commissionForm,
    handleCommissionChange,
    rawJsonMode,
    setRawJsonMode,
}: CommissionCalculatorFormProps) {
    const [jsonError, setJsonError] = useState<string | null>(null);

    useEffect(() => {
        if (rawJsonMode && commissionRates) {
            try {
                JSON.parse(commissionRates);
                setJsonError(null);
            } catch (err: any) {
                setJsonError(err.message || 'Invalid JSON syntax');
            }
        } else {
            setJsonError(null);
        }
    }, [commissionRates, rawJsonMode]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-1">
                <Label htmlFor="commission_type" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground ml-0.5">
                    COMMISSION TYPE
                </Label>
                <button
                    type="button"
                    onClick={() => setRawJsonMode(!rawJsonMode)}
                    className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
                >
                    <Code className="size-3.5" />
                    {rawJsonMode ? 'FORM MODE' : 'JSON MODE'}
                </button>
            </div>

            {/* Segmented Pill Selector */}
            <div className="grid grid-cols-3 gap-1.5 p-1.5 bg-muted/40 rounded-2xl border border-border/60">
                <button
                    type="button"
                    onClick={() => setCommissionType('flat')}
                    className={`py-2.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all ${
                        commissionType === 'flat'
                            ? 'bg-card text-foreground shadow-2xs border border-border/40'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    FLAT RATE
                </button>
                <button
                    type="button"
                    onClick={() => setCommissionType('size')}
                    className={`py-2.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all ${
                        commissionType === 'size'
                            ? 'bg-card text-foreground shadow-2xs border border-border/40'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    SIZE-BASED
                </button>
                <button
                    type="button"
                    onClick={() => setCommissionType('percentage')}
                    className={`py-2.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider transition-all ${
                        commissionType === 'percentage'
                            ? 'bg-card text-foreground shadow-2xs border border-border/40'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    PERCENTAGE
                </button>
            </div>

            {!rawJsonMode ? (
                <div className="md:col-span-2 space-y-4 bg-muted/40 p-5 rounded-2xl border border-border/60">
                    {commissionType === 'flat' && (
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                FLAT AMOUNT PER BOX ($)
                            </Label>
                            <div className="relative max-w-xs">
                                <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
                                <Input
                                    type="number"
                                    step="0.01"
                                    className="h-11 rounded-lg border-border bg-card pl-9 text-xs font-semibold text-foreground"
                                    value={commissionForm.flatAmount}
                                    onChange={(e) => handleCommissionChange('flatAmount', e.target.value)}
                                    placeholder="5.00"
                                />
                            </div>
                        </div>
                    )}

                    {commissionType === 'percentage' && (
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                COMMISSION RATE (%)
                            </Label>
                            <div className="relative max-w-xs">
                                <Percent className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
                                <Input
                                    type="number"
                                    step="0.1"
                                    className="h-11 rounded-lg border-border bg-card pl-9 text-xs font-semibold text-foreground"
                                    value={commissionForm.percentageRate}
                                    onChange={(e) => handleCommissionChange('percentageRate', e.target.value)}
                                    placeholder="5.0"
                                />
                            </div>
                        </div>
                    )}

                    {commissionType === 'size' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <Box className="size-3.5 text-muted-foreground/60" /> JUMBO BOX ($)
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    className="h-11 rounded-lg border-border bg-card px-3.5 text-xs font-semibold text-foreground"
                                    value={commissionForm.sizeJumbo}
                                    onChange={(e) => handleCommissionChange('sizeJumbo', e.target.value)}
                                    placeholder="10.00"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <Box className="size-3.5 text-muted-foreground/60" /> REGULAR BOX ($)
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    className="h-11 rounded-lg border-border bg-card px-3.5 text-xs font-semibold text-foreground"
                                    value={commissionForm.sizeRegular}
                                    onChange={(e) => handleCommissionChange('sizeRegular', e.target.value)}
                                    placeholder="7.00"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <Box className="size-3.5 text-muted-foreground/60" /> SMALL BOX ($)
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    className="h-11 rounded-lg border-border bg-card px-3.5 text-xs font-semibold text-foreground"
                                    value={commissionForm.sizeSmall}
                                    onChange={(e) => handleCommissionChange('sizeSmall', e.target.value)}
                                    placeholder="5.00"
                                />
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-2 md:col-span-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="commission_rates" className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground ml-0.5">
                            RATES CONFIGURATION (JSON)
                        </Label>
                        {jsonError ? (
                            <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                                <AlertTriangle className="size-3.5" /> Invalid JSON
                            </span>
                        ) : (
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="size-3.5" /> Valid JSON Syntax
                            </span>
                        )}
                    </div>
                    <textarea
                        id="commission_rates"
                        className={`flex min-h-[120px] w-full rounded-xl border bg-card p-4 text-xs font-mono text-foreground focus:ring-2 transition-all shadow-2xs ${
                            jsonError
                                ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                                : 'border-border focus:ring-brand-rust/20 focus:border-brand-rust'
                        }`}
                        value={commissionRates}
                        onChange={(e) => setCommissionRates(e.target.value)}
                        placeholder="JSON Configuration"
                    />
                    {jsonError && (
                        <p className="text-[11px] font-bold text-red-500 ml-0.5 leading-snug">
                            {jsonError}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
