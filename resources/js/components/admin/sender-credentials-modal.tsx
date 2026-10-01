import * as React from 'react';
import { useState } from 'react';
import { router } from '@inertiajs/react';
import { KeyRound, Mail, Send, ShieldCheck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface SenderCredentialsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sender: {
        id: number;
        first_name: string;
        last_name: string;
        email?: string | null;
    } | null;
}

export default function SenderCredentialsModal({
    isOpen,
    onClose,
    sender,
}: SenderCredentialsModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!sender) return null;

    const fullName = `${sender.first_name} ${sender.last_name}`.trim();

    const handleSendCredentials = () => {
        if (!sender.email) {
            toast.error('This sender does not have an email address.');
            return;
        }

        setIsSubmitting(true);
        router.post(
            `/admin/senders/${sender.id}/send-credentials`,
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success(`Credentials generated and emailed to ${sender.email}!`);
                    onClose();
                },
                onError: () => {
                    toast.error('Failed to send credentials.');
                },
                onFinish: () => {
                    setIsSubmitting(false);
                },
            }
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
            <DialogContent className="max-w-md p-6 rounded-2xl border border-border bg-card text-brand-text shadow-2xl gap-5">
                <DialogHeader className="gap-1.5">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-2xs">
                            <KeyRound className="size-5" />
                        </div>
                        <div>
                            <DialogTitle className="font-sans text-base font-bold text-brand-text">
                                Send Account Credentials
                            </DialogTitle>
                            <DialogDescription className="text-xs text-brand-text-mid font-normal">
                                Dispatch secure portal login access to registered sender
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Recipient Details Card */}
                    <div className="p-4 rounded-xl bg-brand-warm/15 border border-border space-y-3 text-xs">
                        <div className="flex items-center gap-2 text-brand-text">
                            <User className="size-3.5 text-brand-text-mid" />
                            <span className="font-semibold text-sm">{fullName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-brand-text-mid font-mono text-xs">
                            <Mail className="size-3.5 text-brand-text-light" />
                            {sender.email ? (
                                <span className="font-semibold text-brand-text">{sender.email}</span>
                            ) : (
                                <span className="italic text-rose-500 font-sans">No email address on file</span>
                            )}
                        </div>
                    </div>

                    {/* Security & Auto-Generation Information */}
                    <div className="p-3.5 rounded-xl bg-sky-500/5 dark:bg-sky-950/30 border border-sky-500/20 flex items-start gap-3">
                        <ShieldCheck className="size-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="text-xs font-semibold text-sky-900 dark:text-sky-200">
                                Auto-Generated & Confidential
                            </h4>
                            <p className="text-[11px] text-sky-800/80 dark:text-sky-300/80 leading-relaxed font-normal">
                                A secure temporary password and account setup link will be automatically generated upon dispatch and sent directly to the sender’s registered email address. Passwords are never exposed in the administration console.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2 border-t border-border mt-1">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="h-9 px-4 text-xs font-semibold border-border"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSendCredentials}
                        disabled={isSubmitting || !sender.email}
                        className="h-9 px-4 text-xs font-bold bg-brand-rust text-white hover:bg-brand-rust/90 shadow-2xs gap-1.5 disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            'Sending...'
                        ) : (
                            <>
                                <Send className="size-3.5" />
                                Send Credentials Email
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
