import { Wallet } from 'lucide-react';
import React from 'react';

export type PaymentMethodId = 'stripe' | 'bank_transfer' | 'pay_id' | 'cash_on_pickup' | 'cash' | 'card';

export interface PaymentMethodDefinition {
    id: PaymentMethodId;
    label: string;
    icon: React.ElementType;
    color: string;
}

interface PaymentMethodSelectorProps {
    methods: PaymentMethodDefinition[];
    activeMethod: PaymentMethodId;
    onSelect: (methodId: PaymentMethodId) => void;
    role?: 'sender' | 'picker' | 'admin';
}

export function PaymentMethodSelector({ methods, activeMethod, onSelect, role }: PaymentMethodSelectorProps) {
    return (
        <div className="space-y-4 mb-8 animate-in slide-in-from-top duration-300">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-zinc-900">Choose your method below</h4>
                <div className="h-8 w-8 rounded-lg bg-zinc-50 flex items-center justify-center border border-zinc-100">
                   <Wallet className="size-4 text-zinc-400" />
                </div>
            </div>
            <div className={`grid gap-2 ${role === 'sender' ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-3'}`}>
                {methods.map(m => {
                    const Icon = m.icon;
                    const isActive = activeMethod === m.id;

                    return (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => onSelect(m.id)}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${isActive ? 'border-zinc-900 bg-zinc-50 shadow-sm' : 'border-zinc-100 hover:border-zinc-300 hover:bg-white'}`}>
                            <Icon className={`size-5 mb-1.5 ${isActive ? 'text-zinc-900' : 'text-zinc-400'}`} />
                            <span className={`text-[9px] font-bold uppercase tracking-wider text-center ${isActive ? 'text-zinc-900' : 'text-zinc-500'}`}>{m.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
