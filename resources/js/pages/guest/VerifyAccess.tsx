import { Head, useForm } from '@inertiajs/react';
import { ArrowRight, Mail, ShieldCheck } from 'lucide-react';
import { FormEvent } from 'react';

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
    const actionLabel = purpose === 'payment' ? 'payment' : 'customs declaration';
    const maskedEmail = email ? email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3') : 'your booking email';

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        post(`/guest/booking/${bookingId}/verify${accessQuery}`);
    };

    return (
        <MarketingLayout>
            <Head title="Verify Guest Access" />
            <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-4 py-12">
                <section className="w-full space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl sm:p-10">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                        <ShieldCheck className="size-7" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Secure guest access</p>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-950">Verify your email</h1>
                        <p className="text-sm leading-6 text-zinc-600">
                            We sent a one-time code to <strong>{maskedEmail}</strong> before you can continue with {actionLabel} for booking <strong>{bookingReference}</strong>.
                        </p>
                    </div>
                    <form onSubmit={submit} className="space-y-5">
                        <label className="block space-y-2 text-sm font-semibold text-zinc-800">
                            Verification code
                            <input
                                value={data.code}
                                onChange={(event) => setData('code', event.target.value)}
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                placeholder="Enter 6-digit code"
                                title="Enter the 6-digit verification code sent by email"
                                className="h-12 w-full rounded-xl border border-zinc-300 px-4 text-center text-lg tracking-[0.35em] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            />
                            {errors.code && <span className="block text-xs font-medium text-red-600">{errors.code}</span>}
                        </label>
                        <button
                            type="submit"
                            disabled={processing || data.code.length !== 6}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 text-sm font-bold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Mail className="size-4" />
                            Verify and continue
                            <ArrowRight className="size-4" />
                        </button>
                    </form>
                    <p className="text-xs leading-5 text-zinc-500">
                        The code expires in 10 minutes. Close this page if you did not request access.
                    </p>
                </section>
            </main>
        </MarketingLayout>
    );
}
