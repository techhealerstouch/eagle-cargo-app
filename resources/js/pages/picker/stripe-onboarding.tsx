import { Head, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Banknote } from 'lucide-react';
import { useState } from 'react';
import type { BreadcrumbItem } from '@/types';

export default function StripeOnboarding({ 
    stripe_account_id,
    stripe_onboarding_completed 
}: { 
    stripe_account_id: string | null;
    stripe_onboarding_completed: boolean;
}) {
    const [isProcessing, setIsProcessing] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/picker/dashboard' },
        { title: 'Bank Account Connection', href: '#' },
    ];

    const handleConnect = () => {
        setIsProcessing(true);
        router.post('/picker/stripe-onboarding', {}, {
            onFinish: () => setIsProcessing(false)
        });
    };

    const handleManage = () => {
        setIsProcessing(true);
        router.post('/picker/stripe-onboarding/manage', {}, {
            onFinish: () => setIsProcessing(false)
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Connect Bank Account" />
            <div className="flex flex-1 flex-col p-8 max-w-4xl mx-auto w-full">
                <Heading
                    eyebrow="Payouts Setup"
                    title="Connect Bank Account"
                    description="Link your bank account to receive automated payout transfers."
                />

                <div className="mt-8 bg-white border border-brand-warm/20 rounded-2xl shadow-sm p-8">
                    {stripe_onboarding_completed ? (
                        <div className="flex flex-col items-center justify-center text-center py-12">
                            <div className="size-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle className="size-8" />
                            </div>
                            <h2 className="text-2xl font-bold text-brand-rust mb-2">Account Connected Successfully</h2>
                            <p className="text-muted-foreground max-w-md mb-8">
                                Your bank account is linked via Stripe. You are ready to receive automated payouts for your completed box collections.
                            </p>

                            <Button 
                                size="lg" 
                                variant="outline"
                                className="w-full max-w-sm gap-2 text-lg h-14"
                                onClick={handleManage}
                                disabled={isProcessing}
                            >
                                {isProcessing ? 'Redirecting to Stripe...' : 'Manage Stripe Account'}
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center py-8">
                            <div className="size-16 bg-brand-warm/10 text-brand-rust rounded-full flex items-center justify-center mb-6">
                                <Banknote className="size-8" />
                            </div>
                            <h2 className="text-2xl font-bold text-brand-rust mb-4">Connect Your Bank Account</h2>
                            <p className="text-muted-foreground max-w-md mb-8">
                                To receive payouts for your commissions, you need to connect a bank account. We use Stripe to securely transfer your earnings directly to you.
                            </p>
                            
                            <Button 
                                size="lg" 
                                className="w-full max-w-sm gap-2 text-lg h-14"
                                onClick={handleConnect}
                                disabled={isProcessing}
                            >
                                {isProcessing ? 'Redirecting to Stripe...' : 'Connect with Stripe'}
                            </Button>
                            
                            <div className="mt-8 flex items-start gap-3 text-left max-w-md bg-blue-50 text-blue-800 p-4 rounded-xl border border-blue-100">
                                <AlertCircle className="size-5 shrink-0 mt-0.5" />
                                <p className="text-sm">
                                    You will be redirected to Stripe's secure portal to enter your routing and account numbers. We do not store your banking details.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
