import { Head, router, useForm } from '@inertiajs/react';
import { ArrowRight, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';

import MarketingLayout from '@/layouts/marketing-layout';

interface Props {
    bookingId: number;
    bookingReference: string;
    purpose: string;
    accessQuery: string;
    email?: string | null;
}

export default function VerifyAccess({ bookingId, bookingReference, purpose, accessQuery, email }: Props) {
    const { data, setData, post, processing, errors } = useForm({ code: '' });
    const [cooldown, setCooldown] = useState(0);
    const [resending, setResending] = useState(false);

    const actionLabel =
        purpose === 'payment'
            ? 'payment'
            : purpose === 'confirmation'
              ? 'your order confirmation'
              : 'customs declaration';
    const maskedEmail = email ? email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3') : 'your booking email';

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [cooldown]);

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        post(`/guest/booking/${bookingId}/verify${accessQuery}`);
    };

    const handleResend = () => {
        if (cooldown > 0 || resending) return;
        setResending(true);
        const separator = accessQuery.includes('?') ? '&' : '?';
        router.get(
            `/guest/booking/${bookingId}/verify${accessQuery}${separator}resend=1`,
            {},
            {
                preserveState: true,
                onSuccess: () => {
                    setCooldown(30);
                    toast.success('A new 6-digit verification code has been sent to your email.');
                },
                onError: () => {
                    toast.error('Unable to resend verification code. Please try again.');
                },
                onFinish: () => {
                    setResending(false);
                },
            }
        );
    };

    return (
        <MarketingLayout>
            <Head title="Verify Email | Eagle Express Cargo" />
            <main className="mx-auto flex min-h-[70vh] max-w-md items-center px-4 py-10">
                <section className="w-full space-y-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm sm:p-8">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400">
                        <ShieldCheck className="size-6" />
                    </div>
                    <div className="space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-400">
                            Secure guest access
                        </p>
                        <h1 className="font-serif text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                            Verify your email
                        </h1>
                        <p className="text-xs sm:text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                            We sent a one-time 6-digit code to <strong className="text-zinc-900 dark:text-zinc-100">{maskedEmail}</strong> before you can continue with {actionLabel} for booking <strong className="font-mono text-zinc-900 dark:text-zinc-100">{bookingReference}</strong>.
                        </p>
                    </div>
                    <form onSubmit={submit} className="space-y-4">
                        <label className="block space-y-2 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                            Verification code
                            <input
                                value={data.code}
                                onChange={(event) => setData('code', event.target.value.replace(/\D/g, '').slice(0, 6))}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                placeholder="000000"
                                title="Enter the 6-digit verification code sent by email"
                                className="h-12 w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 text-center font-mono text-lg tracking-[0.35em] text-zinc-900 dark:text-zinc-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-950/40"
                            />
                            {errors.code && <span className="block text-xs font-medium normal-case tracking-normal text-red-600">{errors.code}</span>}
                        </label>
                        <button
                            type="submit"
                            disabled={processing || data.code.length !== 6}
                            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 dark:bg-zinc-100 px-5 text-sm font-bold text-white dark:text-zinc-950 transition hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                        >
                            <Mail className="size-4" />
                            <span>{processing ? 'Verifying...' : 'Verify and continue'}</span>
                            <ArrowRight className="size-4" />
                        </button>
                    </form>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400">
                        <span>Expires in 10 minutes.</span>
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={cooldown > 0 || resending}
                            className="inline-flex items-center gap-1.5 font-semibold text-sky-700 dark:text-sky-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer"
                        >
                            <RefreshCw className={`size-3.5 ${resending ? 'animate-spin' : ''}`} />
                            <span>
                                {cooldown > 0 ? `Resend code (${cooldown}s)` : resending ? 'Sending...' : 'Resend verification code'}
                            </span>
                        </button>
                    </div>
                </section>
            </main>
        </MarketingLayout>
    );
}
