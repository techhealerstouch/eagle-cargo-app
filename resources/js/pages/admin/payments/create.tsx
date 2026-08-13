import { Head, router } from '@inertiajs/react';
import Heading from '@/components/common/heading';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import PaymentConsole from '@/pages/payment/PaymentConsole';
import type { Invoice } from '@/pages/payment/PaymentConsole';
import type { BreadcrumbItem } from '@/types';


export default function PaymentsCreate({
    invoices,
    selectedInvoiceId,
}: {
    invoices: Invoice[];
    selectedInvoiceId?: string | number;
}) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Payments', href: '/admin/payments' },
        { title: 'Record Payment', href: '#' },
    ];

    const initialInvoice = invoices.find((inv) => inv.id === Number(selectedInvoiceId));

    if (initialInvoice) {
        return (
            <PaymentConsole
                invoice={initialInvoice}
                role="admin"
                endpoint="/admin/payments"
                backUrl="/admin/payments"
            />
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Record Payment | Admin" />

            <div className="flex h-full flex-1 flex-col items-center justify-center p-8 bg-zinc-50/50">
                <div className="w-full max-w-md bg-white p-8 rounded-[40px] shadow-xl border border-zinc-100 space-y-6">
                    <Heading
                        title="Manual Payment Entry"
                        description="Select an unpaid invoice to record a manual payment against."
                    />

                    <div className="space-y-4">
                        <Label>Select Invoice</Label>
                        <select
                            id="invoice-select"
                            aria-label="Select Invoice"
                            className="w-full h-12 rounded-xl border-zinc-200"
                            onChange={(e) => {
                                if (e.target.value) {
                                    router.get('/admin/payments/create', { invoice_id: e.target.value });
                                }
                            }}
                            defaultValue=""
                        >
                            <option value="" disabled>Select an invoice...</option>
                            {invoices.map(inv => (
                                <option key={inv.id} value={inv.id}>
                                    {inv.invoice_number} - {inv.booking?.reference_number} ({inv.booking?.sender?.first_name} {inv.booking?.sender?.last_name})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
