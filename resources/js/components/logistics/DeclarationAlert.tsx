import { Link } from '@inertiajs/react';
import { ArrowRight, Clock, FileText, HelpCircle, Loader2, Lock, Mail, RotateCw, Send, ShieldAlert } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

interface DeclarationAlertProps {
    bookingId: number;
    canEdit?: boolean;
    trackingNumber?: string;
    senderEmailMasked?: string | null;
    resendsRemaining?: number;
}

export const DeclarationAlert: React.FC<DeclarationAlertProps> = ({
    bookingId,
    canEdit = false,
    trackingNumber,
    senderEmailMasked,
    resendsRemaining = 3,
}) => {
    const [helpOpen, setHelpOpen] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const [remainingAttempts, setRemainingAttempts] = useState<number>(resendsRemaining);

    useEffect(() => {
        if (resendsRemaining !== undefined) {
            setRemainingAttempts(resendsRemaining);
        }
    }, [resendsRemaining]);

    useEffect(() => {
        if (cooldown <= 0) return;
        const timer = setInterval(() => {
            setCooldown((prev) => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldown]);

    const handleResendEmail = async () => {
        if (isResending || cooldown > 0) return;

        if (remainingAttempts <= 0) {
            toast.error('You have reached the maximum of 3 email resends allowed per day. Please check your spam folder or contact support.');
            return;
        }

        setIsResending(true);
        try {
            const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
            const match = document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'));
            const xsrfToken = match ? decodeURIComponent(match[3]) : '';

            const response = await fetch('/track/declaration/resend-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-XSRF-TOKEN': xsrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    booking_id: bookingId,
                    tracking_number: trackingNumber,
                }),
            });

            const data = await response.json();

            if (data.resends_remaining !== undefined) {
                setRemainingAttempts(data.resends_remaining);
            }

            if (response.ok) {
                toast.success(
                    data.message ||
                        `Customs declaration link sent to ${senderEmailMasked || "the sender's email"}!`
                );
                setCooldown(60);
            } else if (response.status === 429) {
                const retryAfter = data.retry_after || 60;
                setCooldown(retryAfter);
                toast.error(data.message || `Please wait ${retryAfter}s before requesting another email.`);
            } else {
                toast.error(data.message || 'Unable to resend email. Please try again or contact customer support.');
            }
        } catch {
            toast.error('Network error while requesting email resend. Please try again.');
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-gradient-to-r from-amber-50/90 via-amber-50/50 to-orange-50/30 dark:from-amber-950/30 dark:via-zinc-900/40 dark:to-zinc-900/40 p-5 md:p-6 shadow-xs transition-all">
            {/* Subtle decorative accent rail */}
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500 rounded-l-2xl" />

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pl-1.5">
                {/* Left Side: Icon & Details */}
                <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
                        {canEdit ? <FileText className="size-5" /> : <ShieldAlert className="size-5" />}
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
                                Customs Declaration Required
                            </h3>
                            {!canEdit ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-500/25">
                                    <Lock className="size-2.5" /> Sender Protected
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 border border-amber-500/25">
                                    Action Required
                                </span>
                            )}
                        </div>

                        <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
                            {canEdit
                                ? 'Please submit your itemized packing list on or before pickup to ensure smooth customs clearance and avoid transit delays.'
                                : 'Philippine customs requires an itemized declaration before pickup. For cargo security, only the verified sender can submit this form.'}
                        </p>

                        {!canEdit && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5 text-[11px] text-amber-900/90 dark:text-amber-300/90 font-medium">
                                <span className="inline-flex items-center gap-1.5">
                                    <Mail className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <span>
                                        <strong>No account needed</strong> — a secure 1-click link was sent to{' '}
                                        {senderEmailMasked ? (
                                            <strong className="underline decoration-amber-400/50 underline-offset-2">
                                                {senderEmailMasked}
                                            </strong>
                                        ) : (
                                            "the sender's email"
                                        )}
                                        .
                                    </span>
                                </span>

                                <span className="text-amber-300 dark:text-amber-700 hidden sm:inline">•</span>

                                <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
                                    <DialogTrigger asChild>
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-1 underline underline-offset-2 decoration-amber-400/60 hover:text-amber-700 dark:hover:text-amber-200 cursor-pointer font-bold transition-colors"
                                        >
                                            <HelpCircle className="size-3" /> No account? See how
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2 text-base font-bold">
                                                <Mail className="size-5 text-amber-500" /> Submitting Without an Account
                                            </DialogTitle>
                                            <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
                                                You do not need to register or create an account to complete your customs declaration.
                                            </DialogDescription>
                                        </DialogHeader>

                                        <div className="space-y-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
                                            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white font-bold text-[11px]">1</div>
                                                <div className="space-y-1">
                                                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">Check the sender's email inbox</p>
                                                    <p className="text-zinc-500 dark:text-zinc-400">
                                                        Search for <strong>"Eagle Express Cargo"</strong> or <strong>"Booking Confirmation"</strong>. Check the spam or junk folder if you can't find it.
                                                    </p>
                                                    {senderEmailMasked && (
                                                        <div className="inline-flex items-center gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 font-medium">
                                                            <Mail className="size-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                                            <span>Sent to: <strong>{senderEmailMasked}</strong></span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
                                                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 dark:bg-zinc-600 text-white font-bold text-[11px]">2</div>
                                                <div>
                                                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">Click the declaration button in the email</p>
                                                    <p className="text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                        Click <strong>"Fill Out Customs Declaration"</strong> in that email to open the form directly — no login or registration required.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Lost or Missing Email Callout */}
                                            <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/25 space-y-2.5">
                                                <div className="flex items-center gap-2">
                                                    {remainingAttempts > 0 ? (
                                                        <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white font-bold text-[10px]">!</div>
                                                    ) : (
                                                        <Lock className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                                    )}
                                                    <p className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                                                        {remainingAttempts > 0
                                                            ? "Lost, deleted, or didn't receive the email?"
                                                            : "Daily Resend Limit Reached (3 of 3 used)"}
                                                    </p>
                                                </div>

                                                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                                    {remainingAttempts > 0 ? (
                                                        <>
                                                            We can resend the confirmation email with your direct 1-click declaration link to{' '}
                                                            <strong>{senderEmailMasked || "the sender's email address on file"}</strong>.
                                                            You have <span className="font-bold text-amber-700 dark:text-amber-300">{remainingAttempts} of 3</span> chances remaining today.
                                                        </>
                                                    ) : (
                                                        <>
                                                            You have reached the maximum of 3 email resends allowed per day. Please check your spam or junk folder for previous emails, or contact support if you need help.
                                                        </>
                                                    )}
                                                </p>

                                                {remainingAttempts > 0 ? (
                                                    <button
                                                        type="button"
                                                        onClick={handleResendEmail}
                                                        disabled={isResending || cooldown > 0}
                                                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400/70 text-white px-4 h-9 text-xs font-bold transition-all active:scale-[0.98] shadow-xs cursor-pointer disabled:cursor-not-allowed"
                                                    >
                                                        {isResending ? (
                                                            <>
                                                                <Loader2 className="size-3.5 animate-spin" />
                                                                <span>Sending Email Link...</span>
                                                            </>
                                                        ) : cooldown > 0 ? (
                                                            <>
                                                                <Clock className="size-3.5" />
                                                                <span>Resend Available in {cooldown}s</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Send className="size-3.5" />
                                                                <span>Resend Declaration Link ({remainingAttempts} of 3 left)</span>
                                                            </>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled
                                                        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-4 h-9 text-xs font-bold cursor-not-allowed border border-zinc-300/40 dark:border-zinc-700/40"
                                                    >
                                                        <Lock className="size-3.5" />
                                                        <span>Daily Limit Reached (0 of 3 left)</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>

                                <span className="text-amber-300 dark:text-amber-700 hidden sm:inline">•</span>

                                {remainingAttempts > 0 ? (
                                    <button
                                        type="button"
                                        onClick={handleResendEmail}
                                        disabled={isResending || cooldown > 0}
                                        className="inline-flex items-center gap-1 underline underline-offset-2 decoration-amber-400/60 hover:text-amber-700 dark:hover:text-amber-200 cursor-pointer font-bold transition-colors disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
                                    >
                                        {isResending ? (
                                            <>
                                                <Loader2 className="size-3 animate-spin" /> Resending...
                                            </>
                                        ) : cooldown > 0 ? (
                                            <>
                                                <Clock className="size-3" /> Resend in {cooldown}s
                                            </>
                                        ) : (
                                            <>
                                                <RotateCw className="size-3" /> Didn't receive email? Resend ({remainingAttempts} left today)
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <span className="text-zinc-500 dark:text-zinc-400 font-normal">
                                        Daily resend limit reached (0/3 left)
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side: Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-amber-200/50 dark:border-amber-900/30">
                    {canEdit ? (
                        <Link
                            href={`/track/declaration/${bookingId}`}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-6 h-11 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm group w-full sm:w-auto"
                        >
                            <span>Submit Declaration</span>
                            <ArrowRight className="size-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    ) : (
                        <>
                            {remainingAttempts > 0 ? (
                                <button
                                    type="button"
                                    onClick={handleResendEmail}
                                    disabled={isResending || cooldown > 0}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400/70 text-white px-5 h-11 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:transform-none w-full sm:w-auto"
                                >
                                    {isResending ? (
                                        <>
                                            <Loader2 className="size-3.5 animate-spin" />
                                            <span>Sending...</span>
                                        </>
                                    ) : cooldown > 0 ? (
                                        <>
                                            <Clock className="size-3.5" />
                                            <span>Resend ({cooldown}s)</span>
                                        </>
                                    ) : (
                                        <>
                                            <RotateCw className="size-3.5" />
                                            <span>Resend Email Link ({remainingAttempts}/3)</span>
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-200/80 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 px-4 h-11 text-xs font-bold uppercase tracking-wider cursor-not-allowed shadow-none border border-zinc-300/40 dark:border-zinc-700/40 w-full sm:w-auto"
                                    title="You have reached the maximum of 3 email resends for today."
                                >
                                    <Lock className="size-3.5" />
                                    <span>Daily Limit Reached (0/3)</span>
                                </button>
                            )}

                            <Link
                                href="/login"
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/80 hover:bg-zinc-100 text-zinc-800 dark:bg-zinc-900/80 dark:hover:bg-zinc-800 dark:text-zinc-200 px-4 h-11 text-xs font-bold uppercase tracking-wider transition-all active:scale-95 shadow-xs group w-full sm:w-auto"
                            >
                                <span>Have Account? Log In</span>
                                <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

