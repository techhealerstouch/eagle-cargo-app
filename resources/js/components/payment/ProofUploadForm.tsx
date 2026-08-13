import { useForm } from '@inertiajs/react';
import { Upload, RefreshCw, Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ProofUploadFormProps {
    bookingId: number;
    onSuccess?: () => void;
}

export function ProofUploadForm({ bookingId, onSuccess }: ProofUploadFormProps) {
    const [uploadPreview, setUploadPreview] = useState<string | null>(null);

    const { data, setData, post, processing } = useForm<{ proof_of_payment: File | null }>({
        proof_of_payment: null,
    });

    const handleUploadSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (processing) {
return;
}

        post(`/bookings/${bookingId}/upload-proof`, {
            onSuccess: () => {
                if (onSuccess) {
onSuccess();
}
            },
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setData('proof_of_payment', file);

        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = ev => setUploadPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        } else {
            setUploadPreview(null);
        }
    };

    return (
        <div className="mt-8 pt-8 border-t border-dashed border-zinc-200 space-y-6">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-bold text-zinc-900">Upload Proof of Payment</Label>
                <div className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center">
                    <Upload className="size-3 text-zinc-400" />
                </div>
            </div>
            <div className="border-2 border-dashed border-zinc-100 rounded-2xl p-8 text-center hover:bg-zinc-50/50 transition-all cursor-pointer relative group">
                <Upload className="size-8 text-zinc-200 mx-auto mb-4 group-hover:text-zinc-400 transition-colors" />
                <p className="text-xs text-zinc-500 mb-4">Screenshot, receipt, or PDF (max 5MB)</p>
                <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    title="Upload proof of payment"
                    aria-label="Upload proof of payment"
                />
                <Button variant="outline" className="h-10 px-6 rounded-xl border-zinc-200 text-xs font-bold pointer-events-none">
                    {data.proof_of_payment ? data.proof_of_payment.name : 'Choose File'}
                </Button>
                {uploadPreview && (
                    <div className="mt-4 relative group/preview">
                         <img src={uploadPreview} alt="Preview" className="max-h-40 rounded-xl mx-auto border shadow-sm" />
                         <button
                             type="button"
                             onClick={() => {
                                 setData('proof_of_payment', null);
                                 setUploadPreview(null);
                             }}
                             className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover/preview:opacity-100 transition-opacity"
                             aria-label="Remove preview"
                             title="Remove preview"
                         >
                             <RefreshCw className="size-3" />
                         </button>
                    </div>
                )}
            </div>
            <Button type="button" onClick={handleUploadSubmit} disabled={processing || !data.proof_of_payment}
                className="w-full h-12 rounded-xl font-bold text-sm bg-zinc-900 text-white shadow-lg shadow-zinc-200 hover:shadow-xl transition-all">
                {processing ? <Loader2 className="animate-spin size-4" /> : 'Submit Proof for Verification'}
            </Button>
        </div>
    );
}
