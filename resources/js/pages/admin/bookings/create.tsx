import { Head, Link, useForm } from '@inertiajs/react';
import { format } from 'date-fns';
import {
    Save,
    ArrowLeft,
    ArrowRight,
    User,
    Package,
    PlusCircle,
    X,
    Ruler,
    CheckCircle,
    AlertTriangle,
    ShieldCheck,
    FileText,
    Copy,
    CalendarIcon,
    Truck,
    MapPin,
    CreditCard,
    DollarSign,
    Box as BoxIcon,
    Sparkles,
    UserCheck,
    UserPlus,
    Receipt
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import Select from 'react-select';
import { toast } from 'sonner';
import Heading from '@/components/common/heading';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PhoneInput from '@/components/ui/PhoneInput';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAutoSave } from '@/hooks/use-auto-save';
import AppLayout from '@/layouts/app-layout';
import { validatePhone } from '@/lib/countries';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

function StepIndicator({ step }: { step: number }) {
    const steps = [
        { id: 1, label: 'Sender & Pickup', icon: User },
        { id: 2, label: 'Boxes & Destinations', icon: Package },
        { id: 3, label: 'Review & Admin Options', icon: ShieldCheck }
    ];

    return (
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
            {steps.map((item) => {
                const isActive = step === item.id;
                const isPast = step > item.id;
                const IconComponent = item.icon;

                return (
                    <div
                        key={item.id}
                        className={`relative overflow-hidden rounded-2xl border p-3.5 md:p-4 transition-all duration-300 ${
                            isActive
                                ? 'border-brand-rust bg-brand-warm/10 shadow-md ring-2 ring-brand-rust/20'
                                : isPast
                                    ? 'border-brand-rust/40 bg-white dark:bg-zinc-900 shadow-sm'
                                    : 'border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40 opacity-60'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className={`flex h-9 w-9 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-xl font-bold text-xs md:text-sm transition-all duration-300 ${
                                    isPast
                                        ? 'bg-brand-rust text-white shadow-sm'
                                        : isActive
                                            ? 'bg-brand-rust text-white shadow-md'
                                            : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                }`}
                            >
                                {isPast ? <CheckCircle className="size-4 md:size-5" /> : <IconComponent className="size-4 md:size-5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                    Step {item.id}
                                </p>
                                <p className="text-xs md:text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                    {item.label}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function SectionCardHeader({ icon: Icon, title, subtitle, badge }: { icon?: any; title: string; subtitle?: string; badge?: string }) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800/80 pb-4 mb-6">
            <div className="flex items-center gap-3">
                {Icon && (
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
                        <Icon className="size-5" />
                    </div>
                )}
                <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{title}</h3>
                    {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {badge && (
                <span className="inline-flex items-center rounded-full bg-brand-warm/20 text-brand-rust px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider">
                    {badge}
                </span>
            )}
        </div>
    );
}

function Field({ label, required, error, hint, action, children }: { label: string; required?: boolean; error?: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                    {label}
                    {required && <span className="ml-1 text-red-500 font-bold">*</span>}
                </label>
                {action && <div>{action}</div>}
            </div>
            {children}
            {hint && <p className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-tight">{hint}</p>}
            {error && <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-1">{error}</p>}
        </div>
    );
}

interface Sender {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    mobile: string;
    address: string;
    suburb: string;
    state: string;
    postcode: string;
}

export default function BookingsCreate({
    senders,
    areas,
    provinces,
    boxTypes,
    boxPrices,
    pickers,
    pickupZones = [],
}: {
    senders: Sender[];
    areas: any[];
    provinces: any[];
    boxTypes: any[];
    boxPrices: any[];
    pickers: any[];
    pickupZones?: any[];
}) {
    const [currentStep, setCurrentStep] = useState(1);

    const { data, setData, post, processing, errors, clearErrors, setError } = useForm({
        is_new_sender: false,
        sender_id: '',
        sender_first_name: '',
        sender_last_name: '',
        sender_email: '',
        sender_mobile: '',
        sender_address: '',
        sender_suburb: '',
        sender_state: '',
        sender_postcode: '',
        booking_type: 'drop_off',
        pickup_zone_id: '',
        status: 'pending',
        picker_id: '',
        preferred_date: '',
        payment_status: 'pending',
        payment_method: 'bank_transfer',
        payment_reference: '',
        proof_of_payment: null as File | null,
        declaration_form_status: 'missing',
        declaration_form: null as File | null,
        notes: '',
        admin_notes: '',
        request_empty_box: false,
        empty_box_count: 1,
        empty_box_fee: 10,
        boxes: [
            {
                recipient_first_name: '',
                recipient_last_name: '',
                recipient_email: '',
                recipient_address: '',
                recipient_city: '',
                recipient_province: '',
                recipient_zip_code: '',
                recipient_phone: '',
                recipient_landmarks: '',
                area_id: '',
                box_type_id: '',
                is_custom_size: false,
                is_door_to_door: false,
                custom_length: '',
                custom_width: '',
                custom_height: '',
            }
        ]
    });

    const handleAutoSaveSetData = useCallback((next: typeof data | ((prev: typeof data) => typeof data)) => {
        if (typeof next === 'function') {
            setData((prev) => (next as (previous: typeof data) => typeof data)(prev));

            return;
        }

        setData(next);
    }, [setData]);

    const { clearSavedData } = useAutoSave<typeof data>('admin_booking_create', data, handleAutoSaveSetData);

    const senderOptions = useMemo(() => {
        return senders.map(c => ({
            value: c.id,
            label: `${c.first_name} ${c.last_name} (${c.email})`
        }));
    }, [senders]);

    const selectedSenderOption = useMemo(() => {
        return senderOptions.find(opt => opt.value.toString() === data.sender_id.toString()) || null;
    }, [senderOptions, data.sender_id]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Bookings', href: '/admin/bookings' },
        { title: 'Create Booking', href: '/admin/bookings/create' },
    ];

    const baseInputClass = "flex h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 px-3.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-brand-rust focus:outline-none focus:ring-2 focus:ring-brand-rust/20 disabled:cursor-not-allowed disabled:opacity-50 transition-all shadow-sm";

    const getFriendlyError = (key: string, message: string) => {
        let friendlyKey = key;
        const cleaned = message.replace(/\.\d+\./g, ' ');

        if (key.startsWith('boxes.')) {
            const parts = key.split('.');
            const index = parseInt(parts[1]) + 1;
            let field = parts.slice(2).join(' ').replace(/_/g, ' ');

            if (field === 'area id') field = 'destination area';
            if (field === 'box type id') field = 'box type';
            if (field === 'custom length') field = 'length';
            if (field === 'custom width') field = 'width';
            if (field === 'custom height') field = 'height';
            if (field === 'recipient phone') field = 'recipient mobile number';

            if (cleaned.toLowerCase().includes(`box ${index}`) || cleaned.toLowerCase().includes(`unit ${index}`)) {
                return cleaned;
            }

            const strippedField = field.replace(/^recipient\s+/, '').replace(/^sender\s+/, '');

            if (cleaned.toLowerCase().includes(field.toLowerCase()) || cleaned.toLowerCase().includes(strippedField.toLowerCase())) {
                return `Box ${index}: ${cleaned.charAt(0).toUpperCase() + cleaned.slice(1)}`;
            }

            friendlyKey = `Box ${index} ${field}`;
        } else {
            friendlyKey = key.replace(/_/g, ' ');
        }

        friendlyKey = friendlyKey.charAt(0).toUpperCase() + friendlyKey.slice(1);

        if (cleaned.toLowerCase().includes(friendlyKey.toLowerCase())) {
            return cleaned;
        }

        return `${friendlyKey}: ${cleaned}`;
    };

    const getSuggestedPrice = (zoneName: string, areaName: string, boxTypeName: string): string => {
        const isJumbo = boxTypeName.toLowerCase().includes('jumbo');
        if (!isJumbo) return '0.00';

        const z = zoneName.toLowerCase();
        const a = areaName.toLowerCase();

        let group = 'metro';
        if (z.includes('ballarat') || z.includes('geelong') || z.includes('kyneton')) group = 'ballarat';
        else if (z.includes('shepparton') || z.includes('gippsland') || z.includes('bendigo')) group = 'shepparton';
        else if (z.includes('western') || z.includes('victoria')) group = 'western';

        const rates: Record<string, Record<string, string>> = {
            metro: { manila: '95.00', outer: '105.00', ncr: '105.00', luzon: '105.00', visayas: '130.00', mindanao: '140.00', inter: '150.00' },
            ballarat: { manila: '110.00', outer: '120.00', ncr: '120.00', luzon: '120.00', visayas: '140.00', mindanao: '150.00', inter: '160.00' },
            shepparton: { manila: '140.00', outer: '150.00', ncr: '150.00', luzon: '150.00', visayas: '175.00', mindanao: '185.00', inter: '200.00' },
            western: { manila: '150.00', outer: '150.00', ncr: '150.00', luzon: '160.00', visayas: '180.00', mindanao: '190.00', inter: '220.00' },
        };

        const zoneRates = rates[group];

        if (a.includes('manila')) return zoneRates.manila;
        if (a.includes('outer') || a.includes('ncr')) return zoneRates.outer;
        if (a.includes('luzon')) return zoneRates.luzon;
        if (a.includes('visayas')) return zoneRates.visayas;
        if (a.includes('mindanao')) return zoneRates.mindanao;
        if (a.includes('inter')) return zoneRates.inter;

        return '0.00';
    };

    const validateStep = (stepNumber: number) => {
        clearErrors();
        let isValid = true;

        if (stepNumber === 1) {
            if (data.is_new_sender) {
                if (!data.sender_first_name.trim()) { setError('sender_first_name', 'First name is required.'); isValid = false; }
                if (!data.sender_last_name.trim()) { setError('sender_last_name', 'Last name is required.'); isValid = false; }
                if (!data.sender_email.trim()) { setError('sender_email', 'Email address is required.'); isValid = false; }
                if (!data.sender_mobile.trim()) { setError('sender_mobile', 'Contact phone is required.'); isValid = false; }
                else {
                    const phoneErr = validatePhone(data.sender_mobile, 'Sender mobile number', 'AU');
                    if (phoneErr) { setError('sender_mobile', phoneErr); isValid = false; }
                }
                if (!data.sender_address.trim()) { setError('sender_address', 'Address is required.'); isValid = false; }
            } else {
                if (!data.sender_id) { setError('sender_id', 'Please select an existing sender.'); isValid = false; }
            }

            if (data.status === 'collected' && !data.picker_id) {
                setError('picker_id', 'Picker is required when booking status is Collected.');
                isValid = false;
            }
        }

        if (stepNumber === 2) {
            const master = data.boxes[0] || {};
            if (!master.recipient_first_name?.trim()) { setError('boxes.0.recipient_first_name', 'Recipient first name is required.'); isValid = false; }
            if (!master.recipient_last_name?.trim()) { setError('boxes.0.recipient_last_name', 'Recipient last name is required.'); isValid = false; }
            if (!master.recipient_phone?.trim()) { setError('boxes.0.recipient_phone', 'Recipient mobile number is required.'); isValid = false; }
            else {
                const phoneErr = validatePhone(master.recipient_phone, 'Recipient mobile number', 'PH');
                if (phoneErr) { setError('boxes.0.recipient_phone', phoneErr); isValid = false; }
            }
            if (!master.recipient_address?.trim()) { setError('boxes.0.recipient_address', 'Recipient full address is required.'); isValid = false; }
            if (!master.recipient_city?.trim()) { setError('boxes.0.recipient_city', 'Recipient city is required.'); isValid = false; }
            if (!master.recipient_province?.trim()) { setError('boxes.0.recipient_province', 'Recipient province is required.'); isValid = false; }

            data.boxes.forEach((box, i) => {
                if (!box.area_id) { setError(`boxes.${i}.area_id`, 'Destination Area is required.'); isValid = false; }

                if (box.is_custom_size) {
                    if (!box.custom_length || parseFloat(box.custom_length) <= 0) { setError(`boxes.${i}.custom_length`, 'Length > 0 required.'); isValid = false; }
                    if (!box.custom_width || parseFloat(box.custom_width) <= 0) { setError(`boxes.${i}.custom_width`, 'Width > 0 required.'); isValid = false; }
                    if (!box.custom_height || parseFloat(box.custom_height) <= 0) { setError(`boxes.${i}.custom_height`, 'Height > 0 required.'); isValid = false; }
                } else {
                    if (!box.box_type_id) { setError(`boxes.${i}.box_type_id`, 'Box Type is required.'); isValid = false; }
                }
            });
        }

        if (!isValid) {
            toast.error('Please fix the validation errors before continuing.');
        }

        return isValid;
    };

    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(s => Math.min(s + 1, 3));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const prevStep = () => {
        setCurrentStep(s => Math.max(s - 1, 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const updatePrimaryRecipient = (fieldOrObj: string | Record<string, any>, value?: any) => {
        const updateObj = typeof fieldOrObj === 'string' ? { [fieldOrObj]: value } : fieldOrObj;
        setData((prevData: any) => ({
            ...prevData,
            boxes: prevData.boxes.map((box: any) => ({ ...box, ...updateObj }))
        }));
    };

    const handleBoxQuantityChange = (newCount: number) => {
        const count = Math.max(1, Math.min(20, newCount));
        const currentBoxes = [...data.boxes];

        if (count === currentBoxes.length) return;

        if (count < currentBoxes.length) {
            setData('boxes', currentBoxes.slice(0, count));
        } else {
            const master = currentBoxes[0] || {};
            const updatedBoxes = [...currentBoxes];

            while (updatedBoxes.length < count) {
                updatedBoxes.push({
                    recipient_first_name: master.recipient_first_name || '',
                    recipient_last_name: master.recipient_last_name || '',
                    recipient_email: master.recipient_email || '',
                    recipient_address: master.recipient_address || '',
                    recipient_city: master.recipient_city || '',
                    recipient_province: master.recipient_province || '',
                    recipient_zip_code: master.recipient_zip_code || '',
                    recipient_phone: master.recipient_phone || '',
                    recipient_landmarks: master.recipient_landmarks || '',
                    area_id: master.area_id || '',
                    box_type_id: master.box_type_id || '',
                    is_custom_size: master.is_custom_size || false,
                    is_door_to_door: master.is_door_to_door || false,
                    custom_length: master.custom_length || '',
                    custom_width: master.custom_width || '',
                    custom_height: master.custom_height || '',
                });
            }
            setData('boxes', updatedBoxes);
        }
    };

    const addBox = () => {
        const master = data.boxes[0] || {};
        setData('boxes', [
            ...data.boxes,
            {
                recipient_first_name: master.recipient_first_name || '',
                recipient_last_name: master.recipient_last_name || '',
                recipient_email: master.recipient_email || '',
                recipient_address: master.recipient_address || '',
                recipient_city: master.recipient_city || '',
                recipient_province: master.recipient_province || '',
                recipient_zip_code: master.recipient_zip_code || '',
                recipient_phone: master.recipient_phone || '',
                recipient_landmarks: master.recipient_landmarks || '',
                area_id: master.area_id || '',
                box_type_id: master.box_type_id || '',
                is_custom_size: master.is_custom_size || false,
                is_door_to_door: master.is_door_to_door || false,
                custom_length: master.custom_length || '',
                custom_width: master.custom_width || '',
                custom_height: master.custom_height || '',
            }
        ]);
    };

    const duplicateBox = (index: number) => {
        const boxToDuplicate = data.boxes[index];
        setData('boxes', [
            ...data.boxes,
            { ...boxToDuplicate }
        ]);
        toast.success('Box duplicated successfully');
    };

    const removeBox = (index: number) => {
        const newBoxes = [...data.boxes];
        newBoxes.splice(index, 1);
        setData('boxes', newBoxes);
    };

    const updateBox = (index: number, field: string, value: any) => {
        const newBoxes = [...data.boxes];
        // @ts-ignore
        newBoxes[index][field] = value;
        setData('boxes', newBoxes);
    };

    const handleSenderSelect = (senderId: string) => {
        setData('sender_id', senderId);
        const selected = senders.find(s => s.id.toString() === senderId);

        if (selected) {
            setData(prev => ({
                ...prev,
                sender_first_name: selected.first_name,
                sender_last_name: selected.last_name,
                sender_email: selected.email,
                sender_mobile: selected.mobile,
                sender_address: selected.address,
                sender_suburb: selected.suburb || '',
                sender_state: selected.state || '',
                sender_postcode: selected.postcode || '',
                pickup_zone_id: (selected as any).pickup_zone_id ? (selected as any).pickup_zone_id.toString() : prev.pickup_zone_id,
            }));
        }
    };

    const getBoxBasePrice = (box: any) => {
        let basePrice = 0;

        if (box.is_custom_size) {
            const l = parseFloat(box.custom_length || '0');
            const w = parseFloat(box.custom_width || '0');
            const h = parseFloat(box.custom_height || '0');

            if (!box.area_id || l <= 0 || w <= 0 || h <= 0) {
                basePrice = 0;
            } else {
                const customCbmType = boxTypes?.find((bt: any) => bt.name?.toLowerCase().includes('cbm') || bt.name?.toLowerCase() === 'custom box');
                let cbmRate = 0;
                
                if (customCbmType && data.pickup_zone_id) {
                    const exactPriceRecord = boxPrices?.find(
                        (p: any) => p.area_id?.toString() === box.area_id.toString() 
                            && p.box_type_id?.toString() === customCbmType.id.toString() 
                            && p.pickup_zone_id?.toString() === data.pickup_zone_id?.toString()
                    );
                    if (exactPriceRecord) {
                        cbmRate = parseFloat(exactPriceRecord.price);
                    }
                }

                if (cbmRate > 0) {
                    const cbm = (l * w * h) / 1_000_000;
                    basePrice = Math.round(cbm * cbmRate * 100) / 100;
                }
            }
        } else if (box.area_id && box.box_type_id) {
            let priceRecord = null;

            if (data.pickup_zone_id) {
                priceRecord = boxPrices?.find(
                    (p: any) => p.area_id?.toString() === box.area_id.toString()
                        && p.box_type_id?.toString() === box.box_type_id.toString()
                        && p.pickup_zone_id?.toString() === data.pickup_zone_id.toString()
                );
            }

            if (priceRecord) {
                basePrice = parseFloat(priceRecord.price);
            } else if (data.pickup_zone_id) {
                const zone = pickupZones?.find((z: any) => z.id.toString() === data.pickup_zone_id.toString());
                const area = areas?.find((a: any) => a.id.toString() === box.area_id.toString());
                const boxType = boxTypes?.find((b: any) => b.id.toString() === box.box_type_id.toString());

                if (zone && area && boxType) {
                    basePrice = parseFloat(getSuggestedPrice(zone.name, area.name, boxType.name));
                }
            }
        }

        return basePrice;
    };

    const getBoxDoorToDoorFee = (box: any) => {
        if (box.is_door_to_door && box.area_id) {
            const area = areas?.find((a: any) => a.id.toString() === box.area_id.toString());
            return parseFloat(area?.door_to_door_fee || '0');
        }
        return 0;
    };

    const getBoxPrice = (box: any) => {
        return getBoxBasePrice(box) + getBoxDoorToDoorFee(box);
    };

    const boxesBaseSubtotal = data.boxes.reduce((acc, box) => acc + getBoxBasePrice(box), 0);
    const doorToDoorTotal = data.boxes.reduce((acc, box) => acc + getBoxDoorToDoorFee(box), 0);
    const boxesSubtotal = boxesBaseSubtotal + doorToDoorTotal;
    const emptyBoxTotal = data.request_empty_box ? (data.empty_box_count || 1) * (data.empty_box_fee || 10) : 0;
    const baseSubtotal = boxesSubtotal + emptyBoxTotal;
    const afterpaySurcharge = data.payment_method === 'afterpay' ? Math.round(baseSubtotal * 0.063 * 100) / 100 : 0;
    const totalEstimate = baseSubtotal + afterpaySurcharge;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateStep(1) || !validateStep(2)) {
            setCurrentStep(validateStep(1) ? 2 : 1);

            return;
        }

        const masterRecipient = data.boxes[0] || {};
        const normalizedBoxes = data.boxes.map(box => ({
            ...box,
            recipient_first_name: masterRecipient.recipient_first_name,
            recipient_last_name: masterRecipient.recipient_last_name,
            recipient_email: masterRecipient.recipient_email,
            recipient_address: masterRecipient.recipient_address,
            recipient_city: masterRecipient.recipient_city,
            recipient_province: masterRecipient.recipient_province,
            recipient_zip_code: masterRecipient.recipient_zip_code,
            recipient_phone: masterRecipient.recipient_phone,
            recipient_landmarks: masterRecipient.recipient_landmarks,
        }));

        setData('boxes', normalizedBoxes);

        post('/admin/bookings', {
            forceFormData: true,
            onSuccess: () => clearSavedData(),
            onError: (errs) => {
                const hasSenderErrors = Object.keys(errs).some(k => k.startsWith('sender_') || k === 'is_new_sender' || k === 'picker_id' || k === 'preferred_date' || k === 'status');
                const hasBoxErrors = Object.keys(errs).some(k => k.startsWith('boxes'));

                if (hasSenderErrors) {
                    setCurrentStep(1);
                    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
                } else if (hasBoxErrors) {
                    setCurrentStep(2);
                    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50);
                }
            }
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Booking - Admin" />

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Header Title with Live Summary Badge */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/bookings" className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 transition-colors">
                            <ArrowLeft className="size-5" />
                        </Link>
                        <div>
                            <Heading title="Create Admin Booking" description="Direct manual order creation with single-recipient & add-on management" />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/80 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700/80">
                        <div className="text-right">
                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Current Order Summary</p>
                            <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                                {data.boxes.length} {data.boxes.length === 1 ? 'Box' : 'Boxes'} • <span className="text-brand-rust">${totalEstimate.toFixed(2)}</span>
                            </p>
                        </div>
                    </div>
                </div>

                <StepIndicator step={currentStep} />

                {/* Form Container */}
                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                    <div className="p-6 md:p-8">
                        {currentStep === 1 && (
                            <form onSubmit={(e) => { e.preventDefault(); nextStep(); }} className="space-y-8">
                                {/* Sender Selection */}
                                <div className="space-y-6">
                                    <SectionCardHeader
                                        icon={User}
                                        title="Sender Information"
                                        subtitle="Choose whether to select an existing sender or register a new customer profile"
                                    />

                                    <div className="flex rounded-xl bg-zinc-100 dark:bg-zinc-800/60 p-1 max-w-xs border border-zinc-200 dark:border-zinc-700/50">
                                        <button
                                            type="button"
                                            onClick={() => setData('is_new_sender', false)}
                                            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                                                !data.is_new_sender
                                                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                                                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                                            }`}
                                        >
                                            <UserCheck className="size-3.5" /> Existing Sender
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setData('is_new_sender', true)}
                                            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all ${
                                                data.is_new_sender
                                                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                                                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                                            }`}
                                        >
                                            <UserPlus className="size-3.5" /> New Sender
                                        </button>
                                    </div>

                                    {!data.is_new_sender ? (
                                        <div className="space-y-4 max-w-xl">
                                            <Field label="Select Sender" required error={errors.sender_id}>
                                                <div className="relative">
                                                    <Select
                                                        options={senderOptions}
                                                        value={selectedSenderOption}
                                                        onChange={(option: any) => handleSenderSelect(option ? option.value.toString() : '')}
                                                        placeholder="Search or select a sender by name or email..."
                                                        isClearable
                                                        isSearchable
                                                        styles={{
                                                            control: (base) => ({
                                                                ...base,
                                                                minHeight: '44px',
                                                                borderRadius: '0.75rem',
                                                                borderColor: '#e4e4e7',
                                                                boxShadow: 'none',
                                                                backgroundColor: 'transparent',
                                                                '&:hover': { borderColor: '#d4d4d8' }
                                                            }),
                                                            valueContainer: (base) => ({ ...base, paddingLeft: '12px' }),
                                                            menu: (base) => ({ ...base, zIndex: 50 })
                                                        }}
                                                    />
                                                </div>
                                            </Field>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Field label="First Name" required error={errors.sender_first_name}>
                                                <Input className={baseInputClass} value={data.sender_first_name} onChange={e => setData('sender_first_name', e.target.value)} />
                                            </Field>
                                            <Field label="Last Name" required error={errors.sender_last_name}>
                                                <Input className={baseInputClass} value={data.sender_last_name} onChange={e => setData('sender_last_name', e.target.value)} />
                                            </Field>
                                            <Field label="Email Address" required error={errors.sender_email}>
                                                <Input className={baseInputClass} type="email" value={data.sender_email} onChange={e => setData('sender_email', e.target.value)} />
                                            </Field>
                                            <Field label="Contact Phone" required error={errors.sender_mobile}>
                                                <PhoneInput value={data.sender_mobile} onChange={val => setData('sender_mobile', val)} defaultCountryCode="AU" />
                                            </Field>
                                            <div className="md:col-span-2">
                                                <Field label="Full Address" required error={errors.sender_address}>
                                                    <Input className={baseInputClass} value={data.sender_address} onChange={e => setData('sender_address', e.target.value)} />
                                                </Field>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Booking Type */}
                                <div className="space-y-4 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                    <SectionCardHeader
                                        icon={Truck}
                                        title="Booking & Collection Type"
                                        subtitle="Select whether this order is a Drop-Off at warehouse/branch or a Home Pick-Up"
                                    />
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        {[
                                            {
                                                id: 'drop_off',
                                                title: 'Drop-Off',
                                                desc: 'Sender drops off box at branch/warehouse',
                                                icon: BoxIcon,
                                            },
                                            {
                                                id: 'home_pickup',
                                                title: 'Home Pick-Up',
                                                desc: 'Courier/Picker collects at sender address',
                                                icon: Truck,
                                            },
                                            {
                                                id: 'other',
                                                title: 'Other',
                                                desc: 'Custom / Other collection arrangement',
                                                icon: Sparkles,
                                            },
                                        ].map((t) => {
                                            const isSelected = data.booking_type === t.id;
                                            const IconComp = t.icon;
                                            return (
                                                <button
                                                    key={t.id}
                                                    type="button"
                                                    onClick={() => setData('booking_type', t.id)}
                                                    className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                                                        isSelected
                                                            ? 'border-brand-rust bg-brand-warm/15 dark:bg-brand-rust/20 ring-2 ring-brand-rust/30 shadow-sm'
                                                            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between w-full mb-2">
                                                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-brand-rust text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>
                                                            <IconComp className="size-4" />
                                                        </div>
                                                        {isSelected && <CheckCircle className="size-4 text-brand-rust" />}
                                                    </div>
                                                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">{t.title}</p>
                                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">{t.desc}</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {errors.booking_type && (
                                        <p className="text-xs font-semibold text-red-600 mt-1">{errors.booking_type}</p>
                                    )}
                                </div>

                                {/* Pickup Schedule */}
                                <div className="space-y-6 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                                    <SectionCardHeader
                                        icon={CalendarIcon}
                                        title="Pickup Schedule & Status"
                                        subtitle="Specify preferred pickup window and initial order status"
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Field label="Preferred Pickup Date" error={errors.preferred_date}>
                                            <Input className={baseInputClass} type="date" value={data.preferred_date} onChange={e => setData('preferred_date', e.target.value)} />
                                        </Field>
                                        <Field
                                            label="Pickup Area"
                                            error={errors.pickup_zone_id}
                                            hint="Determines rate tier based on suburb location"
                                            action={
                                                <Link
                                                    href="/admin/pickup-zones"
                                                    target="_blank"
                                                    className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                                                >
                                                    <PlusCircle className="size-3" /> Add Pickup Area
                                                </Link>
                                            }
                                        >
                                            <select className={baseInputClass} value={data.pickup_zone_id} onChange={e => setData('pickup_zone_id', e.target.value)}>
                                                <option value="">Select Pickup Area...</option>
                                                {pickupZones?.map((z: any) => (
                                                    <option key={z.id} value={z.id}>{z.name}</option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field label="Booking Status" required error={errors.status}>
                                            <select className={baseInputClass} value={data.status} onChange={e => setData('status', e.target.value)}>
                                                <option value="pending">Pending</option>
                                                <option value="confirmed">Confirmed</option>
                                                <option value="collected">Collected</option>
                                                <option value="shipped">Shipped</option>
                                                <option value="delivered">Delivered</option>
                                                <option value="cancelled">Cancelled</option>
                                            </select>
                                        </Field>
                                        {data.status === 'collected' && (
                                            <Field label="Picker Name" required error={errors.picker_id} hint="Assign a picker for reference and serial auto-assignment.">
                                                <select className={baseInputClass} value={data.picker_id} onChange={e => setData('picker_id', e.target.value)}>
                                                    <option value="">Select a picker...</option>
                                                    {pickers.map((p: any) => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                            </Field>
                                        )}
                                    </div>
                                    <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                        <div className="flex items-center justify-between gap-4 py-2.5 px-4 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                            <div className="flex items-center gap-2.5">
                                                <BoxIcon className="size-4 text-zinc-400 shrink-0" />
                                                <div>
                                                    <p className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">Number of Boxes</p>
                                                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Box cards generated in Step 2</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleBoxQuantityChange(data.boxes.length - 1)}
                                                    disabled={data.boxes.length <= 1}
                                                    className="size-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-extrabold text-base hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center text-zinc-900 dark:text-zinc-100"
                                                >-</button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="20"
                                                    value={data.boxes.length}
                                                    onChange={(e) => handleBoxQuantityChange(parseInt(e.target.value) || 1)}
                                                    className="w-12 h-8 text-center font-black text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-brand-rust"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleBoxQuantityChange(data.boxes.length + 1)}
                                                    disabled={data.boxes.length >= 20}
                                                    className="size-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-extrabold text-base hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center text-zinc-900 dark:text-zinc-100"
                                                >+</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>


                                {/* Empty Box Delivery Request */}
                                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                                    <div className="px-4 py-3 bg-amber-50/40 dark:bg-amber-950/20 rounded-xl border border-amber-200/80 dark:border-amber-900/50 space-y-3">
                                        <div className="flex items-center gap-2.5">
                                            <Truck className="size-4 text-amber-500 shrink-0" />
                                            <Checkbox
                                                id="request-empty-box"
                                                checked={data.request_empty_box}
                                                onCheckedChange={(checked) => setData('request_empty_box', !!checked)}
                                            />
                                            <label htmlFor="request-empty-box" className="text-xs font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                                                Sender requests empty box delivery <span className="text-amber-600 dark:text-amber-400 font-extrabold">($10.00 each)</span>
                                            </label>
                                        </div>

                                        {data.request_empty_box && (
                                            <div className="flex items-center justify-between gap-4 pt-2 border-t border-amber-200/60 dark:border-amber-900/40">
                                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Qty to deliver prior to pickup</p>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setData('empty_box_count', Math.max(1, data.empty_box_count - 1))}
                                                        disabled={data.empty_box_count <= 1}
                                                        className="size-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-bold text-base hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center text-zinc-900 dark:text-zinc-100"
                                                    >-</button>
                                                    <span className="font-extrabold text-sm min-w-8 text-center text-zinc-900 dark:text-zinc-100">{data.empty_box_count}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setData('empty_box_count', data.empty_box_count + 1)}
                                                        className="size-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-bold text-base hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex items-center justify-center text-zinc-900 dark:text-zinc-100"
                                                    >+</button>
                                                    <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400">(+${(data.empty_box_count * 10).toFixed(2)})</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </form>
                        )}

                        {currentStep === 2 && (
                            <div className="space-y-8">
                                {/* Primary Recipient Section */}
                                <div className="rounded-2xl border border-sky-200/80 bg-sky-50/40 dark:bg-sky-950/20 p-6 space-y-4 shadow-sm">
                                    <SectionCardHeader
                                        icon={MapPin}
                                        title="Primary Recipient Information"
                                        subtitle="Entered once — applies to all boxes in this booking"
                                        // badge="Single Recipient Policy"
                                    />

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Field label="First Name" required error={errors['boxes.0.recipient_first_name']}>
                                            <Input className={baseInputClass} value={data.boxes[0]?.recipient_first_name || ''} onChange={e => updatePrimaryRecipient('recipient_first_name', e.target.value)} />
                                        </Field>
                                        <Field label="Last Name" required error={errors['boxes.0.recipient_last_name']}>
                                            <Input className={baseInputClass} value={data.boxes[0]?.recipient_last_name || ''} onChange={e => updatePrimaryRecipient('recipient_last_name', e.target.value)} />
                                        </Field>
                                        <Field label="Email Address" error={errors['boxes.0.recipient_email']}>
                                            <Input className={baseInputClass} type="email" value={data.boxes[0]?.recipient_email || ''} onChange={e => updatePrimaryRecipient('recipient_email', e.target.value)} />
                                        </Field>
                                        <Field label="Mobile Number" required error={errors['boxes.0.recipient_phone']}>
                                            <PhoneInput value={data.boxes[0]?.recipient_phone || ''} onChange={val => updatePrimaryRecipient('recipient_phone', val)} defaultCountryCode="PH" />
                                        </Field>
                                        <div className="md:col-span-2">
                                            <Field label="Full Address" required error={errors['boxes.0.recipient_address']}>
                                                <Input className={baseInputClass} value={data.boxes[0]?.recipient_address || ''} onChange={e => updatePrimaryRecipient('recipient_address', e.target.value)} />
                                            </Field>
                                        </div>
                                        <Field label="City" required error={errors['boxes.0.recipient_city']}>
                                            <Input className={baseInputClass} value={data.boxes[0]?.recipient_city || ''} onChange={e => updatePrimaryRecipient('recipient_city', e.target.value)} />
                                        </Field>
                                        <Field label="Province" required error={errors['boxes.0.recipient_province']}>
                                            <Select
                                                options={provinces?.map((p: any) => ({
                                                    value: p.name,
                                                    label: p.name,
                                                    area_id: p.area_id,
                                                }))}
                                                value={
                                                    data.boxes[0]?.recipient_province
                                                        ? { value: data.boxes[0].recipient_province, label: data.boxes[0].recipient_province }
                                                        : null
                                                }
                                                onChange={(option: any) => {
                                                    const selectedProvinceName = option ? option.value : '';
                                                    const selectedAreaId = option && option.area_id ? option.area_id.toString() : '';

                                                    updatePrimaryRecipient({
                                                        recipient_province: selectedProvinceName,
                                                        area_id: selectedAreaId,
                                                    });
                                                }}
                                                placeholder="Search or select a province..."
                                                isClearable
                                                isSearchable
                                                styles={{
                                                    control: (base) => ({
                                                        ...base,
                                                        minHeight: '44px',
                                                        borderRadius: '0.75rem',
                                                        borderColor: '#e4e4e7',
                                                        boxShadow: 'none',
                                                        backgroundColor: 'transparent',
                                                        '&:hover': { borderColor: '#d4d4d8' }
                                                    }),
                                                    singleValue: (base) => ({
                                                        ...base,
                                                        color: 'inherit',
                                                    }),
                                                    input: (base) => ({
                                                        ...base,
                                                        color: 'inherit',
                                                    }),
                                                    valueContainer: (base) => ({ ...base, paddingLeft: '12px' }),
                                                    menu: (base) => ({ ...base, zIndex: 50 })
                                                }}
                                            />
                                        </Field>
                                        <Field label="Zip Code" error={errors['boxes.0.recipient_zip_code']}>
                                            <Input className={baseInputClass} value={data.boxes[0]?.recipient_zip_code || ''} onChange={e => updatePrimaryRecipient('recipient_zip_code', e.target.value)} />
                                        </Field>
                                        <Field label="Landmarks / Specific Directions" error={errors['boxes.0.recipient_landmarks']}>
                                            <Input className={baseInputClass} value={data.boxes[0]?.recipient_landmarks || ''} onChange={e => updatePrimaryRecipient('recipient_landmarks', e.target.value)} />
                                        </Field>
                                        <Field label="Destination Area" required error={errors['boxes.0.area_id']}>
                                            <select
                                                className={baseInputClass + " bg-zinc-50 dark:bg-zinc-800/50 cursor-not-allowed"}
                                                value={data.boxes[0]?.area_id || ''}
                                                onChange={e => updatePrimaryRecipient('area_id', e.target.value)}
                                                disabled
                                            >
                                                <option value="">Auto-selected from Province</option>
                                                {areas?.map((a: any) => (
                                                    <option key={a.id} value={a.id}>{a.name}</option>
                                                ))}
                                            </select>
                                        </Field>
                                    </div>

                                    {/* Door-to-Door Delivery Add-On for whole booking */}
                                    {(() => {
                                        const selectedArea = areas?.find((a: any) => a.id.toString() === data.boxes[0]?.area_id?.toString());
                                        const fee = selectedArea ? parseFloat(selectedArea.door_to_door_fee || '0') : 0;

                                        if (!data.boxes[0]?.area_id) return null;

                                        return (
                                            <div className="flex items-start gap-3 p-3.5 rounded-2xl border border-amber-200/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/50 mt-4">
                                                <Checkbox
                                                    id={`door-to-door-primary`}
                                                    checked={!!data.boxes[0]?.is_door_to_door}
                                                    onCheckedChange={(checked) => updatePrimaryRecipient('is_door_to_door', !!checked)}
                                                    className="mt-0.5"
                                                />
                                                <div className="space-y-0.5">
                                                    <label htmlFor={`door-to-door-primary`} className="text-xs font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer block">
                                                        Door-to-Door Delivery Add-On{' '}
                                                        {fee > 0 ? (
                                                            <span className="text-amber-700 dark:text-amber-400 font-extrabold">(+${fee.toFixed(2)} per box)</span>
                                                        ) : (
                                                            <span className="text-emerald-600 dark:text-emerald-400 text-[10px] uppercase tracking-wider font-extrabold">(Included / Free)</span>
                                                        )}
                                                    </label>
                                                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                                                        Request direct last-mile delivery to the recipient's home address. Applied to all boxes.
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Booking Boxes Section */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
                                        <div>
                                            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Booking Boxes ({data.boxes.length})</h3>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Configure package specifications</p>
                                        </div>
                                        <Button type="button" onClick={addBox} variant="outline" className="h-10 rounded-xl text-xs font-bold border-zinc-200 dark:border-zinc-800">
                                            <PlusCircle className="mr-2 h-4 w-4 text-brand-rust" /> Add Box
                                        </Button>
                                    </div>

                                    <div className="space-y-6">
                                        {data.boxes.map((box, index) => (
                                            <div key={index} className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 p-6 space-y-6 shadow-sm">
                                                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-200/80 dark:border-zinc-800">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-800 text-white shadow-sm font-black text-sm">
                                                            {String(index + 1).padStart(2, '0')}
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">Box {String(index + 1).padStart(2, '0')}</p>
                                                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Package Specifications</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 ml-auto">
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Value</p>
                                                            <p className="text-lg font-black text-brand-rust">${getBoxPrice(box).toFixed(2)}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-800 pl-4">
                                                            <button type="button" onClick={() => duplicateBox(index)} className="p-2 text-zinc-400 hover:text-sky-500 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Duplicate Box">
                                                                <Copy className="size-4" />
                                                            </button>
                                                            {index > 0 && (
                                                                <button type="button" onClick={() => removeBox(index)} className="p-2 text-red-500 hover:text-red-700 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30" title="Remove Box">
                                                                    <X className="size-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-6 max-w-2xl">
                                                    <div className="space-y-4">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500">Box Dimensions</Label>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateBox(index, 'is_custom_size', !box.is_custom_size)}
                                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase transition-all ${
                                                                    box.is_custom_size ? 'bg-sky-600 text-white shadow-sm' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                                                                }`}
                                                            >
                                                                <Ruler className="size-3" /> Custom Size
                                                            </button>
                                                        </div>


                                                        {!box.is_custom_size ? (
                                                            <Field label="Box Type" required error={errors[`boxes.${index}.box_type_id`]}>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    {boxTypes?.filter((bt: any) => !bt.name?.toLowerCase().includes('cbm') && bt.name?.toLowerCase() !== 'custom box').map((bt: any) => {
                                                                        const hasPrice = (() => {
                                                                            if (!box.area_id) return true; // no area yet — allow selection
                                                                            if (data.pickup_zone_id) {
                                                                                const zonePrice = boxPrices?.find(
                                                                                    (p: any) => p.area_id?.toString() === box.area_id.toString()
                                                                                        && p.box_type_id?.toString() === bt.id.toString()
                                                                                        && p.pickup_zone_id?.toString() === data.pickup_zone_id.toString()
                                                                                        && parseFloat(p.price) > 0
                                                                                );
                                                                                if (zonePrice) return true;
                                                                            }
                                                                            const fallback = boxPrices?.find(
                                                                                (p: any) => p.area_id?.toString() === box.area_id.toString()
                                                                                    && p.box_type_id?.toString() === bt.id.toString()
                                                                                    && parseFloat(p.price) > 0
                                                                            );
                                                                            return !!fallback;
                                                                        })();

                                                                        const isSelected = box.box_type_id?.toString() === bt.id.toString();

                                                                        return (
                                                                            <button
                                                                                key={bt.id}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    if (!hasPrice) {
                                                                                        toast.error('Unable to select this box size — no price is configured for this area. Please contact customer support.');
                                                                                        return;
                                                                                    }
                                                                                    updateBox(index, 'box_type_id', bt.id.toString());
                                                                                }}
                                                                                title={!hasPrice ? 'No price configured — contact customer support' : (bt.dimensions || bt.name)}
                                                                                className={`relative flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                                                                                    !hasPrice
                                                                                        ? 'border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/50 opacity-50 cursor-not-allowed'
                                                                                        : isSelected
                                                                                            ? 'border-brand-rust bg-brand-warm/10 ring-2 ring-brand-rust/30 shadow-sm'
                                                                                            : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-brand-rust/50 hover:bg-brand-warm/5 cursor-pointer'
                                                                                }`}
                                                                            >
                                                                                <span className={`text-xs font-bold truncate w-full ${
                                                                                    !hasPrice ? 'text-zinc-400 dark:text-zinc-500' : isSelected ? 'text-brand-rust' : 'text-zinc-900 dark:text-zinc-100'
                                                                                }`}>
                                                                                    {bt.name}
                                                                                </span>
                                                                                {bt.dimensions && (
                                                                                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate w-full">
                                                                                        {bt.dimensions}
                                                                                    </span>
                                                                                )}
                                                                                {!hasPrice && box.area_id && (
                                                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                                                                        No price
                                                                                    </span>
                                                                                )}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </Field>

                                                        ) : (
                                                            <div className="grid grid-cols-3 gap-2">
                                                                <Field label="L (cm)" required error={errors[`boxes.${index}.custom_length`]}><Input type="number" step="0.1" className={baseInputClass} value={box.custom_length} onChange={e => updateBox(index, 'custom_length', e.target.value)} /></Field>
                                                                <Field label="W (cm)" required error={errors[`boxes.${index}.custom_width`]}><Input type="number" step="0.1" className={baseInputClass} value={box.custom_width} onChange={e => updateBox(index, 'custom_width', e.target.value)} /></Field>
                                                                <Field label="H (cm)" required error={errors[`boxes.${index}.custom_height`]}><Input type="number" step="0.1" className={baseInputClass} value={box.custom_height} onChange={e => updateBox(index, 'custom_height', e.target.value)} /></Field>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <form onSubmit={submit} className="space-y-8">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="space-y-8">
                                        <SectionCardHeader icon={CreditCard} title="Admin Payment Settings" subtitle="Configure payment status and reference overrides" />
                                        <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-6 space-y-4 shadow-sm">
                                            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-extrabold uppercase tracking-wider text-xs mb-2">
                                                <ShieldCheck className="size-4" /> Admin Payment Controls
                                            </div>
                                            <Field label="Payment Status" required error={errors.payment_status}>
                                                <select className={baseInputClass} value={data.payment_status} onChange={e => setData('payment_status', e.target.value)}>
                                                    <option value="pending">Pending</option>
                                                    <option value="balance_pending">Balance Pending</option>
                                                    <option value="partially_paid">Partially Paid</option>
                                                    <option value="paid">Paid</option>
                                                    <option value="cash_on_pickup">Cash on Pickup</option>
                                                </select>
                                            </Field>
                                            <Field label="Payment Method" required error={errors.payment_method}>
                                                <select className={baseInputClass} value={data.payment_method} onChange={e => setData('payment_method', e.target.value)}>
                                                    <option value="cash">Cash</option>
                                                    <option value="bank_transfer">Bank Transfer</option>
                                                    <option value="pay_id">Pay ID</option>
                                                    <option value="stripe">Stripe</option>
                                                    <option value="afterpay">Afterpay (+6.3%)</option>
                                                    <option value="square">Square</option>
                                                    <option value="cash_on_pickup">Cash on Pickup</option>
                                                </select>
                                            </Field>
                                            <Field label="Payment Reference" hint="e.g. Bank Transfer ID or Receipt No." error={errors.payment_reference}>
                                                <Input className={baseInputClass} value={data.payment_reference} onChange={e => setData('payment_reference', e.target.value)} />
                                            </Field>
                                            <Field label="Proof of Payment" hint="Upload image or PDF" error={errors.proof_of_payment}>
                                                <Input type="file" className={baseInputClass + " py-2.5"} onChange={e => setData('proof_of_payment', e.target.files?.[0] || null)} />
                                            </Field>
                                        </div>

                                        <SectionCardHeader icon={FileText} title="Documentation" subtitle="Declaration form upload & status" />
                                        <div className="space-y-4">
                                            <Field label="Declaration Form Status" required error={errors.declaration_form_status}>
                                                <select className={baseInputClass} value={data.declaration_form_status} onChange={e => setData('declaration_form_status', e.target.value)}>
                                                    <option value="missing">Missing</option>
                                                    <option value="submitted_online">Submitted Online</option>
                                                    <option value="physical_copy_received">Physical Copy Received</option>
                                                </select>
                                            </Field>
                                            <Field label="Declaration Form Upload" error={errors.declaration_form}>
                                                <Input type="file" className={baseInputClass + " py-2.5"} onChange={e => setData('declaration_form', e.target.files?.[0] || null)} />
                                            </Field>
                                        </div>
                                    </div>

                                    <div className="space-y-8">
                                        <SectionCardHeader icon={FileText} title="Notes & Final Receipt" subtitle="Order summary and internal notes" />
                                        <div className="space-y-4">
                                            <Field label="Public Notes (Visible to sender)" error={errors.notes}>
                                                <textarea className={baseInputClass + " min-h-[100px] py-3"} value={data.notes} onChange={e => setData('notes', e.target.value)} />
                                            </Field>
                                            <Field label="Admin Notes (Private)" error={errors.admin_notes}>
                                                <textarea className={baseInputClass + " min-h-[100px] py-3"} value={data.admin_notes} onChange={e => setData('admin_notes', e.target.value)} />
                                            </Field>
                                        </div>

                                        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-6 shadow-sm space-y-4">
                                            <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/40 pb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400">
                                                        <Receipt className="size-4" />
                                                    </div>
                                                    <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">Order Pricing Breakdown</p>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-md bg-emerald-100/80 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200/60 dark:border-emerald-800/60">AUD ($)</span>
                                            </div>
                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between items-center text-zinc-700 dark:text-zinc-300">
                                                    <span>Boxes Base Total ({data.boxes.length} {data.boxes.length === 1 ? 'box' : 'boxes'})</span>
                                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">${boxesBaseSubtotal.toFixed(2)}</span>
                                                </div>
                                                {doorToDoorTotal > 0 && (
                                                    <div className="flex justify-between items-center text-zinc-700 dark:text-zinc-300">
                                                        <span className="flex items-center gap-2">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                            Door-to-Door Delivery Add-On
                                                        </span>
                                                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">+${doorToDoorTotal.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {data.request_empty_box && (
                                                    <div className="flex justify-between items-center text-zinc-700 dark:text-zinc-300">
                                                        <span className="flex items-center gap-2">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                            Empty Box Delivery ({data.empty_box_count} @ $10.00)
                                                        </span>
                                                        <span className="font-semibold text-amber-700 dark:text-amber-400">+${(data.empty_box_count * 10).toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {data.payment_method === 'afterpay' && (
                                                    <div className="flex justify-between items-center text-zinc-700 dark:text-zinc-300">
                                                        <span className="flex items-center gap-2">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                                                            Afterpay Surcharge (6.3%)
                                                        </span>
                                                        <span className="font-semibold text-purple-700 dark:text-purple-400">+${afterpaySurcharge.toFixed(2)}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="pt-4 border-t border-emerald-200/80 dark:border-emerald-900/60 flex items-center justify-between bg-emerald-100/60 dark:bg-emerald-900/40 -mx-6 -mb-6 p-5 rounded-b-2xl">
                                                <div>
                                                    <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-950 dark:text-emerald-200">Total Estimate</p>
                                                    <p className="text-[11px] font-medium text-emerald-700/80 dark:text-emerald-400/80">Calculated order total</p>
                                                </div>
                                                <span className="text-2xl font-black text-emerald-800 dark:text-emerald-300 tracking-tight">${totalEstimate.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        )}

                        {/* Error Summary Banner */}
                        {Object.keys(errors).length > 0 && (
                            <div className="mt-8 rounded-2xl bg-red-50 dark:bg-red-950/20 p-5 border border-red-200 dark:border-red-900/50 shadow-sm">
                                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-2">
                                    <AlertTriangle className="size-4" />
                                    <p className="text-xs font-extrabold uppercase tracking-wider">Validation Errors</p>
                                </div>
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                                    {Object.entries(errors).map(([key, err], i) => (
                                        <li key={i} className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                            {getFriendlyError(key, err as string)}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Bottom Sticky Action Bar */}
                        <div className="flex items-center justify-between gap-4 mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                            {currentStep > 1 ? (
                                <Button type="button" variant="outline" onClick={prevStep} disabled={processing} className="w-36 h-11 rounded-xl font-bold border-zinc-200 dark:border-zinc-800">
                                    <ArrowLeft className="mr-2 size-4" /> Back
                                </Button>
                            ) : <div></div>}

                            {currentStep < 3 ? (
                                <Button
                                    type="button"
                                    onClick={nextStep}
                                    disabled={currentStep === 2 && data.boxes.some(b => !b.is_custom_size && !b.box_type_id)}
                                    className="w-48 h-11 rounded-xl bg-brand-rust hover:bg-brand-rust/90 text-white font-bold flex gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Continue <ArrowRight className="size-4" />
                                </Button>
                            ) : (
                                <Button type="button" onClick={submit} disabled={processing} className="w-52 h-11 rounded-xl bg-brand-rust hover:bg-brand-rust/90 text-white font-bold flex gap-2 shadow-md">
                                    Create Booking <CheckCircle className="size-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
