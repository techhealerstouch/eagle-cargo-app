import { Head, useForm, Link } from '@inertiajs/react';
import { ArrowRight, CheckCircle2, ChevronLeft, FileText, Package2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { toast } from 'sonner';

import DeclarationTerms from '@/components/common/declaration-terms';
import AppLayout from '@/layouts/app-layout';
import PhoneInput from '@/components/ui/PhoneInput';
import { validatePhone, COUNTRIES } from '@/lib/countries';
import declarationRoutes from '@/routes/track/declaration';
import type { BreadcrumbItem } from '@/types';

interface Booking {
    id: number;
    reference_number: string;
    preferred_date?: string | null;
    sender?: any;
    boxes?: any[];
    declaration_data?: any;
    status?: string;
}

interface DeclarationSettings {
    headerText: string;
    instructions: string;
    footerText: string;
    requireSignature: boolean;
}

interface Props {
    booking: Booking;
    declarationSettings: DeclarationSettings;
}

const ALL_COUNTRIES = COUNTRIES.map(c => c.name).sort();

const PREDEFINED_DESCRIPTIONS = [
    'Clothing & Apparel',
    'Shoes / Footwear',
    'Canned Goods',
    'Groceries / Food Items',
    'Beverages',
    'Toiletries & Personal Care',
    'Cleaning Supplies / Household',
    'Toys',
    'Electronics / Gadgets',
    'Kitchenware / Cookware',
    'Chocolates & Sweets',
    'Beddings & Linens',
    'Bags & Wallets',
    'Home Decor',
    'Vitamins / Supplements',
    'School & Office Supplies'
];

const baseInputClass = 'h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500';

function toText(value: unknown): string {
    return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function toDateInputValue(value: unknown): string {
    const raw = toText(value);

    if (!raw) {
        return '';
    }

    return raw.slice(0, 10);
}

function todayIsoDate(): string {
    return new Date().toISOString().slice(0, 10);
}

function createItem(raw?: any) {
    return {
        id: raw?.id ?? crypto.randomUUID(),
        name: toText(raw?.name),
        description: toText(raw?.description),
        qty: toText(raw?.qty),
        value: toText(raw?.value),
        category: toText(raw?.category) || 'Other',
    };
}

function createBoxRecipient(raw?: any) {
    return {
        first_name: toText(raw?.first_name),
        last_name: toText(raw?.last_name),
        address: toText(raw?.address),
        city: toText(raw?.city),
        province: toText(raw?.province),
        postcode: toText(raw?.postcode || raw?.zip_code),
        country: toText(raw?.country) || 'Philippines',
        mobile: toText(raw?.mobile || raw?.phone_number || raw?.mobile_number),
        email: toText(raw?.email),
    };
}

function createAdditionalBox(index: number, raw?: any, bookingRecipient?: any) {
    return {
        id: raw?.id ?? crypto.randomUUID(),
        tracking_number: toText(raw?.tracking_number),
        box_type: toText(raw?.box_type) || `Additional Box ${index}`,
        recipient: createBoxRecipient(raw?.recipient || bookingRecipient),
        items: Array.isArray(raw?.items) && raw.items.length > 0 ? raw.items.map((item: any) => createItem(item)) : [createItem()],
    };
}

function buildInitialBoxes(booking: Booking, savedDeclaration: any) {
    const bookingBoxes = Array.isArray(booking.boxes) ? booking.boxes : [];
    const savedBoxes = Array.isArray(savedDeclaration?.boxes) ? savedDeclaration.boxes : [];

    // Backward compat: if old format had a top-level recipient, use it as fallback
    const legacyRecipient = savedDeclaration?.recipient;

    const fromBooking = bookingBoxes.map((box: any, idx: number) => {
        const savedMatch = savedBoxes.find((saved: any) => {
            if (saved?.id && box?.id && String(saved.id) === String(box.id)) {
                return true;
            }

            if (saved?.tracking_number && box?.tracking_number && saved.tracking_number === box.tracking_number) {
                return true;
            }

            return false;
        });

        // Resolve recipient: saved per-box > booking box recipient > legacy top-level
        const bookingRecipient = box?.recipient;
        let recipientSource = savedMatch?.recipient || legacyRecipient || {};

        if (bookingRecipient?.name && !recipientSource.first_name) {
            const parts = bookingRecipient.name.trim().split(' ');
            recipientSource = {
                first_name: parts.shift() || '',
                last_name: parts.join(' ') || '',
                address: bookingRecipient.address,
                city: bookingRecipient.city,
                province: bookingRecipient.province,
                postcode: bookingRecipient.zip_code || bookingRecipient.postcode,
                mobile: bookingRecipient.phone_number || bookingRecipient.mobile_number,
                email: bookingRecipient.email,
                ...recipientSource,
            };
        }

        return {
            id: box?.id ?? crypto.randomUUID(),
            tracking_number: toText(box?.tracking_number),
            box_type: toText(box?.box_type?.name ?? box?.box_type) || `Box ${idx + 1}`,
            recipient: createBoxRecipient(recipientSource),
            items: Array.isArray(savedMatch?.items) && savedMatch.items.length > 0 ? savedMatch.items.map((item: any) => createItem(item)) : [createItem()],
        };
    });

    const additionalSaved = savedBoxes
        .filter((saved: any) => !fromBooking.some((box: any) => {
            if (saved?.id && box?.id && String(saved.id) === String(box.id)) {
                return true;
            }

            if (saved?.tracking_number && box?.tracking_number && saved.tracking_number === box.tracking_number) {
                return true;
            }

            return false;
        }))
        .map((saved: any, idx: number) => createAdditionalBox(fromBooking.length + idx + 1, saved));

    const merged = [...fromBooking, ...additionalSaved];

    return merged.length > 0 ? merged : [createAdditionalBox(1)];
}

function fieldServerError(errors: Record<string, string>, key: string): string | undefined {
    return errors[key] || errors[`declaration_data.${key}`] || undefined;
}

function StepIndicator({ step }: { step: number }) {
    const steps = [
        { id: 1, label: 'Shipment & Contacts' },
        { id: 2, label: 'Declaration & Signature' },
    ];

    return (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {steps.map((item) => {
                const isActive = step === item.id;
                const isDone = step > item.id;

                return (
                    <div
                        key={item.id}
                        className={`rounded-2xl border p-4 transition-all ${
                            isActive
                                ? 'border-sky-500 bg-sky-50'
                                : isDone
                                    ? 'border-emerald-300 bg-emerald-50'
                                    : 'border-zinc-200 bg-white'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                                    isDone
                                        ? 'bg-emerald-500 text-white'
                                        : isActive
                                            ? 'bg-sky-500 text-white'
                                            : 'bg-zinc-200 text-zinc-600'
                                }`}
                            >
                                {isDone ? <CheckCircle2 className="size-4" /> : item.id}
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Step {item.id} of 2</p>
                                <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <div className="space-y-1 border-b border-zinc-200 pb-3">
            <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
            {subtitle ? <p className="text-sm text-zinc-500">{subtitle}</p> : null}
        </div>
    );
}

function Field({
    label,
    required,
    error,
    hint,
    children,
}: {
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                {label}
                {required ? <span className="ml-1 text-red-500">*</span> : null}
            </label>
            {children}
            {hint ? <p className="text-xs text-zinc-400">{hint}</p> : null}
            {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
        </div>
    );
}

export default function DeclarationForm({ booking, declarationSettings }: Props) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Track', href: '/track' },
        { title: 'Declaration', href: '#' },
    ];

    const savedDeclaration = booking.declaration_data || {};
    const initialBoxes = buildInitialBoxes(booking, savedDeclaration);

    const initialSenderFirst = toText(booking.sender?.first_name || savedDeclaration.sender?.first_name);
    const initialSenderLast = toText(booking.sender?.last_name || savedDeclaration.sender?.last_name);
    const initialSignedBy = toText(savedDeclaration.certification?.signed_by) || `${initialSenderFirst} ${initialSenderLast}`.trim();

    const [step, setStep] = useState(1);
    const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
    const [signatureDraft, setSignatureDraft] = useState<string>(toText(savedDeclaration.certification?.signature));
    const signatureDraftRef = useRef(signatureDraft);

    const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const signaturePadRef = useRef<SignaturePad | null>(null);

    useEffect(() => {
        signatureDraftRef.current = signatureDraft;
    }, [signatureDraft]);

    const { data, setData, post, processing, errors, transform } = useForm<any>({
        booking_id: booking.id,
        declaration_data: {
            shipment: {
                pickup_date: toDateInputValue(savedDeclaration.shipment?.pickup_date || booking.preferred_date),
                box_count: toText(savedDeclaration.shipment?.box_count) || String(initialBoxes.length),
                continuation_notes: toText(savedDeclaration.shipment?.continuation_notes),
                office_date: toDateInputValue(savedDeclaration.shipment?.office_date),
            },
            sender: {
                first_name: initialSenderFirst,
                last_name: initialSenderLast,
                address: toText(booking.sender?.address || savedDeclaration.sender?.address),
                suburb: toText(booking.sender?.suburb || booking.sender?.city || savedDeclaration.sender?.suburb || savedDeclaration.sender?.city),
                city: toText(booking.sender?.suburb || booking.sender?.city || savedDeclaration.sender?.suburb || savedDeclaration.sender?.city),
                state: toText(booking.sender?.state || savedDeclaration.sender?.state),
                postcode: toText(booking.sender?.postcode || savedDeclaration.sender?.postcode),
                country: toText(booking.sender?.country || savedDeclaration.sender?.country) || 'Australia',
                mobile: toText(booking.sender?.mobile || booking.sender?.mobile_number || savedDeclaration.sender?.mobile),
                email: toText(booking.sender?.email || savedDeclaration.sender?.email),
            },
            boxes: initialBoxes,
            certification: {
                no_prohibited: Boolean(savedDeclaration.certification?.no_prohibited),
                agree_terms: Boolean(savedDeclaration.certification?.agree_terms),
                signed_by: initialSignedBy,
                date_signed: toDateInputValue(savedDeclaration.certification?.date_signed) || todayIsoDate(),
                signature: toText(savedDeclaration.certification?.signature),
            },
        },
    });

    const clearError = (key: string) => {
        if (!localErrors[key]) {
            return;
        }

        setLocalErrors((prev) => {
            const next = { ...prev };
            delete next[key];

            return next;
        });
    };

    const getError = (key: string) => localErrors[key] || fieldServerError(errors as Record<string, string>, key);

    const setSenderField = (field: string, value: string) => {
        const extraSync = (field === 'city' || field === 'suburb') ? { city: value, suburb: value } : {};
        setData('declaration_data', {
            ...data.declaration_data,
            sender: {
                ...data.declaration_data.sender,
                [field]: value,
                ...extraSync,
            },
        });
        clearError(`sender.${field}`);
        if (field === 'city' || field === 'suburb') {
            clearError('sender.city');
            clearError('sender.suburb');
        }
    };

    const setBoxRecipientField = (boxIndex: number, field: string, value: string) => {
        const currentBoxes = [...data.declaration_data.boxes];
        currentBoxes[boxIndex] = {
            ...currentBoxes[boxIndex],
            recipient: {
                ...currentBoxes[boxIndex].recipient,
                [field]: value,
            },
        };
        setData('declaration_data', { ...data.declaration_data, boxes: currentBoxes });
        clearError(`boxes.${boxIndex}.recipient.${field}`);
    };

    const copyRecipientFromBox1 = (targetIndex: number) => {
        const firstBoxRecipient = data.declaration_data.boxes[0]?.recipient;

        if (!firstBoxRecipient) {
            return;
        }

        const currentBoxes = [...data.declaration_data.boxes];
        currentBoxes[targetIndex] = {
            ...currentBoxes[targetIndex],
            recipient: { ...firstBoxRecipient },
        };
        setData('declaration_data', { ...data.declaration_data, boxes: currentBoxes });

        // Clear all recipient errors for this box
        const recipientFields = ['first_name', 'last_name', 'address', 'city', 'province', 'postcode', 'country', 'mobile', 'email'];
        recipientFields.forEach(field => clearError(`boxes.${targetIndex}.recipient.${field}`));
    };

    const setShipmentField = (field: string, value: string) => {
        setData('declaration_data', {
            ...data.declaration_data,
            shipment: {
                ...data.declaration_data.shipment,
                [field]: value,
            },
        });
        clearError(`shipment.${field}`);
    };

    const setCertificationField = (field: string, value: string | boolean) => {
        setData('declaration_data', {
            ...data.declaration_data,
            certification: {
                ...data.declaration_data.certification,
                [field]: value,
            },
        });
        clearError(`certification.${field}`);
    };

    /*
    const setBoxes = (nextBoxes: any[]) => {
        setData('declaration_data', {
            ...data.declaration_data,
            boxes: nextBoxes,
            shipment: {
                ...data.declaration_data.shipment,
                box_count: String(nextBoxes.length),
            },
        });
        clearError('shipment.box_count');
    };
    */

    // Unused box quantity functions kept for future reference
    /*
    const syncBoxesByCount = (rawCount: string) => {
        setShipmentField('box_count', rawCount);

        if (!rawCount) {
            return;
        }

        const parsed = Number(rawCount);

        if (!Number.isInteger(parsed) || parsed < 1) {
            return;
        }

        const targetCount = Math.min(parsed, 30);
        const current = [...data.declaration_data.boxes];

        if (targetCount > current.length) {
            while (current.length < targetCount) {
                current.push(createAdditionalBox(current.length + 1));
            }
        }

        if (targetCount < current.length) {
            current.splice(targetCount);
        }

        setData('declaration_data', {
            ...data.declaration_data,
            boxes: current,
            shipment: {
                ...data.declaration_data.shipment,
                box_count: String(targetCount),
            },
        });
    };

    const addBox = () => {
        const currentBoxes = [...data.declaration_data.boxes, createAdditionalBox(data.declaration_data.boxes.length + 1)];
        setBoxes(currentBoxes);
    };

    const removeBox = (boxId: string | number) => {
        if (data.declaration_data.boxes.length === 1) {
            return;
        }

        const currentBoxes = data.declaration_data.boxes.filter((box: any) => box.id !== boxId);
        setBoxes(currentBoxes);
    };
    */

    const addItem = (boxIndex: number) => {
        const currentBoxes = [...data.declaration_data.boxes];
        currentBoxes[boxIndex] = {
            ...currentBoxes[boxIndex],
            items: [...currentBoxes[boxIndex].items, createItem()],
        };
        setData('declaration_data', { ...data.declaration_data, boxes: currentBoxes });
    };

    const removeItem = (boxIndex: number, itemId: string) => {
        const currentBoxes = [...data.declaration_data.boxes];

        if (currentBoxes[boxIndex].items.length === 1) {
            return;
        }

        currentBoxes[boxIndex] = {
            ...currentBoxes[boxIndex],
            items: currentBoxes[boxIndex].items.filter((item: any) => item.id !== itemId),
        };

        setData('declaration_data', { ...data.declaration_data, boxes: currentBoxes });
    };

    const updateItemField = (boxIndex: number, itemIndex: number, field: 'name' | 'description' | 'qty' | 'value', value: string) => {
        const currentBoxes = [...data.declaration_data.boxes];
        const currentItems = [...currentBoxes[boxIndex].items];

        const updatedItem = {
            ...currentItems[itemIndex],
            [field]: value,
        };

        if (field === 'description') {
            updatedItem.category = PREDEFINED_DESCRIPTIONS.includes(value) ? value : 'Other';
        }

        currentItems[itemIndex] = updatedItem;

        currentBoxes[boxIndex] = {
            ...currentBoxes[boxIndex],
            items: currentItems,
        };

        setData('declaration_data', { ...data.declaration_data, boxes: currentBoxes });
        clearError(`boxes.${boxIndex}.items.${itemIndex}.${field}`);
    };

    useEffect(() => {
        if (step !== 2 || !signatureCanvasRef.current) {
            return;
        }

        const canvas = signatureCanvasRef.current;
        const pad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255,255,255)',
            penColor: 'rgb(24,24,27)',
        });

        const onSignatureEnd = () => {
            if (!pad.isEmpty()) {
                setSignatureDraft(pad.toDataURL());
            }
        };

        pad.addEventListener('endStroke', onSignatureEnd);

        signaturePadRef.current = pad;

        const resize = () => {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext('2d')?.scale(ratio, ratio);
            pad.clear();

            if (signatureDraftRef.current) {
                pad.fromDataURL(signatureDraftRef.current);
            }
        };

        resize();
        window.addEventListener('resize', resize);

        return () => {
            window.removeEventListener('resize', resize);
            pad.removeEventListener('endStroke', onSignatureEnd);

            if (!pad.isEmpty()) {
                setSignatureDraft(pad.toDataURL());
            }

            pad.off();
            signaturePadRef.current = null;
        };
    }, [step]);

    const clearSignature = () => {
        signaturePadRef.current?.clear();
        setSignatureDraft('');
        setCertificationField('signature', '');
        clearError('certification.signature');
    };

    const validateStep1 = () => {
        const nextErrors: Record<string, string> = {};
        const shipment = data.declaration_data.shipment;
        const sender = data.declaration_data.sender;
        const boxes = data.declaration_data.boxes;

        if (!toText(shipment.pickup_date)) {
            nextErrors['shipment.pickup_date'] = 'Pickup date is required.';
        }

        const boxCount = Number(shipment.box_count);

        if (!Number.isInteger(boxCount) || boxCount < 1) {
            nextErrors['shipment.box_count'] = 'Please enter at least 1 box.';
        }

        const senderRequired = ['first_name', 'last_name', 'address', 'state', 'mobile', 'email'];
        senderRequired.forEach((field) => {
            if (!toText(sender[field]).trim()) {
                nextErrors[`sender.${field}`] = 'Required field.';
            }
        });
        if (!toText(sender.city).trim() && !toText(sender.suburb).trim()) {
            nextErrors['sender.suburb'] = 'Required field.';
        }

        if (toText(sender.mobile).trim()) {
            const senderCountryCode = COUNTRIES.find(c => c.name === sender.country)?.code || 'AU';
            const phoneError = validatePhone(sender.mobile, 'Mobile', senderCountryCode);
            if (phoneError) {
                nextErrors['sender.mobile'] = phoneError;
            }
        }

        const recipientRequired = ['first_name', 'last_name', 'address', 'city', 'province', 'mobile'];

        boxes.forEach((box: any, boxIndex: number) => {
            // Validate per-box recipient
            const boxRecipient = box.recipient || {};
            recipientRequired.forEach((field) => {
                if (!toText(boxRecipient[field]).trim()) {
                    nextErrors[`boxes.${boxIndex}.recipient.${field}`] = 'Required field.';
                }
            });

            if (toText(boxRecipient.mobile).trim()) {
                const phoneError = validatePhone(boxRecipient.mobile, 'Mobile', 'PH');
                if (phoneError) {
                    nextErrors[`boxes.${boxIndex}.recipient.mobile`] = phoneError;
                }
            }

            if (!Array.isArray(box.items) || box.items.length === 0) {
                nextErrors[`boxes.${boxIndex}.items`] = 'Add at least one item for this box.';

                return;
            }

            box.items.forEach((item: any, itemIndex: number) => {
                if (!toText(item.name).trim()) {
                    nextErrors[`boxes.${boxIndex}.items.${itemIndex}.name`] = 'Item name is required.';
                }

                if (!toText(item.description).trim()) {
                    nextErrors[`boxes.${boxIndex}.items.${itemIndex}.description`] = 'Description is required.';
                }

                const qtyStr = toText(item.qty).trim();

                if (qtyStr !== '') {
                    const qty = Number(qtyStr);

                    if (!Number.isFinite(qty) || qty <= 0) {
                        nextErrors[`boxes.${boxIndex}.items.${itemIndex}.qty`] = 'Quantity must be greater than 0.';
                    }
                }
            });
        });

        setLocalErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            toast.error('Please complete all required fields in Step 1.');

            return false;
        }

        return true;
    };

    const validateStep2 = () => {
        const nextErrors: Record<string, string> = {};
        const cert = data.declaration_data.certification;

        if (!cert.no_prohibited) {
            nextErrors['certification.no_prohibited'] = 'Please confirm prohibited items declaration.';
        }

        if (!cert.agree_terms) {
            nextErrors['certification.agree_terms'] = 'Please agree to the terms and conditions.';
        }

        if (!toText(cert.signed_by).trim()) {
            nextErrors['certification.signed_by'] = 'Printed name is required.';
        }

        const activeSignature = signaturePadRef.current && !signaturePadRef.current.isEmpty()
            ? signaturePadRef.current.toDataURL()
            : signatureDraft;

        if (declarationSettings.requireSignature && !activeSignature) {
            nextErrors['certification.signature'] = 'Signature is required before submission.';
        }

        setLocalErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
            toast.error('Please complete all required declarations and signature fields.');

            return null;
        }

        return activeSignature;
    };

    const goToStep2 = () => {
        if (!validateStep1()) {
            return;
        }

        setStep(2);
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();

        if (step === 1) {
            goToStep2();

            return;
        }

        const signature = validateStep2();

        if (!signature) {
            return;
        }

        const nextDeclaration = {
            ...data.declaration_data,
            shipment: {
                ...data.declaration_data.shipment,
                box_count: String(data.declaration_data.boxes.length),
            },
            certification: {
                ...data.declaration_data.certification,
                signature,
                date_signed: data.declaration_data.certification.date_signed || todayIsoDate(),
            },
        };

        setData('declaration_data', nextDeclaration);

        transform((payload) => ({
            ...payload,
            declaration_data: nextDeclaration,
        }));

        post(declarationRoutes.save().url, {
            onError: () => toast.error('Submission failed. Please check your details and try again.'),
            onFinish: () => {
                transform((payload) => payload);
            },
        });
    };

    const sender = data.declaration_data.sender;
    const shipment = data.declaration_data.shipment;
    const certification = data.declaration_data.certification;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={declarationSettings.headerText} />

            <div className="min-h-screen bg-zinc-50">
                <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
                    {/* Guidance Note */}
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
                                <FileText className="size-5" />
                            </div>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wide">{declarationSettings.headerText}</h3>
                                    <p className="text-sm leading-relaxed text-blue-800/80">
                                        {declarationSettings.instructions}
                                    </p>
                                </div>
                                <div className="rounded-lg bg-white/60 px-4 py-3 text-sm text-blue-900 border border-blue-200/50">
                                    <p className="font-semibold mb-1">Notice: Booking details are locked</p>
                                    <p className="text-blue-800/80 mb-3">
                                        To ensure accurate pricing and logistics, your Sender details, Box Quantity, and Recipient destination have been locked to match your original booking.
                                    </p>
                                    {booking.status === 'pending' || booking.status === 'draft' ? (
                                        <p className="text-blue-800/80">
                                            Need to change these details?{' '}
                                            <Link href={`/bookings/${booking.id}/edit`} className="font-semibold text-blue-600 hover:text-blue-800 underline">
                                                Edit your booking here
                                            </Link>
                                        </p>
                                    ) : (
                                        <p className="text-blue-800/80">
                                            Since your booking is already confirmed, please contact our support team if you need to amend these details.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <StepIndicator step={step} />

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {step === 1 ? (
                            <>
                                <section className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-6 md:p-8">
                                    <SectionHeader title="Shipment Details" subtitle="Basic information about this pickup" />

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <Field label="Pickup Date" required error={getError('shipment.pickup_date')}>
                                            <input
                                                type="date"
                                                title="Pickup Date"
                                                className={baseInputClass}
                                                value={shipment.pickup_date}
                                                onChange={(event) => setShipmentField('pickup_date', event.target.value)}
                                            />
                                        </Field>

                                        <Field label="How Many Boxes Picked-Up" required error={getError('shipment.box_count')} hint="Adopted from your booking.">
                                            <input
                                                type="number"
                                                min={1}
                                                title="How Many Boxes Picked-Up"
                                                className={baseInputClass}
                                                value={shipment.box_count}
                                                readOnly
                                                disabled
                                                aria-label="How many boxes picked up"
                                            />
                                        </Field>
                                    </div>
                                </section>

                                <section className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-6 md:p-8">
                                    <SectionHeader title="Sender" subtitle={`Person shipping from ${sender.country || 'Australia'}`} />

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <Field label="First Name" required error={getError('sender.first_name')}>
                                            <input className={baseInputClass} value={sender.first_name} onChange={(event) => setSenderField('first_name', event.target.value)} title="Sender First Name" disabled />
                                        </Field>
                                        <Field label="Last Name" required error={getError('sender.last_name')}>
                                            <input className={baseInputClass} value={sender.last_name} onChange={(event) => setSenderField('last_name', event.target.value)} title="Sender Last Name" disabled />
                                        </Field>
                                    </div>

                                    <Field label="Street Address" required error={getError('sender.address')}>
                                        <input className={baseInputClass} value={sender.address} onChange={(event) => setSenderField('address', event.target.value)} title="Sender Street Address" disabled />
                                    </Field>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                        <Field label="Suburb / City" required error={getError('sender.suburb') || getError('sender.city')}>
                                            <input className={baseInputClass} value={sender.suburb || sender.city || ''} onChange={(event) => setSenderField('suburb', event.target.value)} title="Sender Suburb" disabled />
                                        </Field>
                                        <Field label="State / Province / Region" required error={getError('sender.state')}>
                                            <input className={baseInputClass} value={sender.state} onChange={(event) => setSenderField('state', event.target.value)} title="Sender State" disabled />
                                        </Field>
                                        <Field label="Postcode" error={getError('sender.postcode')}>
                                            <input className={baseInputClass} value={sender.postcode} onChange={(event) => setSenderField('postcode', event.target.value)} title="Sender Postcode" disabled />
                                        </Field>
                                        <Field label="Country" required>
                                            <select
                                                className={baseInputClass}
                                                value={sender.country}
                                                onChange={(event) => setSenderField('country', event.target.value)}
                                                title="Sender Country"
                                                disabled
                                            >
                                                {ALL_COUNTRIES.map((country) => (
                                                    <option key={country} value={country}>
                                                        {country}
                                                    </option>
                                                ))}
                                            </select>
                                        </Field>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <Field label="Mobile" required error={getError('sender.mobile')}>
                                            <PhoneInput value={sender.mobile || ''} onChange={(val) => setSenderField('mobile', val)} defaultCountryCode={COUNTRIES.find(c => c.name === sender.country)?.code || 'AU'} disabled />
                                        </Field>
                                        <Field label="Email" required error={getError('sender.email')}>
                                            <input type="email" className={baseInputClass} value={sender.email} onChange={(event) => setSenderField('email', event.target.value)} title="Sender Email" disabled />
                                        </Field>
                                    </div>
                                </section>

                                <section className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-6 md:p-8">
                                    <SectionHeader title="Boxes — Recipients & Packing List" subtitle="Each box has its own recipient and packing list for customs declaration." />

                                    <div className="space-y-5">
                                        {data.declaration_data.boxes.map((box: any, boxIndex: number) => (
                                            <div key={box.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 md:p-5">
                                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <Package2 className="size-4 text-zinc-600" />
                                                        <p className="text-sm font-semibold text-zinc-900">
                                                            Box {boxIndex + 1}
                                                            {box.tracking_number ? ` - ${box.tracking_number}` : ''}
                                                        </p>
                                                        {box.box_type ? (
                                                            <span className="rounded-md bg-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-700">{box.box_type}</span>
                                                        ) : null}
                                                    </div>

                                                    {/* Box removal disabled to adopt booking data */}
                                                </div>

                                                {/* Per-box Recipient */}
                                                <div className="mb-4 space-y-3 rounded-xl border border-sky-100 bg-sky-50/50 p-4">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700">📍 Recipient (Consignee) for this box</p>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                        <Field label="First Name" required error={getError(`boxes.${boxIndex}.recipient.first_name`)}>
                                                            <input className={baseInputClass} value={box.recipient?.first_name || ''} onChange={(event) => setBoxRecipientField(boxIndex, 'first_name', event.target.value)} title={`Box ${boxIndex + 1} Recipient First Name`} disabled />
                                                        </Field>
                                                        <Field label="Last Name" required error={getError(`boxes.${boxIndex}.recipient.last_name`)}>
                                                            <input className={baseInputClass} value={box.recipient?.last_name || ''} onChange={(event) => setBoxRecipientField(boxIndex, 'last_name', event.target.value)} title={`Box ${boxIndex + 1} Recipient Last Name`} disabled />
                                                        </Field>
                                                    </div>

                                                    <Field label="Street Address" required error={getError(`boxes.${boxIndex}.recipient.address`)}>
                                                        <input className={baseInputClass} value={box.recipient?.address || ''} onChange={(event) => setBoxRecipientField(boxIndex, 'address', event.target.value)} title={`Box ${boxIndex + 1} Recipient Address`} disabled />
                                                    </Field>

                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                                        <Field label="City" required error={getError(`boxes.${boxIndex}.recipient.city`)}>
                                                            <input className={baseInputClass} value={box.recipient?.city || ''} onChange={(event) => setBoxRecipientField(boxIndex, 'city', event.target.value)} title={`Box ${boxIndex + 1} Recipient City`} disabled />
                                                        </Field>
                                                        <Field label="Province" required error={getError(`boxes.${boxIndex}.recipient.province`)}>
                                                            <input className={baseInputClass} value={box.recipient?.province || ''} onChange={(event) => setBoxRecipientField(boxIndex, 'province', event.target.value)} title={`Box ${boxIndex + 1} Recipient Province`} disabled />
                                                        </Field>
                                                        <Field label="Postcode" error={getError(`boxes.${boxIndex}.recipient.postcode`)}>
                                                            <input className={baseInputClass} value={box.recipient?.postcode || ''} onChange={(event) => setBoxRecipientField(boxIndex, 'postcode', event.target.value)} title={`Box ${boxIndex + 1} Recipient Postcode`} disabled />
                                                        </Field>
                                                        <Field label="Country" required>
                                                            <select className={baseInputClass} value={box.recipient?.country || 'Philippines'} disabled title={`Box ${boxIndex + 1} Recipient Country`}>
                                                                <option value="Philippines">Philippines</option>
                                                            </select>
                                                        </Field>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                        <Field label="Mobile" required error={getError(`boxes.${boxIndex}.recipient.mobile`)}>
                                                            <PhoneInput value={box.recipient?.mobile || ''} onChange={(val) => setBoxRecipientField(boxIndex, 'mobile', val)} defaultCountryCode="PH" disabled />
                                                        </Field>
                                                        <Field label="Email or 2nd Mobile" error={getError(`boxes.${boxIndex}.recipient.email`)}>
                                                            <input className={baseInputClass} value={box.recipient?.email || ''} onChange={(event) => setBoxRecipientField(boxIndex, 'email', event.target.value)} title={`Box ${boxIndex + 1} Recipient Email`} disabled />
                                                        </Field>
                                                    </div>
                                                </div>

                                                {/* Packing List */}
                                                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-600">📦 Packing List</p>
                                                <div className="hidden grid-cols-[1fr_1fr_120px_44px] gap-3 px-1 pb-2 md:grid">
                                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Item Name</p>
                                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Description</p>
                                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 text-center">Qty (Optional)</p>
                                                    <p />
                                                </div>

                                                <div className="space-y-3">
                                                    {box.items.map((item: any, itemIndex: number) => (
                                                        <div key={item.id} className="grid grid-cols-1 gap-3 rounded-xl border border-zinc-200 bg-white p-3 md:grid-cols-[1fr_1fr_120px_44px] md:items-start md:border-0 md:bg-transparent md:p-0">
                                                            <div className="flex flex-col">
                                                                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 md:hidden">Item Name</label>
                                                                <input
                                                                    className={baseInputClass}
                                                                    value={item.name}
                                                                    onChange={(event) => updateItemField(boxIndex, itemIndex, 'name', event.target.value)}
                                                                    placeholder="e.g. Shoes"
                                                                    title="Item Name"
                                                                />
                                                                {getError(`boxes.${boxIndex}.items.${itemIndex}.name`) ? (
                                                                    <p className="mt-1 text-xs font-medium text-red-600">{getError(`boxes.${boxIndex}.items.${itemIndex}.name`)}</p>
                                                                ) : null}
                                                            </div>

                                                            <div className="flex flex-col">
                                                                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 md:hidden">Description</label>
                                                                <select
                                                                    className={baseInputClass}
                                                                    title="Item Description"
                                                                    value={item.description !== '' && !PREDEFINED_DESCRIPTIONS.includes(item.description) ? 'Other' : item.description}
                                                                    onChange={(event) => {
                                                                        const val = event.target.value;
                                                                        updateItemField(boxIndex, itemIndex, 'description', val === 'Other' ? ' ' : val);
                                                                    }}
                                                                >
                                                                    <option value="" disabled>Select description...</option>
                                                                    {PREDEFINED_DESCRIPTIONS.map(desc => (
                                                                        <option key={desc} value={desc}>{desc}</option>
                                                                    ))}
                                                                    <option value="Other">Other (Specify)</option>
                                                                </select>
                                                                {item.description !== '' && !PREDEFINED_DESCRIPTIONS.includes(item.description) && (
                                                                    <input
                                                                        className={`${baseInputClass} mt-2`}
                                                                        value={item.description.trim()}
                                                                        onChange={(event) => {
                                                                            const val = event.target.value;
                                                                            updateItemField(boxIndex, itemIndex, 'description', val === '' ? ' ' : val);
                                                                        }}
                                                                        placeholder="Please specify..."
                                                                        autoFocus
                                                                    />
                                                                )}
                                                                {getError(`boxes.${boxIndex}.items.${itemIndex}.description`) ? (
                                                                    <p className="mt-1 text-xs font-medium text-red-600">{getError(`boxes.${boxIndex}.items.${itemIndex}.description`)}</p>
                                                                ) : null}
                                                            </div>

                                                            <div>
                                                                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 md:hidden">Qty (Optional)</label>
                                                                <input
                                                                    type="number"
                                                                    min={1}
                                                                    className={`${baseInputClass} text-center`}
                                                                    value={item.qty}
                                                                    onChange={(event) => updateItemField(boxIndex, itemIndex, 'qty', event.target.value)}
                                                                    aria-label={`Quantity for box ${boxIndex + 1}, item ${itemIndex + 1}`}
                                                                    title="Item quantity"
                                                                    placeholder="Optional"
                                                                />
                                                                {getError(`boxes.${boxIndex}.items.${itemIndex}.qty`) ? (
                                                                    <p className="mt-1 text-xs font-medium text-red-600">{getError(`boxes.${boxIndex}.items.${itemIndex}.qty`)}</p>
                                                                ) : null}
                                                            </div>

                                                            <div className="flex items-end justify-end">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeItem(boxIndex, item.id)}
                                                                    disabled={box.items.length === 1}
                                                                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-300"
                                                                    title="Remove item"
                                                                >
                                                                    <Trash2 className="size-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => addItem(boxIndex)}
                                                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-dashed border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
                                                >
                                                    <Plus className="size-4" /> Add Item
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <p className="text-sm text-zinc-500">
                                        Each box generates its own customs declaration with the recipient and packing list entered above.
                                    </p>

                                    {/* Add Another Box button disabled to adopt booking data */}
                                </section>
                            </>
                        ) : (
                            <>
                                <section className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-6 md:p-8">
                                    <SectionHeader title="Declaration & Certification" />
                                    <p className="text-sm leading-7 text-zinc-600">
                                        I, the undersigned Consignee/Sender, certify that the detailed packing list accurately describes the contents
                                        of the shipment to the Philippines. I confirm there are no undisclosed, restricted, illegal, or banned items,
                                        including firearms, ammunition, illegal drugs, or combustible goods. I authorise my Freight Forwarder/
                                        Consolidator, <strong>BOX TRACKER</strong>, in Arundel, QLD Australia, to clear the shipment through Customs
                                        and handle associated duties, taxes, charges, penalties, and expenses. I acknowledge and agree to all terms and
                                        conditions specified in this document.
                                    </p>
                                </section>

                                {declarationSettings.requireSignature && (
                                    <section className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-6 md:p-8">
                                        <SectionHeader title="Consignor / Sender Signature" />

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <Field label="Printed Name" required error={getError('certification.signed_by')}>
                                                <input
                                                    className={baseInputClass}
                                                    value={certification.signed_by}
                                                    onChange={(event) => setCertificationField('signed_by', event.target.value)}
                                                    title="Printed Name"
                                                />
                                            </Field>

                                            <Field label="Date Signed" required>
                                                <input
                                                    type="date"
                                                    className={baseInputClass}
                                                    value={certification.date_signed}
                                                    onChange={(event) => setCertificationField('date_signed', event.target.value)}
                                                    title="Date Signed"
                                                />
                                            </Field>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Signature</p>
                                                <button
                                                    type="button"
                                                    onClick={clearSignature}
                                                    className="text-xs font-semibold text-zinc-500 underline hover:text-zinc-700"
                                                >
                                                    Clear Signature
                                                </button>
                                            </div>

                                            <canvas
                                                ref={signatureCanvasRef}
                                                className="h-32 w-full rounded-xl border border-zinc-300 bg-white"
                                            />

                                            {getError('certification.signature') ? (
                                                <p className="text-xs font-medium text-red-600">{getError('certification.signature')}</p>
                                            ) : null}
                                        </div>
                                    </section>
                                )}

                                <section className="space-y-5 rounded-3xl border border-amber-300 bg-amber-50 p-6 md:p-8">
                                    <SectionHeader title="For Office Use Only" subtitle="Do not sign. Love Balikbayan Box staff only." />

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <Field label="Date Processed">
                                            <input
                                                type="date"
                                                className={baseInputClass}
                                                value={shipment.office_date}
                                                disabled
                                                onChange={() => {}}
                                                title="Date Processed"
                                            />
                                        </Field>

                                        <div className="space-y-2">
                                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Love Balikbayan Box Authorised Signature</label>
                                            <div className="flex h-12 items-center rounded-xl border border-dashed border-zinc-300 bg-zinc-100 px-4 text-sm text-zinc-500">
                                                For office use only
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-6 md:p-8">
                                    <SectionHeader title="Continuation - Additional Packing Notes" subtitle="Optional: add additional details about this declaration." />

                                    <textarea
                                        className="min-h-30 w-full rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-100"
                                        placeholder="List any additional items or declaration notes..."
                                        value={shipment.continuation_notes}
                                        onChange={(event) => setShipmentField('continuation_notes', event.target.value)}
                                        title="Additional Packing Notes"
                                    />
                                </section>

                                <section className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-6 md:p-8">
                                    <SectionHeader title="Terms & Conditions" />

                                    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                                        <div className="max-h-64 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-300">
                                            <DeclarationTerms variant="screen" className="text-xs leading-relaxed text-zinc-600" />
                                        </div>
                                        <div className="bg-zinc-100/50 px-6 py-2 border-t border-zinc-200">
                                            <p className="text-[10px] text-zinc-500 italic text-center">
                                                Scroll to read the full Terms and Conditions
                                            </p>
                                        </div>
                                    </div>

                                    <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                                        <input
                                            type="checkbox"
                                            className="mt-1 h-4 w-4"
                                            checked={certification.no_prohibited}
                                            onChange={(event) => setCertificationField('no_prohibited', event.target.checked)}
                                        />
                                        <span className="text-sm text-zinc-700">I confirm this shipment has no prohibited, restricted, illegal, or dangerous goods.</span>
                                    </label>
                                    {getError('certification.no_prohibited') ? (
                                        <p className="text-xs font-medium text-red-600">{getError('certification.no_prohibited')}</p>
                                    ) : null}

                                    <label className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                                        <input
                                            type="checkbox"
                                            className="mt-1 h-4 w-4"
                                            checked={certification.agree_terms}
                                            onChange={(event) => setCertificationField('agree_terms', event.target.checked)}
                                        />
                                        <span className="text-sm text-zinc-700">
                                            I agree to all Terms and Conditions, Disclaimer of Warranties, Limitation of Liability, and the Abandoned Goods Policy of Love Balikbayan Box.
                                            I confirm I am of legal age and have read and understood this declaration in full.
                                        </span>
                                    </label>
                                    {getError('certification.agree_terms') ? (
                                        <p className="text-xs font-medium text-red-600">{getError('certification.agree_terms')}</p>
                                    ) : null}
                                </section>
                            </>
                        )}

                        <footer className="flex flex-col-reverse gap-3 rounded-3xl border border-zinc-200 bg-white p-4 md:flex-row md:items-center md:justify-between md:p-6">
                            <p className="text-xs text-zinc-500">
                                Your declaration is securely saved with your booking and used for customs processing.
                            </p>

                            <div className="flex w-full items-center justify-end gap-3 md:w-auto">
                                {step === 2 ? (
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                                    >
                                        <ChevronLeft className="size-4" /> Back
                                    </button>
                                ) : null}

                                {step === 1 ? (
                                    <button
                                        type="button"
                                        onClick={goToStep2}
                                        className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700"
                                    >
                                        Continue to Step 2 <ArrowRight className="size-4" />
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={processing}
                                        className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:bg-zinc-400"
                                    >
                                        {processing ? 'Submitting...' : 'Submit Declaration'} <ShieldCheck className="size-4" />
                                    </button>
                                )}
                            </div>
                        </footer>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}
