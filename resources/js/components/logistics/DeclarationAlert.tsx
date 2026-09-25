import { Link } from '@inertiajs/react';
import { AlertCircle, ArrowRight, Lock, Mail } from 'lucide-react';
import React from 'react';

interface DeclarationAlertProps {
    bookingId: number;
    canEdit?: boolean;
}

export const DeclarationAlert: React.FC<DeclarationAlertProps> = ({ bookingId, canEdit = false }) => {
    return (
        <div className="card overflow-hidden bg-zinc-900 border-zinc-800">
            <div className="px-5 py-6 md:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-zinc-800 text-amber-400 border border-zinc-700">
                        <AlertCircle className="size-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-serif font-black text-white uppercase tracking-tight">Declaration Required</h3>
                            {!canEdit && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-300 border border-amber-400/20">
                                    <Lock className="size-2.5" /> Protected
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] font-medium text-zinc-400 mt-1 max-w-xl leading-relaxed">
                            {canEdit
                                ? 'Please submit your customs declaration (itemized packing list) on or before pickup to avoid transit delays.'
                                : 'For cargo security, the customs declaration must be completed via the secure link sent to the sender\'s email address or by logging into your account.'}
                        </p>
                    </div>
                </div>
                {canEdit ? (
                    <Link
                        href={`/track/declaration/${bookingId}`}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-zinc-900 px-8 h-12 text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-100 transition-all active:scale-95 shadow-md group shrink-0"
                    >
                        Submit Declaration <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                ) : (
                    <div className="flex items-center gap-3 shrink-0">
                        <Link
                            href="/login"
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-white px-5 h-11 text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 border border-zinc-700"
                        >
                            Log In to Submit
                        </Link>
                        <div className="hidden sm:inline-flex items-center gap-1.5 text-zinc-400 text-[10px] font-bold uppercase tracking-wider px-3 py-2 rounded-xl bg-zinc-950/60 border border-zinc-800">
                            <Mail className="size-3.5 text-amber-400" />
                            <span>Link in sender email</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
