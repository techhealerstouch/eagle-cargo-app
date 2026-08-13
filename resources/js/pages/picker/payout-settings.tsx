import { Head, router, useForm } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Banknote, Wallet, Coins } from 'lucide-react';
import { useState, FormEvent } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BreadcrumbItem } from '@/types';

export default function PayoutSettings({ 
    stripe_account_id,
    stripe_onboarding_completed,
    preferred_payout_method,
    ewallet_details
}: { 
    stripe_account_id: string | null;
    stripe_onboarding_completed: boolean;
    preferred_payout_method: string | null;
    ewallet_details: { provider?: string; account?: string } | null;
}) {
    const [isProcessingStripe, setIsProcessingStripe] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        preferred_payout_method: preferred_payout_method || 'stripe',
        ewallet_provider: ewallet_details?.provider || '',
        ewallet_account: ewallet_details?.account || '',
    });

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/picker/dashboard' },
        { title: 'Payout Settings', href: '#' },
    ];

    const handleConnect = () => {
        setIsProcessingStripe(true);
        router.post('/picker/stripe-onboarding', {}, {
            onFinish: () => setIsProcessingStripe(false)
        });
    };

    const handleManage = () => {
        setIsProcessingStripe(true);
        router.post('/picker/stripe-onboarding/manage', {}, {
            onFinish: () => setIsProcessingStripe(false)
        });
    };

    const submitPreferences = (e: FormEvent) => {
        e.preventDefault();
        post('/picker/payout-preferences', {
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Payout Settings" />
            <div className="flex flex-1 flex-col p-8 max-w-4xl mx-auto w-full">
                <Heading
                    eyebrow="Settings"
                    title="Payout Settings"
                    description="Configure how you want to receive your commissions."
                />

                <div className="mt-8 bg-white border border-brand-warm/20 rounded-2xl shadow-sm p-8">
                    <form onSubmit={submitPreferences} className="space-y-8">
                        <div>
                            <Label className="text-lg font-bold text-brand-rust mb-4 block">Select Payout Method</Label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <Label
                                        onClick={() => setData('preferred_payout_method', 'stripe')}
                                        className={`flex flex-col items-center justify-center rounded-xl border-2 p-6 cursor-pointer transition-all ${
                                            data.preferred_payout_method === 'stripe' 
                                                ? 'border-brand-rust bg-brand-rust/5 text-brand-rust' 
                                                : 'border-muted bg-popover hover:bg-accent hover:text-accent-foreground'
                                        }`}
                                    >
                                        <Banknote className={`mb-3 h-8 w-8 ${data.preferred_payout_method === 'stripe' ? 'text-brand-rust' : 'text-muted-foreground'}`} />
                                        <div className="font-bold">Stripe Transfer</div>
                                        <div className="text-xs text-muted-foreground mt-1 text-center">Direct to bank (Automated)</div>
                                    </Label>
                                </div>
                                <div>
                                    <Label
                                        onClick={() => setData('preferred_payout_method', 'cash')}
                                        className={`flex flex-col items-center justify-center rounded-xl border-2 p-6 cursor-pointer transition-all ${
                                            data.preferred_payout_method === 'cash' 
                                                ? 'border-brand-rust bg-brand-rust/5 text-brand-rust' 
                                                : 'border-muted bg-popover hover:bg-accent hover:text-accent-foreground'
                                        }`}
                                    >
                                        <Coins className={`mb-3 h-8 w-8 ${data.preferred_payout_method === 'cash' ? 'text-brand-rust' : 'text-muted-foreground'}`} />
                                        <div className="font-bold">Cash</div>
                                        <div className="text-xs text-muted-foreground mt-1 text-center">Manual collection</div>
                                    </Label>
                                </div>
                                <div>
                                    <Label
                                        onClick={() => setData('preferred_payout_method', 'ewallet')}
                                        className={`flex flex-col items-center justify-center rounded-xl border-2 p-6 cursor-pointer transition-all ${
                                            data.preferred_payout_method === 'ewallet' 
                                                ? 'border-brand-rust bg-brand-rust/5 text-brand-rust' 
                                                : 'border-muted bg-popover hover:bg-accent hover:text-accent-foreground'
                                        }`}
                                    >
                                        <Wallet className={`mb-3 h-8 w-8 ${data.preferred_payout_method === 'ewallet' ? 'text-brand-rust' : 'text-muted-foreground'}`} />
                                        <div className="font-bold">E-Wallet</div>
                                        <div className="text-xs text-muted-foreground mt-1 text-center">PayPal, PayID, Wise</div>
                                    </Label>
                                </div>
                            </div>
                            {errors.preferred_payout_method && <p className="text-sm text-red-500 mt-2">{errors.preferred_payout_method}</p>}
                        </div>

                        {data.preferred_payout_method === 'stripe' && (
                            <div className="bg-brand-warm/10 rounded-xl p-6 border border-brand-warm/20">
                                {stripe_onboarding_completed ? (
                                    <div className="flex flex-col items-start gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                                                <CheckCircle className="size-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-brand-rust">Stripe Account Connected</h3>
                                                <p className="text-sm text-muted-foreground">Your bank account is linked via Stripe.</p>
                                            </div>
                                        </div>
                                        <Button 
                                            type="button"
                                            variant="outline"
                                            onClick={handleManage}
                                            disabled={isProcessingStripe}
                                        >
                                            {isProcessingStripe ? 'Loading...' : 'Manage Stripe Account'}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-start gap-4">
                                        <div>
                                            <h3 className="font-bold text-lg text-brand-rust mb-2">Connect Your Bank Account</h3>
                                            <p className="text-sm text-muted-foreground max-w-md">
                                                To receive automated payouts, connect your bank account securely through Stripe.
                                            </p>
                                        </div>
                                        <Button 
                                            type="button"
                                            onClick={handleConnect}
                                            disabled={isProcessingStripe}
                                        >
                                            {isProcessingStripe ? 'Redirecting...' : 'Connect with Stripe'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {data.preferred_payout_method === 'cash' && (
                            <div className="bg-brand-warm/10 rounded-xl p-6 border border-brand-warm/20">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="size-5 text-brand-secondary shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="font-bold text-brand-rust mb-1">Cash Payouts</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Your payouts will be manually processed by an administrator. The "Cash Out" button on your earnings page will be disabled.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {data.preferred_payout_method === 'ewallet' && (
                            <div className="bg-brand-warm/10 rounded-xl p-6 border border-brand-warm/20 space-y-4">
                                <div>
                                    <Label className="text-brand-secondary font-bold">E-Wallet Provider</Label>
                                    <Select 
                                        value={data.ewallet_provider} 
                                        onValueChange={(v) => setData('ewallet_provider', v)}
                                    >
                                        <SelectTrigger className="bg-white mt-1.5">
                                            <SelectValue placeholder="Select provider" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="paypal">PayPal</SelectItem>
                                            <SelectItem value="payid">PayID</SelectItem>
                                            <SelectItem value="wise">Wise</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {errors.ewallet_provider && <p className="text-sm text-red-500 mt-1">{errors.ewallet_provider}</p>}
                                </div>
                                <div>
                                    <Label className="text-brand-secondary font-bold">Account Details / Mobile Number</Label>
                                    <Input 
                                        value={data.ewallet_account}
                                        onChange={(e) => setData('ewallet_account', e.target.value)}
                                        className="bg-white mt-1.5"
                                        placeholder="e.g. Email address or phone number"
                                    />
                                    {errors.ewallet_account && <p className="text-sm text-red-500 mt-1">{errors.ewallet_account}</p>}
                                </div>
                                <div className="flex items-start gap-2 text-sm text-muted-foreground pt-2">
                                    <AlertCircle className="size-4 shrink-0 mt-0.5" />
                                    <p>Your payouts will be manually processed by an administrator via your selected E-Wallet.</p>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <Button type="submit" disabled={processing} className="w-full sm:w-auto">
                                {processing ? 'Saving...' : 'Save Preferences'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}
