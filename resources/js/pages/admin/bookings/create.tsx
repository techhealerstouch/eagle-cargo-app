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
    Check,
    ChevronRight,
    RotateCcw,
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
    Receipt,
    Ticket,
    Tag,
    Loader2,
    Clock,
    Users
} from 'lucide-react';
import React, { useCallback, useMemo, useState, useEffect } from 'react';
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

function StepIndicator({
    step,
    onStepClick,
    step1Summary,
    step2Summary,
}: {
    step: number;
    onStepClick?: (step: number) => void;
    step1Summary?: string;
    step2Summary?: string;
}) {
    const steps = [
        { id: 1, label: 'Sender & Pickup', shortLabel: 'Sender', icon: User, summary: step1Summary },
        { id: 2, label: 'Boxes & Destinations', shortLabel: 'Cargo', icon: Package, summary: step2Summary },
        { id: 3, label: 'Review & Admin Options', shortLabel: 'Review', icon: ShieldCheck }
    ];

    return (
        <nav aria-label="Booking steps" className="w-full">
            <ol className="flex items-center gap-1.5 sm:gap-2">
                {steps.map((item, idx) => {
                    const isActive = step === item.id;
                    const isDone = step > item.id;
                    const isClickable = Boolean(isDone && onStepClick);

                    return (
                        <li key={item.id} className="flex-1 min-w-0 flex items-center">
                            <button
                                type="button"
                                disabled={!isClickable}
                                onClick={() => {
                                    if (isClickable && onStepClick) {
                                        onStepClick(item.id);
                                    }
                                }}
                                className={cn(
                                    "w-full flex items-center justify-between gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl text-left transition-all select-none",
                                    isActive && "bg-white dark:bg-zinc-800 shadow-xs border border-zinc-200/90 dark:border-zinc-700 ring-1 ring-brand-rust/20",
                                    isClickable && "hover:bg-white/90 dark:hover:bg-zinc-800/90 cursor-pointer group hover:border-zinc-300 dark:hover:border-zinc-700 border border-transparent",
                                    !isActive && !isDone && "opacity-60 cursor-default border border-transparent"
                                )}
                                title={isClickable ? `Click to jump back to Step ${item.id}: ${item.label}` : undefined}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span
                                        className={cn(
                                            "flex size-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition-transform",
                                            isActive && "bg-brand-rust text-white shadow-2xs",
                                            isDone && "bg-emerald-600 text-white group-hover:scale-105",
                                            !isActive && !isDone && "bg-zinc-200 dark:bg-zinc-700/80 text-zinc-600 dark:text-zinc-400"
                                        )}
                                    >
                                        {isDone ? <Check className="size-3.5 stroke-[2.5]" /> : item.id}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p
                                                className={cn(
                                                    "text-xs font-bold truncate leading-tight",
                                                    isActive && "text-zinc-900 dark:text-zinc-100",
                                                    isDone && "text-zinc-700 dark:text-zinc-300 group-hover:text-brand-rust dark:group-hover:text-brand-warm",
                                                    !isActive && !isDone && "text-zinc-400 dark:text-zinc-500"
                                                )}
                                            >
                                                <span className="md:hidden">{item.shortLabel}</span>
                                                <span className="hidden md:inline">{item.label}</span>
                                            </p>
                                            {isDone && (
                                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 hidden xl:inline">
                                                    ✓ Done
                                                </span>
                                            )}
                                        </div>
                                        {isDone && item.summary && (
                                            <p className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 truncate hidden lg:block leading-tight mt-0.5">
                                                {item.summary}
                                            </p>
                                        )}
                                        {isActive && (
                                            <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 truncate hidden sm:block leading-tight mt-0.5">
                                                In progress
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {isClickable && (
                                    <span className="text-[10px] font-semibold text-zinc-400 group-hover:text-brand-rust dark:group-hover:text-brand-warm hidden xl:inline shrink-0">
                                        Edit
                                    </span>
                                )}
                            </button>
                            {idx < steps.length - 1 && (
                                <ChevronRight className="size-4 text-zinc-300 dark:text-zinc-600 shrink-0 mx-0.5 select-none hidden sm:block" />
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
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
    secondary_mobile?: string | null;
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
    activePromotions = [],
}: {
    senders: Sender[];
    areas: any[];
    provinces: any[];
    boxTypes: any[];
    boxPrices: any[];
    pickers: any[];
    pickupZones?: any[];
    activePromotions?: any[];
}) {
    const [currentStep, setCurrentStep] = useState(1);
    const [promoCodeInput, setPromoCodeInput] = useState('');
    const [validatingPromo, setValidatingPromo] = useState(false);
    const [promoError, setPromoError] = useState('');
    const [promoSuccessMessage, setPromoSuccessMessage] = useState('');
    const [discountAmount, setDiscountAmount] = useState(0);

    const { data, setData, post, processing, errors, clearErrors, setError } = useForm({
        is_new_sender: false,
        sender_id: '',
        sender_first_name: '',
        sender_last_name: '',
        sender_email: '',
        sender_mobile: '',
        sender_secondary_mobile: '',
        sender_address: '',
        sender_suburb: '',
        sender_state: '',
        sender_postcode: '',
        pickup_zone_id: '',
        status: 'pending',
        booking_type: 'home_pickup',
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
        promo_code: '',
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
                recipient_secondary_phone: '',
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
            label: `${c.first_name} ${c.last_name} (${c.email})`,
            sender: c
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

            if (data.request_empty_box && (!data.empty_box_count || data.empty_box_count < 1)) {
                setError('empty_box_count', 'Empty box count must be at least 1.');
                isValid = false;
            }
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
                    recipient_secondary_phone: master.recipient_secondary_phone || '',
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
                recipient_secondary_phone: master.recipient_secondary_phone || '',
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
                sender_secondary_mobile: selected.secondary_mobile || '',
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
    const afterpaySurcharge = data.payment_method === 'afterpay' ? Math.round(Math.max(0, baseSubtotal - discountAmount) * 0.063 * 100) / 100 : 0;
    const totalEstimate = Math.max(0, baseSubtotal - discountAmount) + afterpaySurcharge;

    const getPromoBadge = (promo: any) => {
        switch (promo.type) {
            case 'percentage_discount':
                return `${Number(promo.value)}% OFF`;
            case 'fixed_discount':
                return `$${Number(promo.value).toFixed(0)} OFF`;
            case 'per_box_discount':
                return `$${Number(promo.value).toFixed(0)}/Box OFF`;
            case 'waive_empty_box_fee':
                return 'FREE BOX FEE';
            case 'buy_x_get_y_free':
                return `BUY ${promo.buy_quantity} GET ${promo.free_quantity} FREE`;
            default:
                return 'PROMO';
        }
    };

    const getPromoLifespan = (promo: any) => {
        if (!promo.valid_to) {
            if (promo.valid_from) {
                return `Since ${format(new Date(promo.valid_from), 'MMM d, yyyy')} • Ongoing`;
            }
            return 'Ongoing • No expiry';
        }

        try {
            const endDate = new Date(promo.valid_to);
            const now = new Date();
            const diffTime = endDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                return 'Expired';
            }
            if (diffDays === 0) {
                return 'Ends today';
            }
            if (diffDays === 1) {
                return 'Ends tomorrow';
            }
            if (diffDays <= 30) {
                return `${diffDays} days left (ends ${format(endDate, 'MMM d')})`;
            }
            return `Valid until ${format(endDate, 'MMM d, yyyy')}`;
        } catch (e) {
            return 'Active';
        }
    };

    const getPromoUsageStats = (promo: any) => {
        const uses = Number(promo.uses_count || 0);
        if (promo.max_uses) {
            const max = Number(promo.max_uses);
            const remaining = Math.max(0, max - uses);
            return `${uses}/${max} redeemed (${remaining} left)`;
        }
        return `${uses} redeemed • Unlimited`;
    };

    const handleApplyPromo = async (codeToUse?: string) => {
        const targetCode = (codeToUse !== undefined ? codeToUse : promoCodeInput).trim().toUpperCase();
        if (!targetCode) {
            setData('promo_code', '');
            setDiscountAmount(0);
            setPromoError('');
            setPromoSuccessMessage('');
            setPromoCodeInput('');
            return;
        }

        setPromoCodeInput(targetCode);
        setValidatingPromo(true);
        setPromoError('');
        setPromoSuccessMessage('');

        try {
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
                recipient_secondary_phone: masterRecipient.recipient_secondary_phone,
                recipient_landmarks: masterRecipient.recipient_landmarks,
            }));

            const getXsrfToken = () => {
                const match = document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'));
                return match ? decodeURIComponent(match[3]) : '';
            };

            const response = await fetch('/api/promotions/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
                body: JSON.stringify({
                    code: targetCode,
                    promo_code: targetCode,
                    sender_id: data.sender_id || null,
                    boxes: normalizedBoxes.map((box: any) => ({
                        ...box,
                        price: getBoxPrice(box)
                    })),
                    subtotal: baseSubtotal,
                    empty_box_count: data.request_empty_box ? data.empty_box_count : 0,
                    empty_box_fee: data.empty_box_fee,
                }),
            });

            const result = await response.json();

            if (response.ok && result.valid) {
                if (data.promo_code !== targetCode) {
                    setData('promo_code', targetCode);
                }
                setDiscountAmount(result.discount_amount);
                setPromoSuccessMessage(`Promo applied! Saved $${result.discount_amount.toFixed(2)}`);
            } else {
                setData('promo_code', '');
                setDiscountAmount(0);
                setPromoError(result.message || 'Invalid promo code');
            }
        } catch (error) {
            console.error('Error validating promo code:', error);
            setData('promo_code', '');
            setDiscountAmount(0);
            setPromoError('Failed to validate promo code. Please try again.');
        } finally {
            setValidatingPromo(false);
        }
    };

    // Auto-revalidate/calculate discount if promo_code is restored from auto-save or if items change
    useEffect(() => {
        if (data.promo_code) {
            setPromoCodeInput(data.promo_code);
            handleApplyPromo(data.promo_code);
        } else if (discountAmount > 0) {
            setDiscountAmount(0);
            setPromoSuccessMessage('');
        }
    }, [data.promo_code, baseSubtotal]);

    const handleRemovePromo = () => {
        setData('promo_code', '');
        setPromoCodeInput('');
        setDiscountAmount(0);
        setPromoError('');
        setPromoSuccessMessage('');
    };

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
            recipient_secondary_phone: masterRecipient.recipient_secondary_phone,
            recipient_landmarks: masterRecipient.recipient_landmarks,
        }));

        setData('boxes', normalizedBoxes);

        post('/admin/bookings', {
            forceFormData: true,
            onSuccess: () => clearSavedData(),
            onError: (errs) => {
                const hasSenderErrors = Object.keys(errs).some(k => k.startsWith('sender_') || k === 'is_new_sender' || k === 'picker_id' || k === 'preferred_date' || k === 'status' || k === 'booking_type' || k === 'pickup_zone_id');
                const hasBoxErrors = Object.keys(errs).some(k => k.startsWith('boxes') || k.startsWith('empty_box') || k === 'request_empty_box');

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

    const step1Summary = useMemo(() => {
        if (data.is_new_sender) {
            const name = `${data.sender_first_name} ${data.sender_last_name}`.trim();
            return name ? `${name}${data.preferred_date ? ` • ${data.preferred_date}` : ''}` : 'New Customer';
        }
        if (data.sender_id) {
            const found = senders?.find((s: any) => s.id?.toString() === data.sender_id?.toString());
            if (found) {
                return `${found.first_name} ${found.last_name}${data.preferred_date ? ` • ${data.preferred_date}` : ''}`;
            }
            return 'Selected Sender';
        }
        return undefined;
    }, [data.is_new_sender, data.sender_first_name, data.sender_last_name, data.sender_id, data.preferred_date, senders]);

    const step2Summary = useMemo(() => {
        const count = data.boxes.length;
        const dest = data.boxes[0]?.recipient_city || data.boxes[0]?.recipient_province;
        if (dest) {
            return `${count} ${count === 1 ? 'Box' : 'Boxes'} • ${dest}`;
        }
        return `${count} ${count === 1 ? 'Box' : 'Boxes'}`;
    }, [data.boxes]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Create Booking - Admin" />

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Unified Hero Header & Steps Card (Option B) */}
                <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                    {/* Top Row: Title, Description & Action Badges */}
                    <div className="p-5 sm:p-6 pb-4 sm:pb-5">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            {/* Left: Back Button & Title */}
                            <div className="flex items-center gap-3.5">
                                <Link
                                    href="/admin/bookings"
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors shadow-2xs"
                                    title="Back to bookings"
                                >
                                    <ArrowLeft className="size-4" />
                                </Link>
                                <div>
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                                            Create Admin Booking
                                        </h1>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-brand-warm/30 dark:bg-brand-rust/30 text-brand-rust dark:text-brand-warm text-[10px] font-extrabold uppercase tracking-wide border border-brand-rust/15">
                                            Manual Order
                                        </span>
                                    </div>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                        Direct manual order creation with single-recipient & add-on management
                                    </p>
                                </div>
                            </div>

                            {/* Right: Autosave Status, Reset Form & Live Order Summary */}
                            <div className="flex items-center gap-2.5 self-start lg:self-center flex-wrap">
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span>Auto-saving</span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (confirm('Reset this booking form and clear all inputs?')) {
                                            clearSavedData();
                                            window.location.reload();
                                        }
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors cursor-pointer"
                                    title="Reset form"
                                >
                                    <RotateCcw className="size-3.5" /> <span>Reset</span>
                                </button>

                                <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 shadow-2xs">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 text-brand-rust dark:text-brand-warm shrink-0">
                                        <Package className="size-4 text-brand-secondary" />
                                    </div>
                                    <div className="text-right leading-tight">
                                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                            Current Order Summary
                                        </p>
                                        <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">
                                            <span>{data.boxes.length} {data.boxes.length === 1 ? 'Box' : 'Boxes'}</span>
                                            <span className="mx-1.5 text-zinc-300 dark:text-zinc-700">•</span>
                                            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">${totalEstimate.toFixed(2)}</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Integrated Step Indicator Ribbon */}
                    <div className="border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/60 p-2 sm:px-4 sm:py-2.5">
                        <StepIndicator
                            step={currentStep}
                            onStepClick={(s) => setCurrentStep(s)}
                            step1Summary={step1Summary}
                            step2Summary={step2Summary}
                        />
                    </div>
                </div>

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
                                            <div className="md:col-span-2">
                                                <Field label="Email Address" required error={errors.sender_email}>
                                                    <Input className={baseInputClass} type="email" value={data.sender_email} onChange={e => setData('sender_email', e.target.value)} />
                                                </Field>
                                            </div>
                                            <Field label="Primary Contact Phone" required error={errors.sender_mobile}>
                                                <PhoneInput value={data.sender_mobile} onChange={val => setData('sender_mobile', val)} defaultCountryCode="AU" />
                                            </Field>
                                            <Field label="Secondary Phone Number" hint="Optional" error={errors.sender_secondary_mobile}>
                                                <PhoneInput value={data.sender_secondary_mobile} onChange={val => setData('sender_secondary_mobile', val)} defaultCountryCode="AU" />
                                            </Field>
                                            <div className="md:col-span-2">
                                                <Field label="Full Address" required error={errors.sender_address}>
                                                    <Input className={baseInputClass} value={data.sender_address} onChange={e => setData('sender_address', e.target.value)} />
                                                </Field>
                                            </div>
                                        </div>
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
                                        <Field label="Collection Method" required error={errors.booking_type}>
                                            <select className={baseInputClass} value={data.booking_type} onChange={e => setData('booking_type', e.target.value)}>
                                                <option value="home_pickup">Home Pickup</option>
                                                <option value="drop_off">Drop Off (Warehouse)</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </Field>
                                        {data.status === 'collected' && (
                                            <Field label="Picker Name" error={errors.picker_id} hint="Assign a picker for reference and serial auto-assignment.">
                                                <select className={baseInputClass} value={data.picker_id} onChange={e => setData('picker_id', e.target.value)}>
                                                    <option value="">Select a picker (Optional)...</option>
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
                                        <div className="md:col-span-2">
                                            <Field label="Email Address" error={errors['boxes.0.recipient_email']}>
                                                <Input className={baseInputClass} type="email" value={data.boxes[0]?.recipient_email || ''} onChange={e => updatePrimaryRecipient('recipient_email', e.target.value)} />
                                            </Field>
                                        </div>
                                        <Field label="Primary Mobile Number" required error={errors['boxes.0.recipient_phone']}>
                                            <PhoneInput value={data.boxes[0]?.recipient_phone || ''} onChange={val => updatePrimaryRecipient('recipient_phone', val)} defaultCountryCode="PH" />
                                        </Field>
                                        <Field label="Secondary Contact Number" hint="Optional" error={errors['boxes.0.recipient_secondary_phone']}>
                                            <PhoneInput value={data.boxes[0]?.recipient_secondary_phone || ''} onChange={val => updatePrimaryRecipient('recipient_secondary_phone', val)} defaultCountryCode="PH" />
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

                                {/* Empty Box Delivery Request */}
                                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20 p-6 space-y-4 shadow-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 shadow-sm font-black text-sm">
                                                <Truck className="size-5" />
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">Add-On Service</p>
                                                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Empty Box Delivery Service</h4>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="request-empty-box"
                                                checked={data.request_empty_box}
                                                onCheckedChange={(checked) => setData('request_empty_box', !!checked)}
                                            />
                                            <label htmlFor="request-empty-box" className="text-xs font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                                                Request Delivery <span className="text-amber-600 dark:text-amber-400 font-extrabold">($10.00 each)</span>
                                            </label>
                                        </div>
                                    </div>

                                    {data.request_empty_box && (
                                        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-amber-200/60 dark:border-amber-900/40">
                                            <div>
                                                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Quantity of Empty Boxes</p>
                                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Boxes delivered to sender address prior to scheduled collection</p>
                                            </div>
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
                                                <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400 ml-2">(+${(data.empty_box_count * 10).toFixed(2)})</span>
                                            </div>
                                        </div>
                                    )}
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

                                        <SectionCardHeader icon={Ticket} title="Promotions & Vouchers" subtitle="Apply voucher codes or select from active campaigns" />
                                        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 p-5 space-y-4 shadow-sm">
                                            {/* Manual Code Input Bar */}
                                            <div>
                                                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-2">
                                                    Voucher Code
                                                </label>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                                                            <Tag className="size-4" />
                                                        </div>
                                                        <Input
                                                            type="text"
                                                            value={promoCodeInput}
                                                            onChange={(e) => {
                                                                const val = e.target.value.toUpperCase();
                                                                setPromoCodeInput(val);
                                                                if (data.promo_code && val !== data.promo_code) {
                                                                    setData('promo_code', '');
                                                                    setDiscountAmount(0);
                                                                    setPromoSuccessMessage('');
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleApplyPromo();
                                                                }
                                                            }}
                                                            placeholder="Enter promo code (e.g. SAVE10)"
                                                            className="pl-10 h-11 uppercase font-bold tracking-wider placeholder:normal-case placeholder:font-normal bg-white dark:bg-zinc-900"
                                                            disabled={validatingPromo}
                                                        />
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        onClick={() => handleApplyPromo()}
                                                        disabled={!promoCodeInput.trim() || validatingPromo}
                                                        className="h-11 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-all disabled:opacity-50 shrink-0"
                                                    >
                                                        {validatingPromo ? (
                                                            <span className="flex items-center gap-1.5">
                                                                <Loader2 className="size-4 animate-spin" />
                                                                Applying...
                                                            </span>
                                                        ) : (
                                                            'Apply'
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Active / Applied Voucher Banner */}
                                            {data.promo_code && discountAmount > 0 && (
                                                <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3.5 border border-emerald-200 dark:border-emerald-900/50">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="size-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-black">
                                                            <CheckCircle className="size-4" />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                                                                    {data.promo_code}
                                                                </span>
                                                                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-100">
                                                                    -${discountAmount.toFixed(2)} OFF
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                                                                {promoSuccessMessage}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={handleRemovePromo}
                                                        className="text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                                        title="Remove voucher"
                                                    >
                                                        <X className="size-4" />
                                                    </button>
                                                </div>
                                            )}

                                            {/* Error Message */}
                                            {promoError && (
                                                <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 p-3.5 border border-red-200 dark:border-red-900/50">
                                                    <AlertTriangle className="size-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                                                    <p className="text-xs font-medium text-red-900 dark:text-red-200">{promoError}</p>
                                                </div>
                                            )}

                                            {/* Shopee-style Available Vouchers Cards */}
                                            {activePromotions && activePromotions.length > 0 && (
                                                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                                            <Sparkles className="size-3.5 text-amber-500" />
                                                            Available Vouchers ({activePromotions.length})
                                                        </span>
                                                        <span className="text-[11px] text-zinc-400">1-Click Apply</span>
                                                    </div>

                                                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                                        {activePromotions.map((promo: any) => {
                                                            const isApplied = Boolean(data.promo_code && data.promo_code === promo.code && discountAmount > 0);
                                                            return (
                                                                <div
                                                                    key={promo.id || promo.code}
                                                                    className={cn(
                                                                        "relative flex items-center justify-between p-3 rounded-xl border transition-all",
                                                                        isApplied
                                                                            ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-sm"
                                                                            : "bg-white dark:bg-zinc-900/70 border-zinc-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-sm"
                                                                    )}
                                                                >
                                                                    {/* Left: Badge / Discount Tag */}
                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                        <div className={cn(
                                                                            "flex flex-col items-center justify-center px-2.5 py-2 rounded-lg font-black text-center shrink-0 min-w-[76px]",
                                                                            isApplied
                                                                                ? "bg-emerald-600 text-white"
                                                                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                                                                        )}>
                                                                            <span className="text-xs uppercase tracking-tight">{getPromoBadge(promo)}</span>
                                                                        </div>

                                                                        <div className="min-w-0">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <span className="font-mono font-extrabold text-xs text-zinc-900 dark:text-zinc-100 tracking-wide">
                                                                                    {promo.code}
                                                                                </span>
                                                                                {promo.name && (
                                                                                    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 truncate max-w-[150px]">
                                                                                        • {promo.name}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            
                                                                            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 flex-wrap">
                                                                                {promo.min_spend > 0 && (
                                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-medium">
                                                                                        Min. ${Number(promo.min_spend).toFixed(0)}
                                                                                    </span>
                                                                                )}
                                                                                {promo.min_box_count > 1 && (
                                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-medium">
                                                                                        Min. {promo.min_box_count} Boxes
                                                                                    </span>
                                                                                )}
                                                                                {promo.max_discount && (
                                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-medium">
                                                                                        Max -${Number(promo.max_discount).toFixed(0)}
                                                                                    </span>
                                                                                )}
                                                                                {promo.first_time_sender_only && (
                                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 text-[10px] font-medium">
                                                                                        1st Order
                                                                                    </span>
                                                                                )}
                                                                            </div>

                                                                            {/* Strategy & Lifespan Meta */}
                                                                            <div className="flex items-center gap-1.5 text-[10px] mt-1.5 flex-wrap">
                                                                                <span className={cn(
                                                                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold",
                                                                                    promo.valid_to
                                                                                        ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40"
                                                                                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                                                                                )}>
                                                                                    <Clock className="size-3 shrink-0" />
                                                                                    {getPromoLifespan(promo)}
                                                                                </span>

                                                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-900/40">
                                                                                    <Users className="size-3 shrink-0" />
                                                                                    {getPromoUsageStats(promo)}
                                                                                </span>

                                                                                {promo.max_uses_per_user && (
                                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px]">
                                                                                        {promo.max_uses_per_user}x / sender
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Right: 1-click Action Button */}
                                                                    <div className="shrink-0 ml-3">
                                                                        {isApplied ? (
                                                                            <Button
                                                                                type="button"
                                                                                size="sm"
                                                                                variant="outline"
                                                                                onClick={handleRemovePromo}
                                                                                className="h-8 px-3 text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/30"
                                                                            >
                                                                                Remove
                                                                            </Button>
                                                                        ) : (
                                                                            <Button
                                                                                type="button"
                                                                                size="sm"
                                                                                onClick={() => handleApplyPromo(promo.code)}
                                                                                disabled={validatingPromo}
                                                                                className="h-8 px-3.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all"
                                                                            >
                                                                                Use
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
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
                                                {discountAmount > 0 && (
                                                    <div className="flex justify-between items-center text-zinc-700 dark:text-zinc-300 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                                                        <span className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
                                                            <Sparkles className="size-3.5" />
                                                            Promo Discount ({data.promo_code})
                                                        </span>
                                                        <span className="font-black text-emerald-700 dark:text-emerald-400">-${discountAmount.toFixed(2)}</span>
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
