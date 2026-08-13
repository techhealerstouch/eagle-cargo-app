import { Link } from '@inertiajs/react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import React from 'react';

interface DeclarationAlertProps {
    bookingId: number;
}

export const DeclarationAlert: React.FC<DeclarationAlertProps> = ({ bookingId }) => {
    return (
        <div className="card overflow-hidden bg-zinc-900 border-zinc-800">
            <div className="px-5 py-6 md:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-zinc-800 text-amber-400 border border-zinc-700">
                        <AlertCircle className="size-6" />
                    </div>
                    <div>
                        <h3 className="text-base font-serif font-black text-white uppercase tracking-tight">Declaration Required</h3>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Please submit your customs declaration <strong>on or before pickup</strong> to avoid delays.</p>
                    </div>
                </div>
                <Link
                    href={`/track/declaration/${bookingId}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white text-zinc-900 px-8 h-12 text-[11px] font-bold uppercase tracking-widest hover:bg-zinc-100 transition-all active:scale-95 shadow-md group"
                >
                    Submit Declaration <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
            </div>
        </div>
    );
};
