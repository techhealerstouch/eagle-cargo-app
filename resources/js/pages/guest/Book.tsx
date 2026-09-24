import { Head, Link, useForm } from '@inertiajs/react';
import {
    Package,
    MapPin,
    Calendar,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    Plus,
    Trash2,
    ShieldCheck,
    Truck,
    Info,
    AlertCircle,
    Loader2,
    Boxes,
    CreditCard,
    DollarSign,
    Clock,
} from 'lucide-react';
import React, { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import PhoneInput from '@/components/ui/PhoneInput';
import { SuburbSelect, type SuburbOption } from '@/components/ui/SuburbSelect';
import MarketingLayout from '@/layouts/marketing-layout';
import { validatePhone } from '@/lib/countries';
import { cn } from '@/lib/utils';

const baseInputClass =
    'h-12 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-brand-rust dark:focus:border-brand-rust focus:outline-none focus:ring-2 focus:ring-brand-rust/20 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 transition-all';

const AU_STATES = [
    { code: 'NSW', name: 'New South Wales' },
    { code: 'VIC', name: 'Victoria' },
    { code: 'QLD', name: 'Queensland' },
    { code: 'WA', name: 'Western Australia' },
    { code: 'SA', name: 'South Australia' },
    { code: 'TAS', name: 'Tasmania' },
    { code: 'ACT', name: 'Australian Capital Territory' },
    { code: 'NT', name: 'Northern Territory' },
];

interface GuestBookProps {
    areas: any[];
    provinces: any[];
    boxTypes: any[];
    boxPrices: any[];
    pickupZones: any[];
    suburbs?: SuburbOption[];
}

function StepIndicator({ currentStep }: { currentStep: number }) {
    const steps = [
        { id: 1, label: 'Sender & Pickup', icon: Truck },
        { id: 2, label: 'Boxes & Recipient', icon: Package },
        { id: 3, label: 'Review & Submit', icon: CheckCircle2 },
    ];

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {steps.map((item) => {
                const isActive = currentStep === item.id;
                const isDone = currentStep > item.id;
                const Icon = item.icon;

                return (
                    <div
                        key={item.id}
                        className={cn(
                            'flex items-center gap-3 rounded-2xl border p-4 transition-all duration-200',
                            isActive
                                ? 'border-brand-rust/40 bg-brand-rust/5 shadow-xs'
                                : isDone
                                  ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800'
                                  : 'border-zinc-200 bg-white'
                        )}
                    >
                        <div
                            className={cn(
                                'flex size-10 items-center justify-center rounded-xl text-sm font-bold transition-all',
                                isDone
                                    ? 'bg-emerald-600 text-white'
                                    : isActive
                                      ? 'bg-brand-rust text-white shadow-sm'
                                      : 'bg-zinc-100 text-zinc-500'
                            )}
                        >
                            {isDone ? <CheckCircle2 className="size-5" /> : <Icon className="size-5" />}
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                Step {item.id} of 3
                            </p>
                            <p
                                className={cn(
                                    'text-sm font-semibold',
                                    isActive
                                        ? 'text-brand-rust'
                                        : isDone
                                          ? 'text-emerald-950'
                                          : 'text-zinc-700'
                                )}
                            >
                                {item.label}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function SectionHeader({
    title,
    subtitle,
    badge,
}: {
    title: string;
    subtitle?: string;
    badge?: string;
}) {
    return (
        <div className="space-y-1 border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-zinc-900">{title}</h3>
                {badge && (
                    <span className="rounded-full bg-brand-rust/10 px-2 py-0.5 text-[10px] font-bold text-brand-rust">
                        {badge}
                    </span>
                )}
            </div>
            {subtitle ? <p className="text-xs text-zinc-500">{subtitle}</p> : null}
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
        <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                {label}
                {required ? <span className="ml-1 text-red-500">*</span> : null}
            </label>
            {children}
            {hint ? <p className="text-xs text-zinc-400">{hint}</p> : null}
            {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
        </div>
    );
}

export default function GuestBook({
    areas = [],
    provinces = [],
    boxTypes = [],
    boxPrices = [],
    pickupZones = [],
    suburbs = [],
}: GuestBookProps) {
    const [currentStep, setCurrentStep] = useState(1);

    // Initial min pickup date (2 days ahead)
    const minPickupDate = useMemo(() => {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        return d.toISOString().split('T')[0];
    }, []);

    const defaultPickupDate = minPickupDate;

    const { data, setData, post, processing, errors, setError, clearErrors } = useForm({
        website: '', // honeypot
        first_name: '',
        last_name: '',
        email: '',
        mobile: '',
        secondary_mobile: '',
        address: '',
        suburb: '',
        state: 'NSW',
        postcode: '',
        pickup_zone_id: '',
        booking_type: 'home_pickup',
        preferred_date: defaultPickupDate,
        payment_method: 'cash_on_pickup',
        notes: '',
        boxes: [
            {
                recipient_first_name: '',
                recipient_last_name: '',
                recipient_email: '',
                recipient_phone: '',
                recipient_secondary_phone: '',
                recipient_address: '',
                recipient_city: '',
                recipient_province: '',
                recipient_zip_code: '',
                recipient_landmarks: '',
                area_id: '',
                box_type_id: boxTypes[0]?.id ? String(boxTypes[0].id) : '',
                is_custom_size: false,
                custom_length: '',
                custom_width: '',
                custom_height: '',
            },
        ],
    });

    // Suburb to pickup zone auto-detect
    const detectPickupZoneBySuburb = useCallback(
        (suburbStr: string) => {
            if (!suburbStr || !pickupZones.length) return '';
            const searchStr = suburbStr.toLowerCase().trim();
            for (const zone of pickupZones) {
                if (zone.suburbs && Array.isArray(zone.suburbs)) {
                    if (
                        zone.suburbs.some((s: any) => {
                            const name = typeof s === 'string' ? s : s.name || '';
                            return name.toLowerCase().trim() === searchStr;
                        })
                    ) {
                        return zone.id.toString();
                    }
                }
            }
            return '';
        },
        [pickupZones]
    );

    // Auto update pickup zone & postcode when suburb changes
    const handleSuburbChange = (val: string, postcode?: string, suburbObj?: SuburbOption) => {
        const foundSuburb = suburbObj || suburbs?.find(
            (s) => s.name.toLowerCase().trim() === val.toLowerCase().trim()
        );

        const detectedZone = foundSuburb?.pickup_zone_id
            ? String(foundSuburb.pickup_zone_id)
            : detectPickupZoneBySuburb(val);

        setData((prev) => ({
            ...prev,
            suburb: val,
            postcode: postcode || foundSuburb?.postcode || prev.postcode,
            pickup_zone_id: detectedZone || prev.pickup_zone_id,
        }));
    };

    // Destination Area resolver from province/city
    const resolveDestinationAreaId = useCallback(
        (provinceName?: string, cityName?: string) => {
            const normalize = (value?: string) => String(value ?? '').trim().toLowerCase();

            if (normalize(cityName) === 'davao city') {
                const davaoArea = areas.find((area: any) => normalize(area.name) === 'davao city');
                if (davaoArea?.id) return String(davaoArea.id);
            }

            const province = provinces.find(
                (item: any) => normalize(item.name) === normalize(provinceName)
            );
            return province?.area_id ? String(province.area_id) : '';
        },
        [areas, provinces]
    );

    // Update shared recipient across all boxes
    const updatePrimaryRecipient = (field: string, value: any) => {
        const updatedBoxes = data.boxes.map((box) => {
            const updated = { ...box, [field]: value };
            if (field === 'recipient_province' || field === 'recipient_city') {
                const derivedAreaId = resolveDestinationAreaId(
                    field === 'recipient_province' ? value : box.recipient_province,
                    field === 'recipient_city' ? value : box.recipient_city
                );
                if (derivedAreaId) {
                    updated.area_id = derivedAreaId;
                }
            }
            return updated;
        });
        setData('boxes', updatedBoxes);
    };

    // Update single box details
    const updateBox = (index: number, field: string, value: any) => {
        const updated = [...data.boxes];
        updated[index] = { ...updated[index], [field]: value };
        setData('boxes', updated);
    };

    // Add another box (clones recipient from master)
    const addBox = () => {
        const master = data.boxes[0] || {};
        setData('boxes', [
            ...data.boxes,
            {
                ...master,
                box_type_id: boxTypes[0]?.id ? String(boxTypes[0].id) : '',
                is_custom_size: false,
                custom_length: '',
                custom_width: '',
                custom_height: '',
            },
        ]);
    };

    // Remove box
    const removeBox = (index: number) => {
        if (data.boxes.length <= 1) return;
        setData('boxes', data.boxes.filter((_, i) => i !== index));
    };

    // Price calculation
    const getCbmRate = (areaId: string | number) => {
        const customCbmType = boxTypes.find(
            (bt: any) =>
                bt.name?.toLowerCase().includes('cbm') || bt.name?.toLowerCase() === 'custom box'
        );
        let rate = 0;
        if (customCbmType && data.pickup_zone_id) {
            const exactPriceRecord = boxPrices.find(
                (p: any) =>
                    p.area_id?.toString() === areaId?.toString() &&
                    p.box_type_id?.toString() === customCbmType.id.toString() &&
                    p.pickup_zone_id?.toString() === data.pickup_zone_id?.toString()
            );
            if (exactPriceRecord) {
                rate = parseFloat(exactPriceRecord.price);
            }
        }
        return rate;
    };

    const getBoxPrice = (box: any) => {
        if (box.is_custom_size) {
            const l = parseFloat(box.custom_length || '0');
            const w = parseFloat(box.custom_width || '0');
            const h = parseFloat(box.custom_height || '0');
            if (!box.area_id || l <= 0 || w <= 0 || h <= 0) return 0;
            const cbmRate = getCbmRate(box.area_id);
            if (!cbmRate) return 0;
            const cbm = (l * w * h) / 1_000_000;
            return Math.round(cbm * cbmRate * 100) / 100;
        }

        if (!box.area_id || !box.box_type_id) return 0;

        const exactPriceRecord = boxPrices.find(
            (p: any) =>
                p.area_id?.toString() === box.area_id?.toString() &&
                p.box_type_id?.toString() === box.box_type_id?.toString() &&
                p.pickup_zone_id?.toString() === data.pickup_zone_id?.toString()
        );

        const fallbackPriceRecord = boxPrices.find(
            (p: any) =>
                p.area_id?.toString() === box.area_id?.toString() &&
                p.box_type_id?.toString() === box.box_type_id?.toString() &&
                !p.pickup_zone_id
        );

        const priceRecord = exactPriceRecord || fallbackPriceRecord;
        return priceRecord ? parseFloat(priceRecord.price) : 0;
    };

    const totalEstimate = useMemo(() => {
        return data.boxes.reduce((acc, box) => acc + getBoxPrice(box), 0);
    }, [data.boxes, data.pickup_zone_id, boxPrices]);

    // Validation
    const validateStep = (step: number) => {
        clearErrors();
        let hasErrors = false;

        if (step === 1) {
            const required: Record<string, string> = {
                first_name: 'First Name',
                last_name: 'Last Name',
                email: 'Email Address',
                mobile: 'Contact Phone',
                address: 'Pickup Address',
                suburb: 'Suburb',
                state: 'State',
                postcode: 'Postcode',
                preferred_date: 'Pickup Date',
            };

            Object.entries(required).forEach(([field, label]) => {
                if (!data[field as keyof typeof data]) {
                    setError(field as any, `${label} is required`);
                    hasErrors = true;
                }
            });

            if (data.mobile) {
                const phoneError = validatePhone(data.mobile, 'Contact Phone', 'AU');
                if (phoneError) {
                    setError('mobile', phoneError);
                    hasErrors = true;
                }
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (data.email && !emailRegex.test(data.email)) {
                setError('email', 'Please enter a valid email address');
                hasErrors = true;
            }

            if (data.preferred_date) {
                const selected = new Date(data.preferred_date);
                const minDate = new Date(minPickupDate);
                if (selected < minDate) {
                    setError('preferred_date', 'Pickup date requires at least 2 days lead time');
                    hasErrors = true;
                }
            }
        }

        if (step === 2) {
            const primary = data.boxes[0];
            if (primary) {
                const recRequired: Record<string, string> = {
                    recipient_first_name: 'Receiver First Name',
                    recipient_last_name: 'Receiver Last Name',
                    recipient_address: 'Receiver Address / Barangay',
                    recipient_city: 'City / Municipality',
                    recipient_province: 'Province',
                    recipient_zip_code: 'Zip Code',
                    recipient_phone: 'Receiver Phone Number',
                };

                Object.entries(recRequired).forEach(([field, label]) => {
                    if (!primary[field as keyof typeof primary]) {
                        setError(`boxes.0.${field}` as any, `${label} is required`);
                        hasErrors = true;
                    }
                });

                if (primary.recipient_phone) {
                    const phoneError = validatePhone(primary.recipient_phone, 'Receiver Phone', 'PH');
                    if (phoneError) {
                        setError('boxes.0.recipient_phone' as any, phoneError);
                        hasErrors = true;
                    }
                }

                if (primary.recipient_email) {
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(primary.recipient_email)) {
                        setError('boxes.0.recipient_email' as any, 'Please enter a valid email address');
                        hasErrors = true;
                    }
                }
            }

            data.boxes.forEach((box, i) => {
                if (!box.area_id) {
                    setError(`boxes.${i}.area_id` as any, 'Destination Area is required');
                    hasErrors = true;
                }

                if (!box.is_custom_size && !box.box_type_id) {
                    setError(`boxes.${i}.box_type_id` as any, 'Box Type is required');
                    hasErrors = true;
                }

                if (box.is_custom_size) {
                    ['custom_length', 'custom_width', 'custom_height'].forEach((dim) => {
                        const val = parseFloat((box as any)[dim] || '0');
                        if (!val || val <= 0) {
                            setError(
                                `boxes.${i}.${dim}` as any,
                                `${dim.replace('custom_', '')} must be greater than 0`
                            );
                            hasErrors = true;
                        }
                    });
                }
            });
        }

        if (hasErrors) {
            toast.error('Please fill in all required fields highlighted in red.');
            return false;
        }

        return true;
    };

    const handleNext = () => {
        if (!validateStep(currentStep)) return;
        setCurrentStep((s) => Math.min(s + 1, 3));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleBack = () => {
        setCurrentStep((s) => Math.max(s - 1, 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateStep(1) || !validateStep(2)) return;

        post('/guest/bookings', {
            onError: (errs) => {
                const firstMsg = Object.values(errs)[0];
                toast.error(typeof firstMsg === 'string' ? firstMsg : 'Submission failed. Please check form errors.');
            },
        });
    };

    const primaryRecipient = data.boxes[0] || {};
    const selectedArea = areas.find((a: any) => String(a.id) === String(primaryRecipient.area_id));
    const selectedZone = pickupZones.find((z: any) => String(z.id) === String(data.pickup_zone_id));

    return (
        <MarketingLayout>
            <Head title="Book a Balikbayan Box Pickup (Guest) | Eagle Cargo" />

            <div className="container mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
                {/* Header Banner */}
                <div className="mb-8 flex flex-col items-start justify-between gap-4 border-b border-zinc-100 pb-6 md:flex-row md:items-center">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="rounded-full bg-brand-rust/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-rust">
                                Guest Checkout
                            </span>

                        </div>
                        <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-900 md:text-3xl">
                            Book a Balikbayan Box Pickup
                        </h1>
                        <p className="mt-1 text-sm text-zinc-500">
                            Fill in your pickup and cargo details below. You'll receive a tracking reference immediately upon submission.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-3 text-right shadow-xs">
                        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                            Already registered?
                        </p>
                        <Link
                            href="/login"
                            className="mt-0.5 inline-flex items-center gap-1 text-xs font-bold text-brand-rust hover:underline"
                        >
                            Log in to access saved addresses &rarr;
                        </Link>
                    </div>
                </div>

                {/* Stepper */}
                <div className="mb-8">
                    <StepIndicator currentStep={currentStep} />
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Honeypot field (hidden from real users) */}
                    <input
                        type="text"
                        name="website"
                        value={data.website}
                        onChange={(e) => setData('website', e.target.value)}
                        className="hidden"
                        tabIndex={-1}
                        autoComplete="off"
                    />

                    {/* ================= STEP 1: SENDER & PICKUP ================= */}
                    {currentStep === 1 && (
                        <div className="space-y-8">
                            {/* Sender Info */}
                            <section className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs md:p-8">
                                <SectionHeader
                                    title="Sender Information"
                                    subtitle="Personal and contact details"

                                />

                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                    <Field label="First Name" required error={errors.first_name}>
                                        <input
                                            type="text"
                                            placeholder="e.g. Juan"
                                            className={baseInputClass}
                                            value={data.first_name}
                                            onChange={(e) => setData('first_name', e.target.value)}
                                        />
                                    </Field>

                                    <Field label="Last Name" required error={errors.last_name}>
                                        <input
                                            type="text"
                                            placeholder="e.g. Dela Cruz"
                                            className={baseInputClass}
                                            value={data.last_name}
                                            onChange={(e) => setData('last_name', e.target.value)}
                                        />
                                    </Field>

                                    <Field label="Email Address" required error={errors.email} hint="We will send your booking reference & receipt here">
                                        <input
                                            type="email"
                                            placeholder="juan@example.com"
                                            className={baseInputClass}
                                            value={data.email}
                                            onChange={(e) => setData('email', e.target.value)}
                                        />
                                    </Field>

                                    <Field label="Mobile Phone" required error={errors.mobile}>
                                        <PhoneInput
                                            value={data.mobile}
                                            onChange={(val) => setData('mobile', val)}
                                            defaultCountryCode="AU"
                                        />
                                    </Field>

                                    <Field label="Alternative Phone" error={errors.secondary_mobile} hint="Optional backup number">
                                        <PhoneInput
                                            value={data.secondary_mobile}
                                            onChange={(val) => setData('secondary_mobile', val)}
                                            defaultCountryCode="AU"
                                        />
                                    </Field>
                                </div>
                            </section>

                            {/* Pickup Address & Schedule */}
                            <section className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs md:p-8">
                                <SectionHeader
                                    title="Pickup Location & Schedule"
                                    subtitle="Where and when our driver should collect your boxes"
                                />

                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                    <div className="md:col-span-2">
                                        <Field label="Street Address" required error={errors.address} hint="Unit, street number and street name">
                                            <input
                                                type="text"
                                                placeholder="e.g. 42 Wallaby Way"
                                                className={baseInputClass}
                                                value={data.address}
                                                onChange={(e) => setData('address', e.target.value)}
                                            />
                                        </Field>
                                    </div>

                                    <Field
                                        label="Suburb"
                                        required
                                        error={errors.suburb}
                                        hint="Select from registered suburbs or type to search"
                                    >
                                        <SuburbSelect
                                            id="suburb"
                                            name="suburb"
                                            value={data.suburb}
                                            suburbs={suburbs}
                                            placeholder="e.g. Blacktown"
                                            className={baseInputClass}
                                            onChange={(selectedName, postcode, suburbObj) =>
                                                handleSuburbChange(selectedName, postcode, suburbObj)
                                            }
                                        />
                                    </Field>

                                    <Field label="State" required error={errors.state}>
                                        <select
                                            className={baseInputClass}
                                            value={data.state}
                                            onChange={(e) => setData('state', e.target.value)}
                                        >
                                            {AU_STATES.map((st) => (
                                                <option key={st.code} value={st.code}>
                                                    {st.name} ({st.code})
                                                </option>
                                            ))}
                                        </select>
                                    </Field>

                                    <Field label="Postcode" required error={errors.postcode}>
                                        <input
                                            type="text"
                                            placeholder="e.g. 2148"
                                            maxLength={4}
                                            className={baseInputClass}
                                            value={data.postcode}
                                            onChange={(e) => setData('postcode', e.target.value)}
                                        />
                                    </Field>

                                    <Field
                                        label="Pickup Area / Zone"
                                        error={errors.pickup_zone_id}
                                        hint={
                                            data.pickup_zone_id
                                                ? 'Zone detected from your suburb'
                                                : 'Select your nearest zone if not auto-detected'
                                        }
                                    >
                                        <select
                                            className={baseInputClass}
                                            value={data.pickup_zone_id}
                                            onChange={(e) => setData('pickup_zone_id', e.target.value)}
                                        >
                                            <option value="">Select pickup zone...</option>
                                            {pickupZones.map((zone) => (
                                                <option key={zone.id} value={String(zone.id)}>
                                                    {zone.name}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>

                                    <Field
                                        label="Preferred Pickup Date"
                                        required
                                        error={errors.preferred_date}
                                        hint="At least 2 days in advance required for scheduling"
                                    >
                                        <input
                                            type="date"
                                            min={minPickupDate}
                                            className={baseInputClass}
                                            value={data.preferred_date}
                                            onChange={(e) => setData('preferred_date', e.target.value)}
                                        />
                                    </Field>

                                    <div className="md:col-span-2">
                                        <Field label="Special Pickup Instructions" error={errors.notes} hint="Optional: Gate codes, dogs on property, landmarks">
                                            <textarea
                                                rows={3}
                                                placeholder="e.g. Gate code is #1234. Boxes are ready on the porch."
                                                className="w-full rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-brand-rust focus:outline-none focus:ring-2 focus:ring-brand-rust/20"
                                                value={data.notes}
                                                onChange={(e) => setData('notes', e.target.value)}
                                            />
                                        </Field>
                                    </div>
                                </div>
                            </section>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="inline-flex items-center gap-2 rounded-xl bg-brand-rust px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-rust/90 active:scale-98"
                                >
                                    Next: Boxes & Recipient
                                    <ArrowRight className="size-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ================= STEP 2: BOXES & RECIPIENT ================= */}
                    {currentStep === 2 && (
                        <div className="space-y-8">
                            {/* Recipient in Philippines */}
                            <section className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs md:p-8">
                                <SectionHeader
                                    title="Recipient Details"
                                    subtitle="The person receiving the cargo in the Philippines"
                                    badge="Philippines"
                                />

                                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                                    <Field
                                        label="Receiver First Name"
                                        required
                                        error={errors['boxes.0.recipient_first_name' as any]}
                                    >
                                        <input
                                            type="text"
                                            placeholder="e.g. Maria"
                                            className={baseInputClass}
                                            value={primaryRecipient.recipient_first_name || ''}
                                            onChange={(e) =>
                                                updatePrimaryRecipient('recipient_first_name', e.target.value)
                                            }
                                        />
                                    </Field>

                                    <Field
                                        label="Receiver Last Name"
                                        required
                                        error={errors['boxes.0.recipient_last_name' as any]}
                                    >
                                        <input
                                            type="text"
                                            placeholder="e.g. Santos"
                                            className={baseInputClass}
                                            value={primaryRecipient.recipient_last_name || ''}
                                            onChange={(e) =>
                                                updatePrimaryRecipient('recipient_last_name', e.target.value)
                                            }
                                        />
                                    </Field>

                                    <Field
                                        label="Receiver Mobile Phone"
                                        required
                                        error={errors['boxes.0.recipient_phone' as any]}
                                        hint="Philippine mobile (+63 or 09...)"
                                    >
                                        <PhoneInput
                                            value={primaryRecipient.recipient_phone || ''}
                                            onChange={(val) =>
                                                updatePrimaryRecipient('recipient_phone', val)
                                            }
                                            defaultCountryCode="PH"
                                        />
                                    </Field>

                                    <Field
                                        label="Alternative Receiver Phone"
                                        error={errors['boxes.0.recipient_secondary_phone' as any]}
                                        hint="Optional backup phone"
                                    >
                                        <PhoneInput
                                            value={primaryRecipient.recipient_secondary_phone || ''}
                                            onChange={(val) =>
                                                updatePrimaryRecipient('recipient_secondary_phone', val)
                                            }
                                            defaultCountryCode="PH"
                                        />
                                    </Field>

                                    <Field
                                        label="Receiver Email Address"
                                        error={errors['boxes.0.recipient_email' as any]}
                                        hint="Optional: Receives delivery notification"
                                    >
                                        <input
                                            type="email"
                                            placeholder="maria@example.com"
                                            className={baseInputClass}
                                            value={primaryRecipient.recipient_email || ''}
                                            onChange={(e) =>
                                                updatePrimaryRecipient('recipient_email', e.target.value)
                                            }
                                        />
                                    </Field>

                                    <Field
                                        label="Province"
                                        required
                                        error={errors['boxes.0.recipient_province' as any]}
                                    >
                                        <select
                                            className={baseInputClass}
                                            value={primaryRecipient.recipient_province || ''}
                                            onChange={(e) =>
                                                updatePrimaryRecipient('recipient_province', e.target.value)
                                            }
                                        >
                                            <option value="">Select province...</option>
                                            {provinces.map((prov) => (
                                                <option key={prov.id} value={prov.name}>
                                                    {prov.name}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>

                                    <Field
                                        label="City / Municipality"
                                        required
                                        error={errors['boxes.0.recipient_city' as any]}
                                    >
                                        <input
                                            type="text"
                                            placeholder="e.g. San Fernando"
                                            className={baseInputClass}
                                            value={primaryRecipient.recipient_city || ''}
                                            onChange={(e) =>
                                                updatePrimaryRecipient('recipient_city', e.target.value)
                                            }
                                        />
                                    </Field>

                                    <Field
                                        label="Postal / Zip Code"
                                        required
                                        error={errors['boxes.0.recipient_zip_code' as any]}
                                    >
                                        <input
                                            type="text"
                                            placeholder="e.g. 2000"
                                            maxLength={6}
                                            className={baseInputClass}
                                            value={primaryRecipient.recipient_zip_code || ''}
                                            onChange={(e) =>
                                                updatePrimaryRecipient('recipient_zip_code', e.target.value)
                                            }
                                        />
                                    </Field>

                                    <div className="md:col-span-2">
                                        <Field
                                            label="House No., Street & Barangay"
                                            required
                                            error={errors['boxes.0.recipient_address' as any]}
                                            hint="Complete address including Barangay is required for Philippine deliveries"
                                        >
                                            <input
                                                type="text"
                                                placeholder="e.g. Block 12 Lot 5, Sampaguita St., Brgy. Dolores"
                                                className={baseInputClass}
                                                value={primaryRecipient.recipient_address || ''}
                                                onChange={(e) =>
                                                    updatePrimaryRecipient('recipient_address', e.target.value)
                                                }
                                            />
                                        </Field>
                                    </div>

                                    <div className="md:col-span-2">
                                        <Field
                                            label="Landmarks & Delivery Notes"
                                            error={errors['boxes.0.recipient_landmarks' as any]}
                                            hint="Optional: Near barangay hall, opposite church, etc."
                                        >
                                            <input
                                                type="text"
                                                placeholder="e.g. Yellow gate beside sari-sari store"
                                                className={baseInputClass}
                                                value={primaryRecipient.recipient_landmarks || ''}
                                                onChange={(e) =>
                                                    updatePrimaryRecipient('recipient_landmarks', e.target.value)
                                                }
                                            />
                                        </Field>
                                    </div>
                                </div>
                            </section>

                            {/* Boxes Selection */}
                            <section className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs md:p-8">
                                <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                                    <SectionHeader
                                        title="Cargo & Boxes"
                                        subtitle="Specify box types or custom dimensions"
                                    />
                                    <button
                                        type="button"
                                        onClick={addBox}
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-brand-rust/20 bg-brand-rust/5 px-3.5 py-2 text-xs font-bold text-brand-rust transition-all hover:bg-brand-rust/10"
                                    >
                                        <Plus className="size-4" />
                                        Add Another Box
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {data.boxes.map((box, index) => {
                                        const price = getBoxPrice(box);
                                        const isCustom = box.is_custom_size;

                                        return (
                                            <div
                                                key={index}
                                                className="relative space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 transition-all md:p-6"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex size-7 items-center justify-center rounded-lg bg-zinc-200 text-xs font-bold text-zinc-700">
                                                            #{index + 1}
                                                        </span>
                                                        <h4 className="text-sm font-bold text-zinc-900">
                                                            Box {index + 1} Details
                                                        </h4>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <span className="text-xs font-semibold text-zinc-400">
                                                                Estimated:{' '}
                                                            </span>
                                                            <span className="text-sm font-black text-brand-rust">
                                                                {price > 0 ? `$${price.toFixed(2)} AUD` : '—'}
                                                            </span>
                                                        </div>

                                                        {data.boxes.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeBox(index)}
                                                                className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                                                title="Remove box"
                                                            >
                                                                <Trash2 className="size-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                    {!isCustom ? (
                                                        <Field
                                                            label="Standard Box Type"
                                                            required
                                                            error={errors[`boxes.${index}.box_type_id` as any]}
                                                        >
                                                            <select
                                                                className={baseInputClass}
                                                                value={box.box_type_id}
                                                                onChange={(e) =>
                                                                    updateBox(index, 'box_type_id', e.target.value)
                                                                }
                                                            >
                                                                <option value="">Select box size...</option>
                                                                {boxTypes.map((type) => (
                                                                    <option key={type.id} value={String(type.id)}>
                                                                        {type.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </Field>
                                                    ) : (
                                                        <div className="space-y-1.5 md:col-span-2">
                                                            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                                                                Custom Dimensions (Centimeters) *
                                                            </label>
                                                            <div className="grid grid-cols-3 gap-3">
                                                                <div>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="Length (cm)"
                                                                        className={baseInputClass}
                                                                        value={box.custom_length}
                                                                        onChange={(e) =>
                                                                            updateBox(index, 'custom_length', e.target.value)
                                                                        }
                                                                    />
                                                                    {errors[`boxes.${index}.custom_length` as any] && (
                                                                        <p className="mt-1 text-xs text-red-600">
                                                                            Required
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="Width (cm)"
                                                                        className={baseInputClass}
                                                                        value={box.custom_width}
                                                                        onChange={(e) =>
                                                                            updateBox(index, 'custom_width', e.target.value)
                                                                        }
                                                                    />
                                                                    {errors[`boxes.${index}.custom_width` as any] && (
                                                                        <p className="mt-1 text-xs text-red-600">
                                                                            Required
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <input
                                                                        type="number"
                                                                        placeholder="Height (cm)"
                                                                        className={baseInputClass}
                                                                        value={box.custom_height}
                                                                        onChange={(e) =>
                                                                            updateBox(index, 'custom_height', e.target.value)
                                                                        }
                                                                    />
                                                                    {errors[`boxes.${index}.custom_height` as any] && (
                                                                        <p className="mt-1 text-xs text-red-600">
                                                                            Required
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <Field
                                                        label="Destination Pricing Region"
                                                        required
                                                        error={errors[`boxes.${index}.area_id` as any]}
                                                        hint="Auto-resolved from recipient province"
                                                    >
                                                        <select
                                                            className={baseInputClass}
                                                            value={box.area_id}
                                                            onChange={(e) =>
                                                                updateBox(index, 'area_id', e.target.value)
                                                            }
                                                        >
                                                            <option value="">Select destination area...</option>
                                                            {areas.map((area) => (
                                                                <option key={area.id} value={String(area.id)}>
                                                                    {area.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </Field>
                                                </div>

                                                {/* Toggle Custom Size */}
                                                <div className="flex items-center gap-2 pt-1">
                                                    <input
                                                        type="checkbox"
                                                        id={`custom_size_${index}`}
                                                        checked={box.is_custom_size}
                                                        onChange={(e) =>
                                                            updateBox(index, 'is_custom_size', e.target.checked)
                                                        }
                                                        className="size-4 rounded border-zinc-300 text-brand-rust focus:ring-brand-rust/20"
                                                    />
                                                    <label
                                                        htmlFor={`custom_size_${index}`}
                                                        className="text-xs font-semibold text-zinc-600 cursor-pointer"
                                                    >
                                                        Use non-standard custom dimensions (CBM pricing)
                                                    </label>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            <div className="flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50"
                                >
                                    <ArrowLeft className="size-4" />
                                    Back to Sender Details
                                </button>

                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="inline-flex items-center gap-2 rounded-xl bg-brand-rust px-6 py-3.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-brand-rust/90 active:scale-98"
                                >
                                    Next: Review & Payment
                                    <ArrowRight className="size-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ================= STEP 3: REVIEW & SUBMIT ================= */}
                    {currentStep === 3 && (
                        <div className="space-y-8">
                            {/* Summary Grid */}
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                                {/* Pickup & Sender Card */}
                                <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs">
                                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                                        <div className="flex items-center gap-2">
                                            <Truck className="size-4 text-brand-rust" />
                                            <h4 className="text-sm font-bold text-zinc-900">
                                                Pickup & Sender
                                            </h4>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(1)}
                                            className="text-xs font-bold text-brand-rust hover:underline"
                                        >
                                            Edit
                                        </button>
                                    </div>

                                    <div className="space-y-2 text-xs text-zinc-600">
                                        <p>
                                            <span className="font-bold text-zinc-900">Sender:</span>{' '}
                                            {data.first_name} {data.last_name}
                                        </p>
                                        <p>
                                            <span className="font-bold text-zinc-900">Phone:</span> {data.mobile}
                                        </p>
                                        <p>
                                            <span className="font-bold text-zinc-900">Email:</span> {data.email}
                                        </p>
                                        <p>
                                            <span className="font-bold text-zinc-900">Address:</span>{' '}
                                            {data.address}, {data.suburb} {data.state} {data.postcode}
                                        </p>
                                        <p>
                                            <span className="font-bold text-zinc-900">Pickup Date:</span>{' '}
                                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800">
                                                {data.preferred_date}
                                            </span>
                                        </p>
                                        {selectedZone && (
                                            <p>
                                                <span className="font-bold text-zinc-900">Zone:</span>{' '}
                                                {selectedZone.name}
                                            </p>
                                        )}
                                        {data.notes && (
                                            <p className="mt-2 rounded-xl bg-zinc-50 p-2 italic">
                                                "{data.notes}"
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Delivery & Recipient Card */}
                                <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs">
                                    <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                                        <div className="flex items-center gap-2">
                                            <MapPin className="size-4 text-emerald-600" />
                                            <h4 className="text-sm font-bold text-zinc-900">
                                                Destination & Receiver
                                            </h4>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(2)}
                                            className="text-xs font-bold text-brand-rust hover:underline"
                                        >
                                            Edit
                                        </button>
                                    </div>

                                    <div className="space-y-2 text-xs text-zinc-600">
                                        <p>
                                            <span className="font-bold text-zinc-900">Receiver:</span>{' '}
                                            {primaryRecipient.recipient_first_name}{' '}
                                            {primaryRecipient.recipient_last_name}
                                        </p>
                                        <p>
                                            <span className="font-bold text-zinc-900">Phone:</span>{' '}
                                            {primaryRecipient.recipient_phone}
                                        </p>
                                        {primaryRecipient.recipient_email && (
                                            <p>
                                                <span className="font-bold text-zinc-900">Email:</span>{' '}
                                                {primaryRecipient.recipient_email}
                                            </p>
                                        )}
                                        <p>
                                            <span className="font-bold text-zinc-900">Address:</span>{' '}
                                            {primaryRecipient.recipient_address}
                                        </p>
                                        <p>
                                            <span className="font-bold text-zinc-900">City/Province:</span>{' '}
                                            {primaryRecipient.recipient_city},{' '}
                                            {primaryRecipient.recipient_province}{' '}
                                            {primaryRecipient.recipient_zip_code}
                                        </p>
                                        {selectedArea && (
                                            <p>
                                                <span className="font-bold text-zinc-900">Delivery Region:</span>{' '}
                                                <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-bold text-zinc-800">
                                                    {selectedArea.name}
                                                </span>
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Cargo Items Summary */}
                            <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs md:p-8">
                                <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                                    <div className="flex items-center gap-2">
                                        <Boxes className="size-4 text-brand-rust" />
                                        <h4 className="text-sm font-bold text-zinc-900">
                                            Boxes to Pickup ({data.boxes.length})
                                        </h4>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(2)}
                                        className="text-xs font-bold text-brand-rust hover:underline"
                                    >
                                        Modify Boxes
                                    </button>
                                </div>

                                <div className="divide-y divide-zinc-100">
                                    {data.boxes.map((box, i) => {
                                        const type = boxTypes.find((t) => String(t.id) === String(box.box_type_id));
                                        const price = getBoxPrice(box);

                                        return (
                                            <div key={i} className="flex items-center justify-between py-3 text-xs">
                                                <div>
                                                    <p className="font-bold text-zinc-900">
                                                        Box #{i + 1}:{' '}
                                                        {box.is_custom_size
                                                            ? `Custom (${box.custom_length} × ${box.custom_width} × ${box.custom_height} cm)`
                                                            : type?.name || 'Standard Box'}
                                                    </p>
                                                    <p className="text-zinc-500">
                                                        Deliver to: {primaryRecipient.recipient_first_name}{' '}
                                                        {primaryRecipient.recipient_last_name} (
                                                        {primaryRecipient.recipient_city})
                                                    </p>
                                                </div>

                                                <p className="text-sm font-bold text-zinc-900">
                                                    {price > 0 ? `$${price.toFixed(2)} AUD` : 'To be confirmed'}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="border-t border-zinc-200 pt-4">
                                    <div className="flex items-center justify-between text-base font-black text-zinc-900">
                                        <span>Estimated Total</span>
                                        <span className="text-xl text-brand-rust">
                                            {totalEstimate > 0 ? `$${totalEstimate.toFixed(2)} AUD` : 'To be confirmed'}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-right text-[11px] text-zinc-400">
                                        Final rate confirmed upon pickup & dimension check
                                    </p>
                                </div>
                            </section>

                            {/* Payment Method Selector */}
                            <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs md:p-8">
                                <SectionHeader
                                    title="Choose Payment Method"
                                    subtitle="Select how you prefer to settle this shipment"
                                />

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                    {[
                                        {
                                            id: 'cash_on_pickup',
                                            title: 'Cash on Pickup',
                                            desc: 'Pay our driver directly in cash when they collect your box',
                                            icon: DollarSign,
                                        },
                                        {
                                            id: 'bank_transfer',
                                            title: 'Bank Transfer',
                                            desc: 'Direct deposit into our Australian account (details sent via email)',
                                            icon: CreditCard,
                                        },
                                        {
                                            id: 'pay_id',
                                            title: 'PayID',
                                            desc: 'Instant mobile transfer using our registered Australian PayID',
                                            icon: Clock,
                                        },
                                    ].map((opt) => {
                                        const isSelected = data.payment_method === opt.id;
                                        const Icon = opt.icon;

                                        return (
                                            <div
                                                key={opt.id}
                                                onClick={() => setData('payment_method', opt.id)}
                                                className={cn(
                                                    'cursor-pointer space-y-2 rounded-2xl border p-4 transition-all',
                                                    isSelected
                                                        ? 'border-brand-rust bg-brand-rust/5 ring-2 ring-brand-rust/20'
                                                        : 'border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50'
                                                )}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <Icon
                                                        className={cn(
                                                            'size-5',
                                                            isSelected ? 'text-brand-rust' : 'text-zinc-500'
                                                        )}
                                                    />
                                                    <input
                                                        type="radio"
                                                        name="payment_method"
                                                        checked={isSelected}
                                                        onChange={() => setData('payment_method', opt.id)}
                                                        className="text-brand-rust focus:ring-brand-rust"
                                                    />
                                                </div>
                                                <h5 className="text-sm font-bold text-zinc-900">{opt.title}</h5>
                                                <p className="text-xs text-zinc-500 leading-relaxed">{opt.desc}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* Terms Disclaimer */}
                            <div className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
                                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                                <p>
                                    By clicking "Submit Booking", you acknowledge that your balikbayan box contains non-commercial items and complies with Bureau of Customs (BOC) regulations. A reference code will be generated immediately for public tracking.
                                </p>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <button
                                    type="button"
                                    onClick={handleBack}
                                    className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 py-3 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50"
                                >
                                    <ArrowLeft className="size-4" />
                                    Back to Boxes
                                </button>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="inline-flex items-center gap-2 rounded-xl bg-brand-rust px-8 py-4 text-sm font-black text-white shadow-md transition-all hover:bg-brand-rust/90 active:scale-98 disabled:opacity-50"
                                >
                                    {processing ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin" />
                                            Submitting Booking...
                                        </>
                                    ) : (
                                        <>
                                            Submit Pickup Request
                                            <CheckCircle2 className="size-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </MarketingLayout>
    );
}
