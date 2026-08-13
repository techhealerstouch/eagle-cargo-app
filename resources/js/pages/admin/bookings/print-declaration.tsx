import { Head } from '@inertiajs/react';
import QRCode from 'qrcode';
import React, { useEffect, useState } from 'react';

import DeclarationTerms from '@/components/common/declaration-terms';

interface Props {
    booking: any;
    declarationSettings: {
        logo?: string | null;
        appName: string;
        appSubtitle: string;
        headerText: string;
        subtitle: string;
        badge1: string;
        badge2: string;
        formInfo: string;
        prohibitedTitle: string;
        prohibitedNotice: string;
        brandName: string;
        originLocation: string;
        instructions: string;
        footerText: string;
        requireSignature: boolean;
    };
}

/**
 * Single Declaration Document component to ensure consistency between
 * individual box print and "print all" views.
 */
function DeclarationDocument({ booking, box, boxIndex, sender, cert, declarationSettings }: any) {
    const recipient = box.recipient;
    const totalBoxes = booking.boxes?.length || 1;
    const firstPageRows = 18;
    const continuationRows = 30;

    const recipientName = (r: any) => {
        if (r.name) {
return r.name;
}

        return `${r.first_name || ''} ${r.last_name || ''}`.trim() || '';
    };

    const formatDate = (date: any) => {
        if (!date) {
return '';
}

        try {
            return new Date(date).toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });
        } catch {
 return String(date); 
}
    };

    const getMonthBatch = () => {
        if (box.batch?.batch_number) {
return box.batch.batch_number;
}

        if (box.batch_number) {
return box.batch_number;
}

        if (booking.preferred_date) {
            return new Date(booking.preferred_date)
                .toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
                .toUpperCase();
        }

        return '';
    };

    const batchInfo = getMonthBatch();
    const itemsList = box.items || [];
    const trackingNumber = box.tracking_number || '';
    const boxTypeName = box.box_type || '';

    const senderName = `${sender.first_name || ''} ${sender.last_name || ''}`.trim();
    const senderAddressLine1 = sender.address || '';
    const senderAddressLine2 = [sender.suburb, sender.state, sender.postcode].filter(Boolean).join(', ');
    const senderPhone = sender.mobile || '';
    const senderEmail = sender.email || '';

    const recipientDisplayName = recipientName(recipient);
    const recipientAddressLine1 = recipient.address || '';
    const recipientAddressLine2 = [
        recipient.city,
        recipient.province || recipient.state,
        recipient.province ? 'Philippines' : (recipient.country || ''),
        recipient.zip_code || recipient.postcode || '',
    ].filter(Boolean).join(', ');
    const recipientPhone = recipient.phone_number || recipient.mobile || '';
    const recipientEmail = recipient.email || '';

    const printedName = cert.signed_by || senderName;
    const dateSigned = cert.date_signed || cert.date || cert.signed_at || null;

    /* ─── Shared Masthead ─── */
    const Masthead = ({ title, subtitle, pageInfo }: { title: string; subtitle: string; pageInfo: React.ReactNode }) => (
        <table className="w-full border-collapse border-b-[3px] border-zinc-900 mb-[10px]" style={{ tableLayout: 'fixed' }}>
            <tbody>
                <tr>
                    <td className="w-[23%] align-top p-0 border-0">
                        {declarationSettings.logo ? (
                            <table className="w-full border-collapse" style={{ tableLayout: 'auto' }}>
                                <tbody><tr>
                                    <td className="w-[62px] pr-2 border-0 p-0 align-middle">
                                        <img src={declarationSettings.logo} className="h-[58px] w-auto" alt="" />
                                    </td>
                                    <td className="border-0 p-0 align-middle">
                                        <div className="text-[9px] font-black uppercase leading-[1.15] tracking-normal text-zinc-900">
                                            {declarationSettings.appName}
                                        </div>
                                        <div className="mt-[3px] text-[7px] font-extrabold tracking-[0.12em] uppercase text-zinc-400">
                                            {declarationSettings.appSubtitle}
                                        </div>
                                    </td>
                                </tr></tbody>
                            </table>
                        ) : (
                            <>
                                <div className="text-[20px] font-black leading-none">
                                    <span className="text-[#1e3a8a]">love </span>
                                    <span className="text-[#dc2626]">balikbayan</span>
                                </div>
                                <div className="mt-[3px] text-[7px] font-extrabold tracking-[0.12em] uppercase text-zinc-400">
                                    {declarationSettings.appSubtitle}
                                </div>
                            </>
                        )}
                    </td>
                    <td className="w-[54%] align-top p-0 border-0 text-center">
                        <h1 className="m-0 text-[20px] font-black uppercase tracking-normal leading-[1.05] text-zinc-900">
                            {title}
                        </h1>
                        <p className="mt-1 text-[8px] font-extrabold tracking-[0.12em] uppercase text-zinc-500">
                            {subtitle}
                        </p>
                    </td>
                    <td className="w-[23%] align-top p-0 border-0 text-right text-[7.5px] font-extrabold tracking-[0.08em] leading-[1.45] uppercase text-zinc-500">
                        {pageInfo}
                    </td>
                </tr>
            </tbody>
        </table>
    );

    /* ─── Shared Footer ─── */
    const Footer = ({ left, right }: { left: React.ReactNode; right: React.ReactNode }) => (
        <div className="border-t border-zinc-300 mt-2 pt-[5px] text-[7px] font-extrabold tracking-[0.05em] uppercase text-zinc-400">
            <div className="flex justify-between">
                <span>{left}</span>
                <span>{right}</span>
            </div>
        </div>
    );

    return (
        <>
            {/* ═══════════════ PAGE 1 — PACKING LIST ═══════════════ */}
            <div className="declaration-page max-w-[21cm] mx-auto bg-white shadow-2xl print:shadow-none mb-12 print:mb-0 p-[0.75cm_0.9cm] text-[9px] leading-[1.25] text-zinc-900 font-sans">
                <Masthead
                    title={declarationSettings.headerText || "Shipper's Export Declaration"}
                    subtitle={declarationSettings.subtitle || "Shipper's Packing List - Balikbayan Box"}
                    pageInfo={<>{declarationSettings.formInfo || 'Form 291-B Revised 2026'}<br />Page 1 of 3<br />Box {boxIndex + 1} of {totalBoxes}</>}
                />

                {/* Shipment Metadata */}
                <div className="border-[1.5px] border-zinc-900 mb-[10px]">
                    <div className="bg-zinc-900 text-white text-[8px] font-black tracking-[0.1em] px-[6px] py-1 uppercase">
                        Shipment Metadata
                    </div>
                    <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                        <tbody>
                            <tr>
                                <td className="w-1/3 border-r border-b border-zinc-300 px-[6px] py-1 align-top">
                                    <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Booking Reference</span>
                                    <div className="min-h-[15px] border-b border-zinc-400 text-[10px] font-bold leading-[1.25]">{booking.reference_number || ''}</div>
                                </td>
                                <td className="w-1/3 border-r border-b border-zinc-300 px-[6px] py-1 align-top">
                                    <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Drop Off / Pickup Date</span>
                                    <div className="min-h-[15px] border-b border-zinc-400 text-[10px] font-bold leading-[1.25]">{formatDate(booking.preferred_date)}</div>
                                </td>
                                <td className="w-1/3 border-b border-zinc-300 px-[6px] py-1 align-top">
                                    <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Batch Number</span>
                                    <div className="min-h-[15px] border-b border-zinc-400 text-[10px] font-bold leading-[1.25]">{batchInfo}</div>
                                </td>
                            </tr>
                            <tr>
                                <td className="border-r border-zinc-300 px-[6px] py-1 align-top">
                                    <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Box Count</span>
                                    <div className="min-h-[15px] border-b border-zinc-400 text-[10px] font-bold leading-[1.25]">{totalBoxes}</div>
                                </td>
                                <td className="border-r border-zinc-300 px-[6px] py-1 align-top">
                                    <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Box Number</span>
                                    <div className="min-h-[15px] border-b border-zinc-400 text-[10px] font-bold leading-[1.25]">{boxIndex + 1} of {totalBoxes}</div>
                                </td>
                                <td className="px-[6px] py-1 align-top">
                                    <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Tracking Number / Box Type</span>
                                    <div className="min-h-[15px] border-b border-zinc-400 text-[10px] font-bold leading-[1.25]">{[trackingNumber, boxTypeName].filter(Boolean).join(' ')}</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Sender / Recipient */}
                <table className="w-full border-collapse mb-[9px]" style={{ tableLayout: 'fixed' }}>
                    <tbody><tr>
                        <td className="w-[49%] pr-[1%] align-top border-0 p-0">
                            <div className="border-[1.5px] border-zinc-900 min-h-[128px]">
                                <div className="bg-zinc-900 text-white text-[8px] font-black tracking-[0.1em] px-[6px] py-1 uppercase border-b-[1.5px] border-zinc-900">
                                    1. Sender (Exporter)
                                </div>
                                <div className="p-[6px]">
                                    <div className="mb-[5px]">
                                        <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Full Name</span>
                                        <div className="min-h-[15px] border-b border-zinc-400 text-[10px] font-bold leading-[1.25]">{senderName}</div>
                                    </div>
                                    <div className="mb-[5px]">
                                        <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Address</span>
                                        <div className="min-h-[13px] border-b border-zinc-400 text-[9px] font-bold leading-[1.25]">{senderAddressLine1}</div>
                                        <div className="min-h-[13px] border-b border-zinc-400 text-[9px] font-bold leading-[1.25]">{senderAddressLine2}</div>
                                    </div>
                                    <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                                        <tbody><tr>
                                            <td className="w-[48%] pr-[2%] border-0 p-0 align-top">
                                                <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Phone</span>
                                                <div className="min-h-[13px] border-b border-zinc-400 text-[9px] font-bold leading-[1.25]">{senderPhone}</div>
                                            </td>
                                            <td className="w-[48%] pl-[2%] border-0 p-0 align-top">
                                                <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Email</span>
                                                <div className="min-h-[13px] border-b border-zinc-400 text-[9px] font-bold leading-[1.25]">{senderEmail}</div>
                                            </td>
                                        </tr></tbody>
                                    </table>
                                </div>
                            </div>
                        </td>
                        <td className="w-[49%] pl-[1%] align-top border-0 p-0">
                            <div className="border-[1.5px] border-zinc-900 min-h-[128px]">
                                <div className="bg-zinc-900 text-white text-[8px] font-black tracking-[0.1em] px-[6px] py-1 uppercase border-b-[1.5px] border-zinc-900">
                                    2. Recipient (Consignee)
                                </div>
                                <div className="p-[6px]">
                                    <div className="mb-[5px]">
                                        <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Full Name</span>
                                        <div className="min-h-[15px] border-b border-zinc-400 text-[10px] font-bold leading-[1.25]">{recipientDisplayName}</div>
                                    </div>
                                    <div className="mb-[5px]">
                                        <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Address</span>
                                        <div className="min-h-[13px] border-b border-zinc-400 text-[9px] font-bold leading-[1.25]">{recipientAddressLine1}</div>
                                        <div className="min-h-[13px] border-b border-zinc-400 text-[9px] font-bold leading-[1.25]">{recipientAddressLine2}</div>
                                    </div>
                                    <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                                        <tbody><tr>
                                            <td className="w-[48%] pr-[2%] border-0 p-0 align-top">
                                                <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Phone</span>
                                                <div className="min-h-[13px] border-b border-zinc-400 text-[9px] font-bold leading-[1.25]">{recipientPhone}</div>
                                            </td>
                                            <td className="w-[48%] pl-[2%] border-0 p-0 align-top">
                                                <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Email</span>
                                                <div className="min-h-[13px] border-b border-zinc-400 text-[9px] font-bold leading-[1.25]">{recipientEmail}</div>
                                            </td>
                                        </tr></tbody>
                                    </table>
                                </div>
                            </div>
                        </td>
                    </tr></tbody>
                </table>

                {/* 3. Detailed Packing List */}
                <div className="mt-[10px] mb-[6px] border-b-2 border-zinc-900 text-[9.5px] font-black tracking-[0.08em] pb-[3px] uppercase">
                    3. Detailed Packing List
                </div>

                {/* Box strip */}
                <table className="w-full border-collapse mb-[6px]" style={{ tableLayout: 'fixed' }}>
                    <tbody><tr>
                        <td className="w-[28%] border-0 p-0 align-middle"><div className="border-b border-zinc-300 h-px" /></td>
                        <td className="w-[44%] border-0 p-0 align-middle text-center text-[8px] font-black tracking-[0.07em] uppercase px-2">
                            Box {boxIndex + 1} of {totalBoxes}{trackingNumber ? ` - ${trackingNumber}` : ''}
                        </td>
                        <td className="w-[28%] border-0 p-0 align-middle"><div className="border-b border-zinc-300 h-px" /></td>
                    </tr></tbody>
                </table>

                {/* Items table */}
                <table className="w-full border-2 border-zinc-900 border-collapse" style={{ tableLayout: 'fixed' }}>
                    <thead>
                        <tr>
                            <th className="w-[6%] bg-zinc-100 border-r border-zinc-900 border-b-2 border-b-zinc-900 text-[7.5px] font-black p-[3px_4px] text-center uppercase">#</th>
                            <th className="w-[10%] bg-zinc-100 border-r border-zinc-900 border-b-2 border-b-zinc-900 text-[7.5px] font-black p-[3px_4px] text-center uppercase">Qty</th>
                            <th className="w-[54%] bg-zinc-100 border-r border-zinc-900 border-b-2 border-b-zinc-900 text-[7.5px] font-black p-[3px_4px] text-left uppercase">Item Name / Description</th>
                            <th className="w-[30%] bg-zinc-100 border-b-2 border-b-zinc-900 text-[7.5px] font-black p-[3px_4px] text-left uppercase">Category</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: firstPageRows }).map((_, i) => {
                            const item = itemsList[i];

                            return (
                                <tr key={i}>
                                    <td className="border-r border-zinc-300 border-b border-zinc-300 text-[8px] h-[17px] p-[2px_4px] text-center align-middle">{i + 1}</td>
                                    <td className="border-r border-zinc-300 border-b border-zinc-300 text-[8px] h-[17px] p-[2px_4px] text-center align-middle">{item?.qty ?? ''}</td>
                                    <td className="border-r border-zinc-300 border-b border-zinc-300 text-[8px] h-[17px] p-[2px_4px] text-left align-middle">{item?.name ?? ''}</td>
                                    <td className="border-b border-zinc-300 text-[8px] h-[17px] p-[2px_4px] text-left align-middle">{item?.description ?? item?.category ?? ''}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                <p className="mt-[5px] text-[7.5px] italic font-bold text-zinc-500 text-center">
                    Continue the detailed packing list on Page 2. Use one line per item group and keep quantities itemized by box.
                </p>

                <Footer
                    left={<>Digital Signature ID: {booking.uuid?.split('-')[0] || '________________'}</>}
                    right={<>{declarationSettings.brandName || 'Love Balikbayan Logistics System'} - Printed {new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}</>}
                />
            </div>

            {/* ═══════════════ PAGE 2 — CONTINUATION + SIGNATURES ═══════════════ */}
            <div className="declaration-page max-w-[21cm] mx-auto bg-white shadow-2xl print:shadow-none mb-12 print:mb-0 p-[0.75cm_0.9cm] text-[9px] leading-[1.25] text-zinc-900 font-sans">
                <Masthead
                    title="Packing List Continuation"
                    subtitle={`Official continuation for Box ${boxIndex + 1} of ${totalBoxes}`}
                    pageInfo={<>Page 2 of 3<br />{trackingNumber || 'Tracking No.'}</>}
                />

                {/* Continuation items table */}
                <table className="w-full border-2 border-zinc-900 border-collapse" style={{ tableLayout: 'fixed' }}>
                    <thead>
                        <tr>
                            <th className="w-[6%] bg-zinc-100 border-r border-zinc-900 border-b-2 border-b-zinc-900 text-[7.5px] font-black p-[3px_4px] text-center uppercase">#</th>
                            <th className="w-[10%] bg-zinc-100 border-r border-zinc-900 border-b-2 border-b-zinc-900 text-[7.5px] font-black p-[3px_4px] text-center uppercase">Qty</th>
                            <th className="w-[54%] bg-zinc-100 border-r border-zinc-900 border-b-2 border-b-zinc-900 text-[7.5px] font-black p-[3px_4px] text-left uppercase">Item Name / Description</th>
                            <th className="w-[30%] bg-zinc-100 border-b-2 border-b-zinc-900 text-[7.5px] font-black p-[3px_4px] text-left uppercase">Category</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: Math.max(continuationRows, Math.max(0, itemsList.length - firstPageRows)) }).map((_, i) => {
                            const itemIndex = firstPageRows + i;
                            const item = itemsList[itemIndex];

                            return (
                                <tr key={i}>
                                    <td className="border-r border-zinc-300 border-b border-zinc-300 text-[8px] h-[15px] p-[2px_4px] text-center align-middle">{itemIndex + 1}</td>
                                    <td className="border-r border-zinc-300 border-b border-zinc-300 text-[8px] h-[15px] p-[2px_4px] text-center align-middle">{item?.qty ?? ''}</td>
                                    <td className="border-r border-zinc-300 border-b border-zinc-300 text-[8px] h-[15px] p-[2px_4px] text-left align-middle">{item?.name ?? ''}</td>
                                    <td className="border-b border-zinc-300 text-[8px] h-[15px] p-[2px_4px] text-left align-middle">{item?.description ?? item?.category ?? ''}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* 4. Legal Declaration and Signatures */}
                <div className="border-[1.5px] border-zinc-900 mt-2">
                    <div className="bg-zinc-900 text-white text-[8px] font-black tracking-[0.1em] px-[6px] py-1 uppercase">
                        4. Legal Declaration and Signatures
                    </div>
                    <div className="p-[6px]">
                        {/* Prohibited Items Notice */}
                        <div className="bg-amber-50 border border-amber-500 text-[7.5px] font-bold leading-[1.35] mb-[5px] p-[5px_6px] text-justify text-zinc-600">
                            <strong className="text-zinc-900 font-black uppercase">{declarationSettings.prohibitedTitle || 'Prohibited Items Notice:'}</strong>{' '}
                            {declarationSettings.prohibitedNotice || 'Firearms, ammunition, illegal drugs, explosives, flammable materials, live animals, counterfeit goods, and other hazardous materials are strictly prohibited. This document is a legally binding declaration under the Customs Modernization and Tariff Act (CMTA) of the Philippines.'}
                        </div>

                        {/* Certification copy */}
                        <p className="text-[7.8px] leading-[1.35] text-zinc-600 text-justify mb-[5px]">
                            I certify that I am the Consignor/Sender of the above goods and that this detailed packing list is the true and correct description of the goods contained in this box/parcel being sent to the Philippines. I certify that there are no undeclared, restricted, illegal, or banned items, including firearms, ammunition, illegal drugs, or combustible goods, included in this shipment.
                        </p>
                        <p className="text-[7.8px] leading-[1.35] text-zinc-600 text-justify mb-[5px]">
                            I authorize <strong>LOVE BALIKBAYAN BOXES CARGO SERVICES</strong>, located in <strong>Victoria, Australia</strong>, to clear this shipment through Customs and acknowledge that duties, taxes, charges, penalties, and other expenses due on the shipment or incurred for its release must be paid. By signing, I agree to all Terms &amp; Conditions stated in this declaration.
                        </p>

                        {/* Signature row */}
                        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                            <tbody><tr>
                                <td className="w-[32%] pr-[1.5%] border-0 p-0 align-top">
                                    <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Consignor / Sender Printed Name</span>
                                    <div className="min-h-[15px] border-b border-zinc-400 text-[10px] font-bold leading-[1.25]">{printedName}</div>
                                </td>
                                <td className="w-[36%] px-[1.5%] border-0 p-0 align-top">
                                    <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Consignor / Sender Signature</span>
                                    <div className="border border-zinc-900 h-[38px] relative text-center">
                                        {cert.signature ? (
                                            <img src={cert.signature} alt="Signature" className="block mx-auto my-0.5 max-h-[34px]" />
                                        ) : (
                                            <span className="text-zinc-400 block text-[7px] font-black tracking-[0.08em] uppercase leading-[38px]">Physical Signature Required</span>
                                        )}
                                    </div>
                                </td>
                                <td className="w-[32%] pl-[1.5%] border-0 p-0 align-top">
                                    <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Date Signed</span>
                                    <div className="min-h-[15px] border-b border-zinc-400 text-[10px] font-bold leading-[1.25]">{formatDate(dateSigned)}</div>
                                </td>
                            </tr></tbody>
                        </table>

                        {/* For Office Use Only */}
                        <div className="bg-zinc-100 border-[1.5px] border-zinc-400 mt-[7px] p-[6px]">
                            <div className="text-[8px] font-black tracking-[0.1em] uppercase text-zinc-600 mb-[5px]">For Office Use Only</div>
                            <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                                <tbody><tr>
                                    <td className="w-[36%] pr-[1.5%] border-0 p-0 align-top">
                                        <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Authorized Representative Signature</span>
                                        <div className="border border-zinc-900 h-[38px] text-center" />
                                    </td>
                                    <td className="w-[22%] px-[1.5%] border-0 p-0 align-top">
                                        <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Date Verified</span>
                                        <div className="min-h-[15px] border-b border-zinc-400" />
                                    </td>
                                    <td className="w-[22%] px-[1.5%] border-0 p-0 align-top">
                                        <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Officer Name</span>
                                        <div className="min-h-[15px] border-b border-zinc-400" />
                                    </td>
                                    <td className="w-[20%] pl-[1.5%] border-0 p-0 align-top">
                                        <span className="block mb-0.5 text-[7px] font-black tracking-[0.06em] uppercase text-zinc-400">Dispatch Method</span>
                                        <div className="text-[8px] font-extrabold mt-[5px]">
                                            <span className="inline-block h-[10px] w-[10px] border-[1.5px] border-zinc-900 mr-1 align-middle" />Mail
                                            <span className="inline-block w-2" />
                                            <span className="inline-block h-[10px] w-[10px] border-[1.5px] border-zinc-900 mr-1 align-middle" />Courier
                                        </div>
                                    </td>
                                </tr></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <Footer
                    left="Compliance Level: Secure-A1"
                    right={declarationSettings.originLocation || 'Victoria, Australia'}
                />
            </div>

            {/* ═══════════════ PAGE 3 — TERMS & CONDITIONS ═══════════════ */}
            <div className="declaration-page max-w-[21cm] mx-auto bg-white shadow-2xl print:shadow-none mb-12 print:mb-0 p-[0.75cm_0.9cm] text-[9px] leading-[1.25] text-zinc-900 font-sans">
                <Masthead
                    title="Terms & Conditions"
                    subtitle="Declaration terms, warranties, and liability limits"
                    pageInfo={<>Page 3 of 3<br />Box {boxIndex + 1} of {totalBoxes}</>}
                />

                <DeclarationTerms variant="print" />

                <Footer
                    left={declarationSettings.brandName || 'Love Balikbayan Logistics System'}
                    right={<>Printed {new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })}</>}
                />
            </div>
        </>
    );
}

export default function PrintDeclaration({ booking, declarationSettings }: Props) {
    const data = booking.declaration_data || {};
    const sender = booking.sender || data.sender || {};
    const cert = data.certification || {};

    const resolvedBoxes = (booking.boxes || []).map((box: any) => {
        const savedBox = (data.boxes || []).find((b: any) => b.tracking_number === box.tracking_number || String(b.id) === String(box.id));
        const recipient = savedBox?.recipient || box.recipient || data.recipient || {};

        return {
            ...box,
            box_type: box.box_type?.name || box.box_type,
            recipient,
            items: savedBox?.items || [{ name: 'Contents as per packing list', description: 'Other', category: 'Other', qty: 1, value: 0 }],
        };
    });

    const [selectedBoxIndex, setSelectedBoxIndex] = useState<number | null>(null);
    const [printAll, setPrintAll] = useState(false);
    const [qrCode, setQrCode] = useState<string>('');

    useEffect(() => {
        const trackingUrl = `${window.location.origin}/tracking/${booking.reference_number}`;
        QRCode.toDataURL(trackingUrl, { margin: 1, width: 100 }, (err, url) => {
            if (!err) {
                setQrCode(url);
            }
        });
    }, [booking.reference_number]);

    const handleSelectBox = (index: number) => {
        setSelectedBoxIndex(index);
        setPrintAll(false);
    };

    const handlePrintAll = () => {
        setPrintAll(true);
        setSelectedBoxIndex(null);
    };

    const recipientName = (r: any) => {
        if (r.name) {
            return r.name;
        }

        return `${r.first_name || ''} ${r.last_name || ''}`.trim() || 'N/A';
    };

    // Selection screen
    if (selectedBoxIndex === null && !printAll) {
        return (
            <div className="min-h-screen bg-zinc-50 p-8 font-sans text-zinc-900">
                <Head title={`${declarationSettings.headerText} — ${booking.reference_number}`} />
                <div className="max-w-2xl mx-auto">
                    <div className="mb-8 flex justify-between items-end">
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tight mb-1">{declarationSettings.headerText}</h1>
                            <p className="text-sm text-zinc-500">Booking <span className="font-bold font-mono">{booking.reference_number}</span> — Select a box to view its declaration.</p>
                        </div>
                        {resolvedBoxes.length > 1 && (
                            <button
                                onClick={handlePrintAll}
                                className="px-4 py-2 bg-zinc-900 text-white rounded-xl shadow-sm hover:bg-black transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                View All Boxes
                            </button>
                        )}
                    </div>
                    <div className="space-y-3">
                        {resolvedBoxes.map((box: any, i: number) => (
                            <button
                                key={box.id || i}
                                onClick={() => handleSelectBox(i)}
                                className="w-full text-left rounded-2xl border-2 border-zinc-200 bg-white p-5 hover:border-zinc-900 hover:shadow-lg transition-all group"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">Box {i + 1}</p>
                                        <p className="text-lg font-black tracking-tight">{box.tracking_number || `Box ${i + 1}`}</p>
                                        <p className="text-xs text-zinc-500 mt-1">
                                            {box.box_type} · To: <span className="font-bold">{recipientName(box.recipient)}</span> — {box.recipient.city || 'N/A'}, {box.recipient.province || box.recipient.state || ''}
                                        </p>
                                        <p className="text-xs text-zinc-400 mt-0.5">{box.items.length} item(s) declared</p>
                                    </div>
                                    <div className="text-zinc-300 group-hover:text-zinc-900 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white p-8 font-sans text-zinc-900 print:p-0">
            <Head title={`${declarationSettings.headerText} — ${booking.reference_number}`} />

            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page { margin: 1.2cm; }
                    .no-print { display: none !important; }
                    body { background: white !important; }
                    .declaration-page {
                        page-break-after: always;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: 3px solid black !important;
                    }
                    .declaration-page:last-child { page-break-after: auto; }
                }
            `}} />

            <div className="no-print mb-6 flex justify-between items-center bg-zinc-100 p-4 rounded-lg border border-zinc-200 sticky top-0 z-50 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <p className="text-sm font-medium text-zinc-600">
                        {printAll
                            ? `Printing all ${resolvedBoxes.length} box declarations...`
                            : `Printing declaration for Box ${(selectedBoxIndex ?? 0) + 1} → ${recipientName(resolvedBoxes[selectedBoxIndex ?? 0].recipient)}`
                        }
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            setSelectedBoxIndex(null);
                            setPrintAll(false);
                        }}
                        className="px-4 py-2 bg-white border border-zinc-300 text-zinc-700 rounded shadow-sm hover:bg-zinc-50 transition-colors text-sm font-bold uppercase tracking-widest"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={() => window.print()}
                        className="px-6 py-2 bg-zinc-900 text-white rounded shadow-sm hover:bg-black transition-colors text-sm font-bold uppercase tracking-widest"
                    >
                        Print Document(s)
                    </button>
                </div>
            </div>

            <div className="print-container">
                {printAll ? (
                    resolvedBoxes.map((box: any, i: number) => (
                        <DeclarationDocument
                            key={box.id || i}
                            booking={booking}
                            box={box}
                            boxIndex={i}
                            qrCode={qrCode}
                            sender={sender}
                            cert={cert}
                            declarationSettings={declarationSettings}
                        />
                    ))
                ) : (
                    <DeclarationDocument
                        booking={booking}
                        box={resolvedBoxes[selectedBoxIndex ?? 0]}
                        boxIndex={selectedBoxIndex ?? 0}
                        qrCode={qrCode}
                        sender={sender}
                        cert={cert}
                        declarationSettings={declarationSettings}
                    />
                )}
            </div>

            <div className="mt-8 text-[10px] text-zinc-400 leading-normal max-w-[21cm] mx-auto text-justify px-4">
                <p className="font-black text-zinc-500 mb-1 uppercase tracking-widest">{declarationSettings.prohibitedTitle}</p>
                <p className="italic">{declarationSettings.prohibitedNotice}</p>
            </div>
        </div>
    );
}
