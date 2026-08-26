import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface InvoiceShowProps {
    invoice: {
        id: number;
        invoice_number: string;
        amount: number;
        surcharge_amount?: number | null;
        vat_amount?: number | null;
        vatable_revenue?: number | null;
        vat_exempt_revenue?: number | null;
        is_vat_inclusive?: boolean | null;
        status: string;
        created_at: string;
        sender_snapshot: any;
        booking_snapshot: any;
        line_items_snapshot: any[];
        admin_team_snapshot: any;
        picker?: {
            name: string;
        } | null;
        payments: {
            id: number;
            amount: number;
            paid_at: string;
            stripe_status?: string | null;
        }[];
        booking: {
            reference_number: string;
            destination: string;
            booking_type?: string;
            sender: {
                first_name: string;
                last_name: string;
                email?: string;
                phone?: string;
                address?: string;
            };
        };
    };
    invoiceSettings: {
        logo?: string | null;
        companyName: string;
        address: string;
        phone: string;
        abn: string;
        bankName: string;
        bankBsb: string;
        bankAccount: string;
        taxRate?: number;
        taxLabel?: string;
        terms: string;
        footer: string;
        currencySymbol?: string;
    };
}

export default function InvoiceShow({ invoice, invoiceSettings }: InvoiceShowProps) {
    const { auth } = usePage<any>().props;
    const userRole = auth.user?.role;
    const isPicker = userRole === 'picker';

    const breadcrumbs: BreadcrumbItem[] = isPicker ? [
        { title: 'Dashboard', href: '/picker/dashboard' },
        { title: 'Runsheets', href: '/picker/runsheets' },
        { title: invoice.invoice_number, href: `/admin/invoices/${invoice.id}` },
    ] : [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Invoices', href: '/admin/invoices' },
        { title: invoice.invoice_number, href: `/admin/invoices/${invoice.id}` },
    ];

    const sender = invoice.sender_snapshot || {};
    const booking = invoice.booking_snapshot || {};
    const rawLineItems = invoice.line_items_snapshot || [];
    const adminTeam = invoice.admin_team_snapshot || { name: 'Admin' };

    // Fallback: If empty box delivery was requested on booking but isn't explicitly in line_items_snapshot, append it
    const hasEmptyBoxInItems = rawLineItems.some((i: any) => i.is_add_on || i.item_type === 'empty_box');
    const emptyBoxCount = Number(booking.empty_box_count || 0);
    const emptyBoxFee = Number(booking.empty_box_fee || 10);
    const lineItems = [...rawLineItems];

    if (!hasEmptyBoxInItems && emptyBoxCount > 0) {
        lineItems.push({
            id: 'empty_box_fallback',
            is_add_on: true,
            item_type: 'empty_box',
            item_name: `Empty Box Delivery (${emptyBoxCount} @ ${invoiceSettings.currencySymbol || '$'}${emptyBoxFee.toFixed(2)})`,
            price_charged: emptyBoxCount * emptyBoxFee,
        });
    }

    const surchargeAmount = Number(invoice.surcharge_amount || 0);

    const formattedDate = new Date(invoice.created_at).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });

    const senderName = `${sender.first_name || ''} ${sender.last_name || ''}`.trim();

    const BOOKING_TYPE_LABELS: Record<string, string> = {
        drop_off: 'BOX DROP OFF',
        home_pickup: 'HOME PICK-UP',
        other: 'OTHER',
    };
    const rawBookingType = invoice.booking?.booking_type || booking.booking_type || 'drop_off';
    const normalizedType = String(rawBookingType).toLowerCase().replace(/[-_]/g, ' ').trim();
    let typeLabel = BOOKING_TYPE_LABELS[rawBookingType];
    if (!typeLabel) {
        if (normalizedType === 'drop off' || normalizedType === 'box drop off') {
            typeLabel = 'BOX DROP OFF';
        } else if (normalizedType === 'home pickup' || normalizedType === 'home pick up' || normalizedType === 'pickup') {
            typeLabel = 'HOME PICK-UP';
        } else {
            typeLabel = String(rawBookingType).replace(/_/g, ' ').toUpperCase();
        }
    }

    const batchNumbers = Array.from(new Set(lineItems.map(i => i.batch_number).filter(Boolean)));
    const subject = batchNumbers.length > 0
        ? `${typeLabel}: BATCH ${batchNumbers.join(', ')} SHIPMENT`
        : typeLabel;

    const totalAmount = Number(invoice.amount);
    const settledPayments = (invoice.payments || []).filter(p => p.paid_at !== null || p.stripe_status === 'succeeded');
    const paymentsMade = settledPayments.reduce((acc, p) => acc + Number(p.amount), 0);
    const balanceDue = invoice.status === 'paid' ? 0 : Math.max(0, totalAmount - paymentsMade);

    const currencySymbol = invoiceSettings.currencySymbol || '$';
    const taxRate = Number(invoiceSettings.taxRate || 0);
    const taxLabel = invoiceSettings.taxLabel || 'GST';
    let vatableRevenue = Number(invoice.vatable_revenue || 0);
    let vatAmount = Number(invoice.vat_amount || 0);
    let vatExemptRevenue = Number(invoice.vat_exempt_revenue || 0);

    if (vatableRevenue <= 0 && vatAmount <= 0 && vatExemptRevenue <= 0 && taxRate > 0 && totalAmount > 0) {
        vatableRevenue = Math.round((totalAmount / (1 + taxRate)) * 100) / 100;
        vatAmount = Math.round((totalAmount - vatableRevenue) * 100) / 100;
    }

    if (taxRate <= 0 && vatExemptRevenue <= 0 && totalAmount > 0) {
        vatExemptRevenue = totalAmount;
    }

    const effectiveVatRate = vatableRevenue > 0 ? vatAmount / vatableRevenue : 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`INVOICE | ${invoice.invoice_number}`} />

            <div className="mx-auto max-w-4xl p-4 lg:p-6 pb-20 print:p-0">
                {/* Print Controls */}
                <div className="mb-6 flex items-center justify-between print:hidden">
                    {isPicker ? (
                        <button
                            type="button"
                            onClick={() => window.history.back()}
                            className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-blue-600 transition-colors"
                        >
                            <ArrowLeft className="size-4" />
                            <span>Go Back</span>
                        </button>
                    ) : (
                        <Link
                            href="/admin/invoices"
                            className="flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-blue-600 transition-colors"
                        >
                            <ArrowLeft className="size-4" />
                            <span>Return to Invoices</span>
                        </Link>
                    )}
                    <div className="flex gap-3">
                        <a
                            href={`/admin/invoices/${invoice.id}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-600 shadow-sm transition-all hover:bg-zinc-50"
                        >
                            View PDF
                        </a>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700"
                        >
                            Print Invoice
                        </button>
                    </div>
                </div>

                {/* Professional Invoice Layout */}
                <div className="relative bg-white border border-zinc-200 shadow-xl overflow-hidden print:border-none print:shadow-none p-12 print:p-0 min-h-[1056px]">

                    {/* Header: Logo and Large Title */}
                    <div className="flex justify-between items-start mb-10">
                        <div className="w-1/2">
                            {invoiceSettings.logo ? (
                                <img
                                    src={invoiceSettings.logo}
                                    alt="Logo"
                                    className="h-20 w-auto object-contain"
                                />
                            ) : (
                                <div className="space-y-0.5">
                                    <div className="text-3xl font-black tracking-tighter text-[#1e3a8a]">
                                        love <span className="text-[#dc2626]">balikbayan</span>
                                    </div>
                                    <div className="text-[10px] font-bold tracking-[0.2em] text-zinc-400 uppercase">
                                        Door to Door Sea Cargo
                                    </div>
                                </div>
                            )}
                            <div className="mt-3">
                                <p className="text-sm font-bold text-zinc-900">{invoiceSettings.companyName}</p>
                                <p className="text-xs text-zinc-500 leading-relaxed max-w-xs">
                                    ABN {invoiceSettings.abn}<br />
                                    <span className="whitespace-pre-line">{invoiceSettings.address}</span>
                                </p>
                            </div>
                        </div>
                        <div className="w-1/2 text-right">
                            <h1 className="text-6xl font-extralight text-blue-600 leading-none">Invoice</h1>
                            <p className="mt-2 text-lg font-bold text-zinc-900 leading-none"># {invoice.invoice_number}</p>

                            <div className="mt-8 inline-block text-right">
                                <p className="text-sm font-bold text-zinc-500">Balance Due</p>
                                <p className="text-3xl font-black text-zinc-900 tracking-tight">{currencySymbol}{balanceDue.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Paid Stamp for Screen */}
                    {(invoice.status === 'paid' || balanceDue <= 0) && (
                        <div className="absolute top-48 right-12 pointer-events-none z-0">
                            <div className="border-[6px] border-emerald-500/20 rounded-2xl px-8 py-3 rotate-[-25deg]">
                                <span className="text-7xl font-black text-emerald-500/20 uppercase tracking-tighter">
                                    PAID
                                </span>
                            </div>
                        </div>
                    )}



                    {/* Billing and Details Grid */}
                    <div className="grid grid-cols-2 gap-12 mb-10 pb-10 border-b border-zinc-100">
                        <div>
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Bill To</h3>
                            <p className="text-sm font-bold text-zinc-900 leading-none mb-1">{senderName}</p>
                            <div className="text-xs text-zinc-500 leading-relaxed">
                                <p>{sender.address}</p>
                                <p>{sender.suburb} {sender.state} {sender.postcode}</p>
                                <p>Australia</p>
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <table className="w-64 text-xs">
                                <tbody className="divide-y divide-zinc-50">
                                    <tr className="border-none">
                                        <td className="py-1 text-right text-zinc-400 font-medium pr-4">Invoice Date :</td>
                                        <td className="py-1 text-right text-zinc-900 font-bold">{formattedDate}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-1 text-right text-zinc-400 font-medium pr-4">Terms :</td>
                                        <td className="py-1 text-right text-zinc-900">Due on Receipt</td>
                                    </tr>
                                    <tr>
                                        <td className="py-1 text-right text-zinc-400 font-medium pr-4">Due Date :</td>
                                        <td className="py-1 text-right text-zinc-900">{formattedDate}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-1 text-right text-zinc-400 font-medium pr-4">Admin Team :</td>
                                        <td className="py-1 text-right text-zinc-900 font-bold">{adminTeam.name}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-1 text-right text-zinc-400 font-medium pr-4">Picker :</td>
                                        <td className="py-1 text-right text-zinc-900 font-bold">{invoice.picker?.name || 'PW Drop-off'}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-1 text-right text-zinc-400 font-medium pr-4">PAYEE :</td>
                                        <td className="py-1 text-right text-zinc-900 font-bold">{senderName}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Subject Line */}
                    <div className="mb-8">
                        <p className="text-xs font-bold text-zinc-400 mb-1">Subject :</p>
                        <p className="text-sm font-black text-[#1e3a8a] uppercase tracking-tight">{subject}</p>
                    </div>

                    {/* Items Table */}
                    <div className="mb-10">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-[#1e40af]">
                                    <th className="py-2 px-4 text-xs font-bold text-white text-left first:rounded-tl">#</th>
                                    <th className="py-2 px-4 text-xs font-bold text-white text-left">Item & Description</th>
                                    <th className="py-2 px-4 text-xs font-bold text-white text-right">Qty</th>
                                    <th className="py-2 px-4 text-xs font-bold text-white text-right">Rate</th>
                                    <th className="py-2 px-4 text-xs font-bold text-white text-right last:rounded-tr">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {lineItems.map((item, index) => {
                                    const isAddOn = item.is_add_on || item.item_type === 'empty_box';
                                    return (
                                        <tr key={index}>
                                            <td className="py-4 px-4 text-xs text-zinc-500">{index + 1}</td>
                                            <td className="py-4 px-4">
                                                <p className="text-xs font-black text-zinc-900 uppercase mb-0.5">
                                                    {isAddOn ? (item.item_name || 'Empty Box Delivery') : (item.destination || 'METRO MANILA')}
                                                </p>
                                                {!isAddOn ? (
                                                    <p className="text-[10px] text-zinc-400 leading-tight">
                                                        Sea Freight Coverage Areas:<br />
                                                        {booking.destination || 'NCR'}
                                                        {item.is_door_to_door && (
                                                            <span className="block text-emerald-600 font-bold mt-0.5">
                                                                + Door-to-Door Delivery Add-On{Number(item.door_to_door_fee || 0) > 0 ? ` (+${currencySymbol}${Number(item.door_to_door_fee).toFixed(2)})` : ''}
                                                            </span>
                                                        )}
                                                    </p>
                                                ) : (
                                                    <p className="text-[10px] text-amber-600 font-semibold leading-tight">
                                                        Empty Box Delivery Service
                                                    </p>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <p className="text-xs font-bold text-zinc-900">1.00</p>
                                                <p className="text-[10px] text-zinc-400">{isAddOn ? 'Service' : 'Box'}</p>
                                            </td>
                                            <td className="py-4 px-4 text-right text-xs text-zinc-900">
                                                {Number(item.price_charged || 0).toFixed(2)}
                                            </td>
                                            <td className="py-4 px-4 text-right text-xs font-bold text-zinc-900">
                                                {Number(item.price_charged || 0).toFixed(2)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Totals Section */}
                    <div className="flex justify-end mb-16">
                        <table className="w-72 text-sm">
                            <tbody className="divide-y divide-zinc-50">
                                <tr>
                                    <td className="py-2 text-right text-zinc-500 font-medium pr-4">{taxLabel}able Revenue</td>
                                    <td className="py-2 text-right text-zinc-900 pr-1">{currencySymbol}{vatableRevenue.toFixed(2)}</td>
                                </tr>
                                {vatExemptRevenue > 0 && (
                                    <tr>
                                        <td className="py-2 text-right text-zinc-500 font-medium pr-4">{taxLabel} Exempt</td>
                                        <td className="py-2 text-right text-zinc-900 pr-1">{currencySymbol}{vatExemptRevenue.toFixed(2)}</td>
                                    </tr>
                                )}
                                <tr>
                                    <td className="py-2 text-right text-zinc-500 font-medium pr-4">{taxLabel} ({(effectiveVatRate * 100).toFixed(2)}%)</td>
                                    <td className="py-2 text-right text-zinc-900 pr-1">{currencySymbol}{vatAmount.toFixed(2)}</td>
                                </tr>
                                {surchargeAmount > 0 && (
                                    <tr className="bg-purple-50/50">
                                        <td className="py-2 text-right text-purple-700 font-bold pr-4">Afterpay Surcharge (6.3%)</td>
                                        <td className="py-2 text-right text-purple-700 font-bold pr-1">{currencySymbol}{surchargeAmount.toFixed(2)}</td>
                                    </tr>
                                )}
                                <tr className="border-t border-zinc-200">
                                    <td className="py-3 text-right text-zinc-900 font-black pr-4">Total</td>
                                    <td className="py-3 text-right text-zinc-900 font-black pr-1">{currencySymbol}{totalAmount.toFixed(2)}</td>
                                </tr>
                                {settledPayments.map((payment) => (
                                     <tr key={payment.id} className="text-red-600 font-medium">
                                         <td className="py-2 text-right pr-4 text-xs">
                                             Payment Made ({payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' }) : ''})
                                         </td>
                                         <td className="py-2 text-right pr-1 text-xs">
                                             (-) {currencySymbol}{Number(payment.amount).toFixed(2)}
                                         </td>
                                     </tr>
                                 ))}
                                <tr className="bg-zinc-50 border-t-2 border-zinc-200">
                                    <td className="py-3 text-right text-zinc-900 font-black pr-4">Balance Due</td>
                                    <td className="py-3 text-right text-zinc-900 font-black pr-1">{currencySymbol}{balanceDue.toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Notes & Terms */}
                    <div className="space-y-8">
                        <div>
                            <h4 className="text-xs font-bold text-zinc-900 mb-2 uppercase tracking-tight">Notes</h4>
                            <p className="text-[11px] text-zinc-600 leading-relaxed uppercase">
                                E-DECLARATION FORM IS MANDATORY AND AVAILABLE AT:<br />
                                <a href=" https://love.balikbayan.box.cargo/declaration-page/" className="text-blue-600 hover:underline">
                                    https://love.balikbayan.box.cargo/declaration-page/
                                </a>
                            </p>
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-zinc-900 mb-2 uppercase tracking-tight">Terms & Conditions</h4>
                            <p className="text-[11px] text-zinc-500 leading-relaxed">
                                {invoiceSettings.terms}
                            </p>
                        </div>
                    </div>

                    {/* Footer / Page Number */}
                    <div className="mt-20 flex justify-end">
                        <span className="text-[10px] font-bold text-zinc-300">1</span>
                    </div>
                </div>

                <style dangerouslySetInnerHTML={{__html: `
                    @media print {
                        body { background: white !important; padding: 0 !important; }
                        nav, header, footer, .print\\:hidden { display: none !important; }
                        .mx-auto { max-width: none !important; margin: 0 !important; padding: 0 !important; }
                        .shadow-xl { box-shadow: none !important; border: none !important; }
                        @page { margin: 1.5cm; }
                    }
                `}} />
            </div>
        </AppLayout>
    );
}

