import { Link } from '@inertiajs/react';
import { Download, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Booking } from './types';

interface SuccessStateProps {
    booking: Booking;
    backUrl?: string;
    backLabel?: string;
}

export function SuccessState({ booking, backUrl = '/dashboard', backLabel = 'Go to Dashboard' }: SuccessStateProps) {
    const totalAmount = booking.boxes.reduce((acc, b) => acc + parseFloat(b.price_charged || '0'), 0);

    return (
        <div className="p-8 text-center space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 bg-emerald-100 rounded-full animate-ping opacity-25" />
                <div className="relative h-24 w-24 rounded-full bg-emerald-100 flex items-center justify-center border-4 border-white shadow-sm">
                    <Check className="size-12 text-emerald-600 stroke-[3px]" />
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-3xl font-bold text-zinc-900 tracking-tight">Payment confirmed!</h3>
                <p className="text-zinc-500 max-w-sm mx-auto text-sm leading-relaxed">
                    Your box is booked. {booking.boxes[0]?.recipient.first_name || 'Your recipient'} will receive it in 4-6 weeks.
                </p>
            </div>

            <div className="inline-flex items-center gap-4 px-6 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm font-mono font-medium text-zinc-600">
                <span>{booking.reference_number}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
                <span className="text-zinc-900">${totalAmount.toFixed(2)}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-200" />
                <span className="text-emerald-600 font-bold uppercase tracking-wider text-[10px]">Paid</span>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <a href={`/bookings/${booking.id}/invoice-pdf`} target="_blank" className="flex-1">
                    <Button className="w-full h-12 rounded-xl border-2 border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 transition-all font-bold flex items-center justify-center gap-2">
                        <Download className="size-4" /> Download receipt
                    </Button>
                </a>
                <Link href={backUrl} className="flex-1">
                    <Button className="w-full h-12 rounded-xl bg-zinc-900 text-white font-bold hover:bg-black transition-all">
                        {backLabel}
                    </Button>
                </Link>
            </div>
        </div>
    );
}
