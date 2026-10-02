import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { Package, MapPinned, MapPin, Info, X, PlusCircle, CheckCircle, Check, ChevronRight, ChevronDown, ArrowLeft, ArrowRight, Wallet, Save, AlertTriangle, ShieldCheck, CalendarIcon, Loader2, Ruler, Lock, Tag, Clock, Sparkles, User, Truck, Building2, Minus, ExternalLink } from 'lucide-react';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import Heading from '@/components/common/heading';
import PaymentFlow from '@/components/payment/PaymentFlow';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import LocationPickerMap from '@/components/ui/LocationPickerMap';
import PhoneInput from '@/components/ui/PhoneInput';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAutoSave } from '@/hooks/use-auto-save';
import { SuburbSelect } from '@/components/ui/SuburbSelect';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import { validatePhone, COUNTRIES } from '@/lib/countries';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

const AUSTRALIAN_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

const baseInputClass = 'h-12 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400';

function StepIndicator({
    step,
    isGuest = false,
    onStepClick,
    step1Summary,
    step2Summary,
    step3Summary,
    mode = 'all',
}: {
    step: number;
    isGuest?: boolean;
    onStepClick?: (step: number) => void;
    step1Summary?: string;
    step2Summary?: string;
    step3Summary?: string;
    mode?: 'mobile' | 'desktop' | 'all';
}) {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const steps = [
        { id: 1, label: 'Sender & Pickup', shortLabel: 'Sender', icon: User, summary: step1Summary },
        { id: 2, label: 'Boxes & Recipients', shortLabel: 'Cargo', icon: Package, summary: step2Summary },
        { id: 3, label: 'Review Details', shortLabel: 'Review', icon: ShieldCheck, summary: step3Summary },
        { id: 4, label: 'Payment & Confirmation', shortLabel: 'Payment', icon: Wallet },
    ];

    const currentStepObj = steps.find((s) => s.id === step) || steps[0];

    const renderMobile = () => (
        <div className="w-full select-none">
            {/* Top row: Active step circle + STEP X OF 4 + Label + All steps button */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-sm shadow-xs">
                        {step}
                    </span>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 leading-none">
                            STEP {step} OF {steps.length}
                        </p>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate mt-1">
                            {currentStepObj.label}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors shrink-0 shadow-2xs"
                    aria-expanded={isMobileMenuOpen}
                >
                    <span>All steps</span>
                    <ChevronDown className={cn("size-3.5 transition-transform duration-200", isMobileMenuOpen && "rotate-180")} />
                </button>
            </div>

            {/* Segmented Progress Bar */}
            <div className="flex items-center gap-2 mt-3.5">
                {steps.map((item) => {
                    const isFilled = item.id <= step;
                    return (
                        <div
                            key={item.id}
                            className={cn(
                                "h-1.5 rounded-full flex-1 transition-all duration-300",
                                isFilled ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-800"
                            )}
                        />
                    );
                })}
            </div>

            {/* Collapsible Step Menu */}
            {isMobileMenuOpen && (
                <div className="mt-3.5 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    {steps.map((item) => {
                        const isActive = step === item.id;
                        const isDone = step > item.id;
                        const isClickable = Boolean(isDone && onStepClick);

                        return (
                            <button
                                key={item.id}
                                type="button"
                                disabled={!isClickable}
                                onClick={() => {
                                    if (isClickable && onStepClick) {
                                        onStepClick(item.id);
                                        setIsMobileMenuOpen(false);
                                    }
                                }}
                                className={cn(
                                    "w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-colors",
                                    isActive && "bg-zinc-100 dark:bg-zinc-800/80 font-bold",
                                    isClickable && "hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer",
                                    !isActive && !isDone && "opacity-50 cursor-default"
                                )}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span
                                        className={cn(
                                            "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                            isActive && "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900",
                                            isDone && "bg-emerald-600 text-white",
                                            !isActive && !isDone && "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                                        )}
                                    >
                                        {isDone ? <Check className="size-3.5 stroke-[2.5]" /> : item.id}
                                    </span>
                                    <span className={cn(
                                        "text-xs truncate",
                                        isActive ? "font-bold text-zinc-900 dark:text-zinc-100" : "font-medium text-zinc-700 dark:text-zinc-300"
                                    )}>
                                        {item.label}
                                    </span>
                                </div>

                                {isDone && (
                                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                                        Completed • Edit
                                    </span>
                                )}
                                {isActive && (
                                    <span className="text-[10px] font-semibold text-zinc-400 shrink-0">
                                        Current
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );

    const renderDesktop = () => (
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
    );

    return (
        <nav aria-label="Booking steps" className="w-full">
            {mode === 'mobile' ? renderMobile() : mode === 'desktop' ? renderDesktop() : (
                <>
                    <div className="md:hidden">{renderMobile()}</div>
                    <div className="hidden md:block">{renderDesktop()}</div>
                </>
            )}
        </nav>
    );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <div className="space-y-1 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <h3 className="font-serif text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{title}</h3>
            {subtitle ? <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
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
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {label}
                {required ? <span className="ml-1 text-red-500">*</span> : null}
            </label>
            {children}
            {hint ? <p className="text-xs text-zinc-400 dark:text-zinc-500">{hint}</p> : null}
            {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
        </div>
    );
}


interface PageProps {
    areas?: any[];
    provinces?: any[];
    boxTypes?: any[];
    boxPrices?: any[];
    pickupZones?: any[];
    suburbs?: any[];
    savedRecipients?: any[];
    cloneSource?: any;
    editingBooking?: any;
    draftBooking?: any;
    sender?: any;
    logistics?: any;
    activePromotions?: any[];
    isGuest?: boolean;
}

export default function Book(props?: PageProps) {
  const pageProps = usePage().props as any;
  const mergedProps = { ...pageProps, ...(props || {}) };
  const isGuest = Boolean(props?.isGuest || mergedProps.isGuest || !mergedProps.auth?.user);
  const { auth, areas, provinces, boxTypes, boxPrices, pickupZones, suburbs = [], savedRecipients, cloneSource, editingBooking, draftBooking, sender, logistics, activePromotions = [] } = mergedProps;

  const depotAddress = logistics?.depotAddress || '6 Ivan St, Arundel QLD 4214';
  const depotInstructions = logistics?.depotInstructions || '';

  const senderCountry = editingBooking?.sender?.country || sender?.country || 'Australia';
  const senderCountryCode = COUNTRIES.find(c => c.name === senderCountry)?.code || 'AU';

  const [currentStep, setCurrentStep] = useState(1);
  const [isEditingSender, setIsEditingSender] = useState(isGuest || !sender || !sender.address);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [, setIsLocating] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(draftBooking?.id || null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [initializingPayment, setInitializingPayment] = useState(false);
  const [initializedBookingId, setInitializedBookingId] = useState<number | null>(editingBooking?.id || null);
  const [hasSubmittedBooking, setHasSubmittedBooking] = useState(false);
  const [initializationKey] = useState(() => {
    if (editingBooking) {
      return null;
    }

    if (typeof window === 'undefined') {
      return null;
    }

    const storageKey = 'booking_initialization_key';
    const existingKey = localStorage.getItem(storageKey);

    if (existingKey) {
      return existingKey;
    }

    const key = crypto.randomUUID();

    localStorage.setItem(storageKey, key);

    return key;
  });
  const [paymentData, setPaymentData] = useState<any>(null);
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [promoSuccessMessage, setPromoSuccessMessage] = useState<string | null>(null);
  const hasAppliedDraftSource = useRef(false);
  const hasAppliedQueryDefaults = useRef(false);
  const hasAppliedCloneSource = useRef(false);
  const hasAppliedEditSource = useRef(false);
  const user = auth?.user;

  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Home', href: '/dashboard' },
    { title: editingBooking ? 'Edit Booking' : 'Book a Pickup', href: editingBooking ? `/bookings/${editingBooking.id}/edit` : '/book' },
  ];

  const formatTime = (time: string) => {
    try {
      const [hh, mm] = time.split(':');

      const date = new Date();
      date.setHours(parseInt(hh), parseInt(mm));

      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return time;
    }
  };



  const resolveZoneIdForSuburb = useCallback((suburbStr: string) => {
    if (!suburbStr || typeof suburbStr !== 'string') return '';
    const searchStr = suburbStr.toLowerCase().trim();
    if (!searchStr) return '';

    // 1. Check active suburbs list
    const found = (suburbs || []).find(
      (s: any) => s.name?.toLowerCase().trim() === searchStr
    );
    if (found?.pickup_zone_id) {
      return String(found.pickup_zone_id);
    }

    // 2. Check each pickup zone's suburbs list
    for (const zone of (pickupZones || [])) {
      if (zone.suburbs && Array.isArray(zone.suburbs)) {
        const matches = zone.suburbs.some((s: any) => {
          const name = typeof s === 'string' ? s : (s.name || '');
          return name.toLowerCase().trim() === searchStr;
        });
        if (matches) {
          return String(zone.id);
        }
      }
    }

    // 3. Suburb keyword in zone name fallback (e.g. Geelong in Ballarat/Geelong zone)
    for (const zone of (pickupZones || [])) {
      const zoneNameLower = (zone.name || '').toLowerCase();
      if (searchStr.length >= 4 && zoneNameLower.includes(searchStr)) {
        return String(zone.id);
      }
    }

    return '';
  }, [suburbs, pickupZones]);

  // Backward compatibility alias
  const detectPickupZoneBySuburb = resolveZoneIdForSuburb;

  const parseLogisticsWindows = useCallback((rawWindowsInput: any) => {
    const recurring: any[] = [];
    const specificDates: Record<string, { available: boolean; time_start?: string; time_end?: string; label?: string }> = {};

    if (!rawWindowsInput) return { recurring, specificDates };

    let raw = rawWindowsInput;
    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch {
        return { recurring, specificDates };
      }
    }

    const toArray = (val: any): any[] => {
      if (Array.isArray(val)) return val;
      if (val && typeof val === 'object') return Object.values(val);
      return [];
    };

    // Case 1: Structured object with { weekly, specific_dates }
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && ('weekly' in raw || 'specific_dates' in raw)) {
      if (raw.weekly) {
        const weeklyItems = toArray(raw.weekly);
        weeklyItems.forEach((w: any) => {
          if (!w || typeof w !== 'object') return;
          const days = toArray(w.days).map(Number).filter((n: number) => !isNaN(n));
          if (days.length > 0) {
            recurring.push({
              ...w,
              days,
              weeks_of_month: w.weeks_of_month ? toArray(w.weeks_of_month).map(Number).filter((n: number) => !isNaN(n)) : undefined,
            });
          }
        });
      }
      if (raw.specific_dates && typeof raw.specific_dates === 'object') {
        Object.entries(raw.specific_dates).forEach(([dateStr, config]: [string, any]) => {
          if (typeof config === 'object' && config !== null) {
            specificDates[dateStr] = {
              available: Boolean(config.available ?? config.enabled ?? true),
              time_start: config.time_start || '08:00',
              time_end: config.time_end || '17:00',
              label: config.label,
            };
          } else {
            specificDates[dateStr] = {
              available: Boolean(config),
              time_start: '08:00',
              time_end: '17:00',
            };
          }
        });
      }
      return { recurring, specificDates };
    }

    // Case 2: Array or object of window items
    const items = toArray(raw);
    items.forEach((item: any) => {
      if (!item || typeof item !== 'object') return;

      if (Array.isArray(item)) {
        item.forEach((subItem: any) => {
          if (!subItem || typeof subItem !== 'object') return;
          if (subItem.date) {
            const isAvail = subItem.available ?? subItem.enabled ?? true;
            specificDates[subItem.date] = {
              available: Boolean(isAvail),
              time_start: subItem.time_start || '08:00',
              time_end: subItem.time_end || '17:00',
              label: subItem.label,
            };
          } else {
            const days = toArray(subItem.days).map(Number).filter((n: number) => !isNaN(n));
            if (days.length > 0) {
              recurring.push({
                ...subItem,
                days,
                weeks_of_month: subItem.weeks_of_month ? toArray(subItem.weeks_of_month).map(Number).filter((n: number) => !isNaN(n)) : undefined,
              });
            }
          }
        });
        return;
      }

      if (item.date) {
        const isAvail = item.available ?? item.enabled ?? true;
        specificDates[item.date] = {
          available: Boolean(isAvail),
          time_start: item.time_start || '08:00',
          time_end: item.time_end || '17:00',
          label: item.label,
        };
      } else {
        const days = toArray(item.days).map(Number).filter((n: number) => !isNaN(n));
        if (days.length > 0) {
          recurring.push({
            ...item,
            days,
            weeks_of_month: item.weeks_of_month ? toArray(item.weeks_of_month).map(Number).filter((n: number) => !isNaN(n)) : undefined,
          });
        }
      }
    });

    return { recurring, specificDates };
  }, []);

  const resolveLogisticsForZone = useCallback((
    zoneId: string | number | undefined,
    zonesList: any[],
    baseLogistics: any
  ) => {
    if (!zoneId) return baseLogistics;
    const zone = zonesList?.find((z: any) => z.id.toString() === zoneId.toString());
    if (!zone) return baseLogistics;

    const toArray = (val: any): any[] => {
      if (Array.isArray(val)) return val;
      if (val && typeof val === 'object') return Object.values(val);
      if (typeof val === 'string') {
        try { const parsed = JSON.parse(val); return toArray(parsed); } catch { return []; }
      }
      return [];
    };

    const parsed = parseLogisticsWindows(zone.pickup_windows);
    const recurring = parsed.recurring;
    const zoneSpecific = parsed.specificDates;
    const hasZoneRecurring = recurring.length > 0;
    const hasZoneSpecific = Object.keys(zoneSpecific).length > 0;
    const hasZoneWindows = hasZoneRecurring || hasZoneSpecific;

    const parsedBlackout = toArray(zone.blackout_dates);
    const hasZoneBlackout = parsedBlackout.length > 0;

    const hasCustomLeadTime = zone.lead_time_days !== null && zone.lead_time_days !== undefined;
    const leadTimeDays = hasCustomLeadTime ? zone.lead_time_days : (baseLogistics?.leadTimeDays ?? 2);

    const isCustomZoneSchedule = hasZoneWindows || hasZoneBlackout || hasCustomLeadTime;

    const pickupWindows = hasZoneWindows
      ? recurring
      : (baseLogistics?.pickupWindows || []);

    const specificDates = hasZoneWindows
      ? zoneSpecific
      : (baseLogistics?.specificDates || {});

    const blackoutDates = hasZoneBlackout
      ? parsedBlackout
      : (baseLogistics?.blackoutDates || []);

    return {
      ...baseLogistics,
      pickupWindows,
      specificDates,
      blackoutDates,
      leadTimeDays,
      zoneName: zone.name,
      zoneCode: zone.code,
      isCustomZoneSchedule,
    };
  }, [parseLogisticsWindows]);

  const evaluateDateAvailability = (
    dateInput: Date | string,
    logisticsObj: any
  ): { isInvalid: boolean; message?: string; timeStart?: string; timeEnd?: string } => {
    if (!logisticsObj) return { isInvalid: false };

    let checkDate: Date;
    if (typeof dateInput === 'string') {
      const cleanStr = dateInput.includes('T') ? dateInput.split('T')[0] : dateInput.slice(0, 10);
      const [yearStr, monthStr, dayStr] = cleanStr.split('-');
      if (yearStr && monthStr && dayStr) {
        checkDate = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10));
      } else {
        checkDate = new Date(dateInput);
      }
    } else {
      checkDate = new Date(dateInput);
    }

    if (isNaN(checkDate.getTime())) return { isInvalid: true, message: 'Invalid date' };

    // Lead time check
    const leadTimeDate = new Date();
    leadTimeDate.setHours(0, 0, 0, 0);
    leadTimeDate.setDate(leadTimeDate.getDate() + (logisticsObj.leadTimeDays || 2));

    const checkDateMidnight = new Date(checkDate);
    checkDateMidnight.setHours(0, 0, 0, 0);

    if (checkDateMidnight < leadTimeDate) {
      return { isInvalid: true, message: `Minimum ${logisticsObj.leadTimeDays || 2} days lead time required` };
    }

    const y = checkDate.getFullYear();
    const m = String(checkDate.getMonth() + 1).padStart(2, '0');
    const d = String(checkDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // Blackout check
    if (logisticsObj.blackoutDates?.includes(dateStr)) {
      return { isInvalid: true, message: 'The selected date is an unavailable blackout date' };
    }

    // Specific date overrides (highest priority)
    const specificDates = logisticsObj.specificDates || {};
    if (specificDates[dateStr] !== undefined) {
      const override = specificDates[dateStr];
      const isAvail = typeof override === 'object' ? override.available : Boolean(override);
      if (!isAvail) {
        return { isInvalid: true, message: 'No pickup service available on the selected date' };
      }
      return { isInvalid: false, timeStart: override.time_start || '08:00', timeEnd: override.time_end || '17:00' };
    }

    // Recurring weekly windows check
    const windows = logisticsObj.pickupWindows || [];
    const hasSpecific = Object.keys(specificDates).length > 0;

    if (windows.length > 0) {
      const dayOfWeek = checkDate.getDay();
      const weekOfMonth = Math.ceil(checkDate.getDate() / 7);

      const matchingWindow = windows.find((w: any) => {
        if (w.enabled === false) return false;
        const days = Array.isArray(w.days) ? w.days : (w.days && typeof w.days === 'object' ? Object.values(w.days).map(Number) : []);
        const wom = w.weeks_of_month
          ? (Array.isArray(w.weeks_of_month) ? w.weeks_of_month : Object.values(w.weeks_of_month).map(Number))
          : [1, 2, 3, 4, 5];
        return days.includes(dayOfWeek) && wom.includes(weekOfMonth);
      });

      if (!matchingWindow) {
        return { isInvalid: true, message: 'No pickup service available on the selected day' };
      }

      return {
        isInvalid: false,
        timeStart: matchingWindow.time_start || '08:00',
        timeEnd: matchingWindow.time_end || '17:00',
      };
    } else if (hasSpecific) {
      // Specific calendar dates are configured for this area, but this date is not on the schedule
      return { isInvalid: true, message: 'No pickup service scheduled on the selected date' };
    }

    // Default fallback when no specific schedule is defined:
    // Sundays are closed for collection unless explicitly scheduled
    const dayOfWeek = checkDate.getDay();
    if (dayOfWeek === 0) {
      return { isInvalid: true, message: 'No collections scheduled on Sundays' };
    }

    return { isInvalid: false, timeStart: '08:00', timeEnd: '17:00' };
  };

  const { data, setData, post, put, processing, errors, setError, clearErrors, transform } = useForm({
    // Sender Information
    first_name: user ? user.name.split(' ')[0] : '',
    last_name: user ? user.name.split(' ').slice(1).join(' ') : '',
    email: user ? user.email : '',
    mobile: sender?.mobile || '',
    secondary_mobile: sender?.secondary_mobile || '',
    address: sender?.address || '',
    suburb: sender?.suburb || '',
    state: sender?.state || 'NSW',
    postcode: sender?.postcode || '',
    latitude: sender?.latitude || null,
    longitude: sender?.longitude || null,
    pickup_zone_id: editingBooking?.pickup_zone_id?.toString() || (!isGuest && !isEditingSender && sender?.pickup_zone_id ? sender.pickup_zone_id.toString() : (sender?.suburb ? resolveZoneIdForSuburb(sender.suburb) : '') || ''),
    website: '',

    // Shared Booking Data
    booking_type: 'home_pickup',
    preferred_date: editingBooking?.preferred_date
      ? new Date(editingBooking.preferred_date).toISOString().slice(0, 16)
      : '',
    payment_method: 'stripe',
    notes: '',
    promo_code: '',
    empty_box_count: editingBooking?.empty_box_count || 0,
    empty_box_fee: editingBooking?.empty_box_fee || 10.00,

    // Boxes & Their Recipients
    boxes: [
      {
        recipient_id: '',
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
        recipient_latitude: null,
        recipient_longitude: null,
        area_id: '',
        box_type_id: '',
        is_custom_size: false,
        custom_length: '',
        custom_width: '',
        custom_height: '',
      }
    ],
  });

  const detectedZoneId = useMemo(() => {
    if (!data.suburb) return '';
    return resolveZoneIdForSuburb(data.suburb);
  }, [data.suburb, resolveZoneIdForSuburb]);

  const activeZoneId = data.pickup_zone_id || detectedZoneId;
  const selectedZone = pickupZones?.find((z: any) => z.id.toString() === activeZoneId?.toString());

  const activeLogistics = useMemo(() => {
    if (data.booking_type === 'drop_off') return logistics;
    if (!activeZoneId) return null;
    return resolveLogisticsForZone(activeZoneId, pickupZones, logistics);
  }, [data.booking_type, activeZoneId, pickupZones, logistics, resolveLogisticsForZone]);

  const getInitialValidDate = useCallback((zoneId?: string) => {
    let targetZoneId = zoneId || data?.pickup_zone_id || (data?.suburb ? resolveZoneIdForSuburb(data.suburb) : '');

    if (data?.booking_type === 'home_pickup' && !targetZoneId) {
      return '';
    }

    const currentLogistics = data?.booking_type === 'drop_off'
      ? logistics
      : resolveLogisticsForZone(targetZoneId, pickupZones, logistics);

    if (!currentLogistics) {
      return '';
    }

    const windows = currentLogistics.pickupWindows || [];
    const specificDates = currentLogistics.specificDates || {};
    const validWindows = windows.filter((w: any) => {
      if (w.enabled === false) return false;
      const days = Array.isArray(w.days) ? w.days : (w.days && typeof w.days === 'object' ? Object.values(w.days) : []);
      return days.length > 0;
    });
    const hasSpecific = Object.keys(specificDates).length > 0;

    // If no schedule windows or specific dates are configured, don't guess an arbitrary date
    if (validWindows.length === 0 && !hasSpecific) {
      return '';
    }

    let date = new Date(Date.now() + 86400000 * (currentLogistics.leadTimeDays || 2));
    let attempts = 0;

    while (attempts < 180) {
      attempts++;
      const evalResult = evaluateDateAvailability(date, currentLogistics);
      if (evalResult.isInvalid) {
        date = new Date(date.getTime() + 86400000);
        continue;
      }

      const [hh, mm] = (evalResult.timeStart || '08:00').split(':');
      date.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);

      // Offset local timezone format for datetime-local
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().slice(0, 16);
    }

    return '';
  }, [data?.booking_type, data?.pickup_zone_id, data?.suburb, logistics, pickupZones, resolveLogisticsForZone, resolveZoneIdForSuburb]);

  const handleSuburbChange = (suburbName: string, postcode?: string) => {
    const detectedZoneId = resolveZoneIdForSuburb(suburbName);
    const found = (suburbs || []).find(
      (s: any) => s.name?.toLowerCase().trim() === suburbName.toLowerCase().trim()
    );

    setData((prev: any) => ({
      ...prev,
      suburb: suburbName,
      postcode: postcode || found?.postcode || prev.postcode,
      pickup_zone_id: detectedZoneId,
    }));
    clearErrors('suburb');
    if (detectedZoneId) {
      clearErrors('pickup_zone_id');
    }
  };

  // Auto-sync pickup_zone_id with suburb when home_pickup is selected
  useEffect(() => {
    if (data.booking_type === 'drop_off') {
      if (data.pickup_zone_id) {
        setData('pickup_zone_id', '');
      }
      return;
    }
    if (data.suburb) {
      const detected = resolveZoneIdForSuburb(data.suburb);
      if (detected && detected !== data.pickup_zone_id) {
        setData('pickup_zone_id', detected);
      }
    } else if (!data.suburb && isEditingSender) {
      if (data.pickup_zone_id) {
        setData('pickup_zone_id', '');
      }
    }
  }, [data.suburb, data.booking_type, resolveZoneIdForSuburb, isEditingSender]);

  useEffect(() => {
    if (!activeLogistics) return;

    if (!data.preferred_date) {
      const initialDate = getInitialValidDate(data.pickup_zone_id);
      if (initialDate) {
        setData('preferred_date', initialDate);
      }
      return;
    }

    const date = new Date(data.preferred_date);
    const { isInvalid } = evaluateDateAvailability(date, activeLogistics);

    if (isInvalid) {
      const newValidDate = getInitialValidDate(data.pickup_zone_id);
      if (newValidDate && newValidDate !== data.preferred_date) {
        setData('preferred_date', newValidDate);
      }
    }
  }, [data.pickup_zone_id, activeLogistics, data.preferred_date, getInitialValidDate]);

  const getUpcomingAvailableDates = useCallback((logisticsObj: any, limit = 6) => {
    if (!logisticsObj) return [];

    const windows = logisticsObj.pickupWindows || [];
    const specificDates = logisticsObj.specificDates || {};
    const validWindows = windows.filter((w: any) => {
      if (w.enabled === false) return false;
      const days = Array.isArray(w.days) ? w.days : (w.days && typeof w.days === 'object' ? Object.values(w.days) : []);
      return days.length > 0;
    });
    const hasSpecific = Object.keys(specificDates).length > 0;

    // If no recurring windows or specific dates are configured, there are no scheduled runs to display
    if (validWindows.length === 0 && !hasSpecific) {
      return [];
    }

    const availableSlots: {
      date: Date;
      dateStr: string;
      formattedWeekday: string;
      formattedMonthDay: string;
      timeStart: string;
      timeEnd: string;
      label?: string;
      isEarliest?: boolean;
    }[] = [];

    const leadTime = logisticsObj.leadTimeDays ?? 2;
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() + leadTime);

    let checkDate = new Date(startDate);
    let daysChecked = 0;

    while (availableSlots.length < limit && daysChecked < 90) {
      const evalResult = evaluateDateAvailability(checkDate, logisticsObj);
      if (!evalResult.isInvalid) {
        const y = checkDate.getFullYear();
        const m = String(checkDate.getMonth() + 1).padStart(2, '0');
        const d = String(checkDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        const isEarliest = availableSlots.length === 0;

        const specificDates = logisticsObj.specificDates || {};
        const specificConfig = specificDates[dateStr];
        const label = typeof specificConfig === 'object' ? specificConfig.label : undefined;

        availableSlots.push({
          date: new Date(checkDate),
          dateStr,
          formattedWeekday: checkDate.toLocaleDateString('en-AU', { weekday: 'short' }),
          formattedMonthDay: checkDate.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }),
          timeStart: evalResult.timeStart || '08:00',
          timeEnd: evalResult.timeEnd || '17:00',
          label,
          isEarliest,
        });
      }

      checkDate = new Date(checkDate.getTime() + 86400000);
      daysChecked++;
    }

    return availableSlots;
  }, []);

  const PickupScheduleShowcase = () => {
    if (data.booking_type === 'drop_off') {
      return (
        <div className="rounded-2xl border border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/30 p-4 md:p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300">
                <Building2 className="size-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-900 dark:text-sky-100">
                  Depot Drop-Off Schedule & Location
                </h4>
                <p className="text-[11px] text-sky-700 dark:text-sky-300">
                  Deliver your box directly to our warehouse facility
                </p>
              </div>
            </div>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-sky-100 dark:bg-sky-900/80 text-sky-800 dark:text-sky-200">
              Drop-Off Mode
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
            <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-sky-100 dark:border-sky-900/40 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Warehouse Address</span>
              <p className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-start gap-1.5">
                <MapPin className="size-3.5 text-sky-600 shrink-0 mt-0.5" />
                <span>{depotAddress}</span>
              </p>
            </div>
            <div className="p-3 rounded-xl bg-white/80 dark:bg-zinc-900/80 border border-sky-100 dark:border-sky-900/40 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Operating Hours & Instructions</span>
              <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-[11px]">
                {depotInstructions || 'Monday – Friday, 8:00 AM – 4:30 PM. Please check in with warehouse staff upon arrival with your booking reference.'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    const upcomingSlots = getUpcomingAvailableDates(activeLogistics, 6);
    const windows = activeLogistics?.pickupWindows || [];
    const specificDates = activeLogistics?.specificDates || {};
    const validWindows = windows.filter((w: any) => {
      if (w.enabled === false) return false;
      const days = Array.isArray(w.days) ? w.days : (w.days && typeof w.days === 'object' ? Object.values(w.days) : []);
      return days.length > 0;
    });
    const hasSpecificOverrides = Object.keys(specificDates).length > 0;
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-linear-to-b from-zinc-50/80 to-white dark:from-zinc-900/90 dark:to-zinc-900/40 p-4 md:p-5 space-y-4 shadow-2xs">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/70 dark:border-zinc-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-brand-warm/15 dark:bg-brand-rust/20 text-brand-rust">
              <CalendarIcon className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                  Pickup Schedule & Rules
                </h4>
                {activeLogistics?.isCustomZoneSchedule ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                    Zone Schedule Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    Standard Schedule
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                {selectedZone ? (
                  <>Operating schedule for <strong className="text-zinc-800 dark:text-zinc-200">{selectedZone.name}</strong></>
                ) : (
                  'Operating schedule set in admin settings'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-900/50 text-amber-800 dark:text-amber-300">
              <Clock className="size-3 text-amber-600 shrink-0" />
              <span>Min. <strong>{activeLogistics?.leadTimeDays ?? 2} days</strong> advance notice</span>
            </span>
          </div>
        </div>

        {/* Regular Service Windows summary if defined */}
        {validWindows.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Regular Service Days & Hours
            </span>
            <div className="flex flex-wrap gap-2">
              {validWindows.map((w: any) => (
                <div
                  key={w.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 text-xs shadow-2xs"
                >
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {w.label || 'Regular Run'}:
                  </span>
                  <div className="flex items-center gap-1">
                    {(w.days || []).map((d: number) => (
                      <span
                        key={d}
                        className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-700/70 font-bold text-[10px] text-zinc-700 dark:text-zinc-300"
                      >
                        {daysOfWeek[d]}
                      </span>
                    ))}
                  </div>
                  <span className="text-zinc-400 dark:text-zinc-600">·</span>
                  <span className="text-zinc-600 dark:text-zinc-400 text-[11px]">
                    {formatTime(w.time_start)} – {formatTime(w.time_end)}
                  </span>
                  {w.weeks_of_month && w.weeks_of_month.length < 5 && (
                    <span className="text-[10px] font-medium text-brand-rust dark:text-amber-400 italic">
                      ({w.weeks_of_month.map((wm: number) => wm === 1 ? '1st' : wm === 2 ? '2nd' : wm === 3 ? '3rd' : wm === 4 ? '4th' : '5th').join(', ')} wk)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {validWindows.length === 0 && hasSpecificOverrides && (
          <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 bg-sky-50/60 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/40 p-2.5 rounded-xl">
            <Info className="size-4 text-sky-600 shrink-0" />
            <span>This area operates on <strong>specific designated run dates</strong>. Please select from the upcoming dates below or use the calendar.</span>
          </div>
        )}

        {validWindows.length === 0 && !hasSpecificOverrides && (
          <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100/70 dark:bg-zinc-800/60 p-2.5 rounded-xl">
            <Info className="size-4 text-zinc-500 shrink-0" />
            <span>No specific pickup schedule has been configured for this area. Please contact us to arrange pickup. Minimum {activeLogistics?.leadTimeDays ?? 2} days advance notice required.</span>
          </div>
        )}

        {/* Upcoming Available Scheduled Runs (Interactive Quick Select Chips) */}
        {upcomingSlots.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                <Sparkles className="size-3 text-brand-rust" /> Upcoming Scheduled Runs (Click to Select)
              </span>
              <span className="text-[11px] text-zinc-400">Available slots</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {upcomingSlots.map((slot) => {
                const isSelected = data.preferred_date?.slice(0, 10) === slot.dateStr;

                return (
                  <button
                    key={slot.dateStr}
                    type="button"
                    onClick={() => {
                      const [hh, mm] = (slot.timeStart || '09:00').split(':');
                      const newDate = new Date(slot.date);
                      newDate.setHours(parseInt(hh, 10), parseInt(mm, 10), 0, 0);

                      const offset = newDate.getTimezoneOffset() * 60000;
                      const localDate = new Date(newDate.getTime() - offset);

                      setData('preferred_date', localDate.toISOString().slice(0, 16));
                      clearErrors('preferred_date');
                    }}
                    className={cn(
                      "relative flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer shadow-2xs group",
                      isSelected
                        ? "bg-brand-warm/15 dark:bg-brand-rust/20 border-brand-rust dark:border-brand-rust ring-2 ring-brand-rust/30 dark:ring-brand-rust/40 text-brand-rust dark:text-amber-200"
                        : "bg-white dark:bg-zinc-800/80 border-zinc-200/80 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                    )}
                  >
                    {slot.isEarliest && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                        Earliest
                      </span>
                    )}

                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      {slot.formattedWeekday}
                    </span>
                    <span className="text-sm font-black text-zinc-900 dark:text-zinc-100 my-0.5">
                      {slot.formattedMonthDay}
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                      {formatTime(slot.timeStart)}
                    </span>

                    {isSelected && (
                      <span className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold text-brand-rust dark:text-amber-300">
                        <Check className="size-3" /> Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Blackout notice if any exist */}
        {activeLogistics?.blackoutDates && activeLogistics.blackoutDates.length > 0 && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-[11px] text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-3.5 text-amber-600 shrink-0" />
            <span>
              <strong>Holiday / Blackout Notice:</strong> No collections are scheduled on: {activeLogistics.blackoutDates.slice(0, 4).map((d: string) => {
                try { return new Date(d + 'T00:00:00').toLocaleDateString('en-AU', { month: 'short', day: 'numeric' }); } catch { return d; }
              }).join(', ')}{activeLogistics.blackoutDates.length > 4 ? '...' : ''}.
            </span>
          </div>
        )}
      </div>
    );
  };

  const bookingDraftData = {
    booking_type: data.booking_type,
    preferred_date: data.preferred_date,
    notes: data.notes,
    empty_box_count: data.empty_box_count,
    empty_box_fee: data.empty_box_fee,
    boxes: data.boxes,
  };

  const handleAutoSaveSetData = useCallback((updatedData: any) => {
    setData((currentData: any) => {
      const currentDraft = {
        booking_type: currentData.booking_type,
        preferred_date: currentData.preferred_date,
        notes: currentData.notes,
        empty_box_count: currentData.empty_box_count,
        empty_box_fee: currentData.empty_box_fee,
        boxes: currentData.boxes,
      };

      const nextDraft = typeof updatedData === 'function'
        ? updatedData(currentDraft)
        : updatedData;

      return {
        ...currentData,
        ...nextDraft,
      };
    });
  }, [setData]);

  const hasMeaningfulDraftData = useCallback((draftData: typeof bookingDraftData) => {
    const hasSenderDetails = [
      data.mobile,
      data.secondary_mobile,
      data.address,
      data.suburb,
      data.state,
      data.postcode,
    ].some((value) => String(value ?? '').trim().length > 0);

    const hasNotes = String(draftData.notes ?? '').trim().length > 0;

    const hasBoxDetails = (draftData.boxes ?? []).some((box: any) => (
      [
        box?.recipient_first_name,
        box?.recipient_last_name,
        box?.recipient_email,
        box?.recipient_address,
        box?.recipient_city,
        box?.recipient_province,
        box?.recipient_zip_code,
        box?.recipient_phone,
        box?.recipient_secondary_phone,
        box?.recipient_landmarks,
        box?.area_id,
        box?.box_type_id,
      ].some((value) => String(value ?? '').trim().length > 0)
    ));

    return hasSenderDetails || hasNotes || hasBoxDetails;
  }, [data.mobile, data.secondary_mobile, data.address, data.suburb, data.state, data.postcode]);
  const resolveDestinationAreaId = useCallback((provinceName?: string, cityName?: string) => {
    const normalize = (value?: string) => String(value ?? '').trim().toLowerCase();

    if (normalize(cityName) === 'davao city') {
      const davaoArea = areas?.find((area: any) => normalize(area.name) === 'davao city');

      if (davaoArea?.id) {
        return davaoArea.id;
      }
    }

    const province = provinces?.find((item: any) => normalize(item.name) === normalize(provinceName));

    return province?.area_id || '';
  }, [areas, provinces]);

  // Server-side auto-save callback
  const handleServerSave = useCallback(async (draftData: typeof bookingDraftData) => {
    if (isGuest || hasSubmittedBooking) {
      return;
    }

    // Avoid creating empty draft rows when the user has not entered any real form data yet.
    if (!draftId && !hasMeaningfulDraftData(draftData)) {
      return;
    }

    const getXsrfToken = () => {
      const match = document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'));

      return match ? decodeURIComponent(match[3]) : '';
    };

    try {
      const response = await fetch('/bookings/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-XSRF-TOKEN': getXsrfToken(),
          'X-Requested-With': 'XMLHttpRequest',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...draftData,
          draft_id: draftId,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          mobile: data.mobile,
          secondary_mobile: data.secondary_mobile,
          address: data.address,
          suburb: data.suburb,
          state: data.state,
          postcode: data.postcode,
          latitude: data.latitude,
          longitude: data.longitude,
          payment_method: data.payment_method,
        }),
      });

      if (response.ok) {
        const result = await response.json();

        if (result.draft_id) {
          setDraftId(result.draft_id);
        }
      } else {
        const errorData = await response.json();
        console.error('Draft save validation errors:', JSON.stringify(errorData, null, 2));
      }
    } catch {
      // Silent failure — localStorage still has the data
    }
  }, [draftId, hasSubmittedBooking, data.first_name, data.last_name, data.email, data.mobile, data.secondary_mobile, data.address, data.suburb, data.state, data.postcode, data.latitude, data.longitude, data.payment_method, hasMeaningfulDraftData]);

  const canAutoSaveDraft = !isGuest && !editingBooking && !hasSubmittedBooking;

  const { clearSavedData, saveToServerNow } = useAutoSave<typeof bookingDraftData>(
    'booking_form_v2',
    bookingDraftData,
    handleAutoSaveSetData,
    canAutoSaveDraft,
    canAutoSaveDraft ? handleServerSave : undefined
  );

  useEffect(() => {
    // Remove legacy autosave payload that included sender profile fields.
    localStorage.removeItem('autosave_booking_form');
  }, []);

  // Restore draft data from server if available
  useEffect(() => {
    if (!draftBooking?.draft_data || hasAppliedDraftSource.current || editingBooking || cloneSource) {
      return;
    }

    hasAppliedDraftSource.current = true;
    const dd = draftBooking.draft_data;

    setData((currentData: any) => ({
      ...currentData,
      booking_type: dd.booking_type || currentData.booking_type,
      preferred_date: dd.preferred_date || currentData.preferred_date,
      payment_method: dd.payment_method || currentData.payment_method,
      notes: dd.notes || currentData.notes,
      empty_box_count: dd.empty_box_count ?? currentData.empty_box_count,
      empty_box_fee: dd.empty_box_fee ?? currentData.empty_box_fee,
      boxes: dd.boxes && dd.boxes.length > 0 ? dd.boxes : currentData.boxes,
    }));
  }, [draftBooking, editingBooking, cloneSource, setData]);

  useEffect(() => {
    if (!editingBooking || hasAppliedEditSource.current) {
      return;
    }

    hasAppliedEditSource.current = true;
    setIsEditingSender(false);
    setData((prev: any) => ({
      ...prev,
      first_name: editingBooking.sender?.first_name || sender?.first_name || '',
      last_name: editingBooking.sender?.last_name || sender?.last_name || '',
      email: editingBooking.sender?.email || sender?.email || '',
      mobile: editingBooking.sender?.mobile || sender?.mobile || '',
      secondary_mobile: editingBooking.sender?.secondary_mobile || sender?.secondary_mobile || '',
      address: editingBooking.sender?.address || sender?.address || '',
      suburb: editingBooking.sender?.suburb || sender?.suburb || '',
      state: editingBooking.sender?.state || sender?.state || '',
      postcode: editingBooking.sender?.postcode || sender?.postcode || '',
      latitude: editingBooking.sender?.latitude || sender?.latitude || null,
      longitude: editingBooking.sender?.longitude || sender?.longitude || null,
      pickup_zone_id: editingBooking.pickup_zone_id?.toString() || editingBooking.sender?.pickup_zone_id?.toString() || sender?.pickup_zone_id?.toString() || detectPickupZoneBySuburb(editingBooking.sender?.suburb || sender?.suburb || '') || '',
      booking_type: editingBooking.booking_type || prev.booking_type || 'home_pickup',
      preferred_date: editingBooking.preferred_date ? editingBooking.preferred_date.slice(0, 16) : prev.preferred_date,
      payment_method: editingBooking.payment_method || prev.payment_method || 'stripe',
      notes: editingBooking.notes || '',
      empty_box_count: editingBooking.empty_box_count || 0,
      empty_box_fee: editingBooking.empty_box_fee || 10.00,
      boxes: (editingBooking.boxes && editingBooking.boxes.length > 0) ? editingBooking.boxes.map((box: any) => ({
        recipient_id: box.recipient_id || '',
        recipient_first_name: box.recipient?.first_name || box.recipient?.name?.split(' ')[0] || '',
        recipient_last_name: box.recipient?.last_name || box.recipient?.name?.split(' ').slice(1).join(' ') || '',
        recipient_email: box.recipient?.email || '',
        recipient_address: box.recipient?.address || '',
        recipient_city: box.recipient?.city || '',
        recipient_province: box.recipient?.province || '',
        recipient_zip_code: box.recipient?.zip_code || '',
        recipient_phone: box.recipient?.phone_number || '',
        recipient_secondary_phone: box.recipient?.secondary_phone_number || '',
        recipient_landmarks: box.recipient?.landmarks || '',
        recipient_latitude: box.recipient?.latitude || null,
        recipient_longitude: box.recipient?.longitude || null,
        area_id: box.recipient?.area_id || '',
        box_type_id: box.box_type_id || '',
        is_custom_size: Boolean(box.is_custom_size),
        custom_length: box.custom_length ?? '',
        custom_width: box.custom_width ?? '',
        custom_height: box.custom_height ?? '',
      })) : prev.boxes,
    }));
  }, [editingBooking, sender, pickupZones, setData]);

  useEffect(() => {
    if (hasAppliedQueryDefaults.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const boxTypeId = params.get('box_type_id');
    const areaId = params.get('area_id');
    const suburbParam = params.get('suburb');
    const pickupZoneIdParam = params.get('pickup_zone_id');
    const provinceParam = params.get('province');

    if (!boxTypeId && !areaId && !suburbParam && !provinceParam) {
      return;
    }

    hasAppliedQueryDefaults.current = true;
    setData((currentData: any) => ({
      ...currentData,
      suburb: suburbParam || currentData.suburb || '',
      pickup_zone_id: pickupZoneIdParam || currentData.pickup_zone_id || '',
      boxes: [{
        ...(currentData.boxes?.[0] ?? {}),
        box_type_id: boxTypeId || currentData.boxes?.[0]?.box_type_id || '',
        area_id: areaId || currentData.boxes?.[0]?.area_id || '',
        recipient_province: provinceParam || currentData.boxes?.[0]?.recipient_province || '',
      }],
    }));
  }, [setData]);

  useEffect(() => {
    if (!cloneSource || hasAppliedCloneSource.current || !Array.isArray(cloneSource.boxes)) {
      return;
    }

    hasAppliedCloneSource.current = true;
    setData((currentData: any) => ({
      ...currentData,
      boxes: cloneSource.boxes.map((box: any) => ({
        recipient_id: box.recipient_id || '',
        recipient_first_name: box.recipient?.first_name || box.recipient?.name?.split(' ')[0] || '',
        recipient_last_name: box.recipient?.last_name || box.recipient?.name?.split(' ').slice(1).join(' ') || '',
        recipient_email: box.recipient?.email || '',
        recipient_address: box.recipient?.address || '',
        recipient_city: box.recipient?.city || '',
        recipient_province: box.recipient?.province || '',
        recipient_zip_code: box.recipient?.zip_code || '',
        recipient_phone: box.recipient?.phone_number || '',
        recipient_secondary_phone: box.recipient?.secondary_phone_number || '',
        recipient_landmarks: box.recipient?.landmarks || '',
        recipient_latitude: box.recipient?.latitude || null,
        recipient_longitude: box.recipient?.longitude || null,
        area_id: box.recipient?.area_id || '',
        box_type_id: box.box_type_id || '',
        is_custom_size: Boolean(box.is_custom_size),
        custom_length: box.custom_length ?? '',
        custom_width: box.custom_width ?? '',
        custom_height: box.custom_height ?? '',
      })),
    }));
  }, [cloneSource, setData]);

  // Sanitize stale recipient_id references after data restoration or prop updates.
  // Also synchronize form fields with actual database contact records if a valid
  // recipient_id is present but the details are out of sync (e.g. database reset/re-seeded).
  useEffect(() => {
    if (!savedRecipients) {
      return;
    }

    const validRecipientsMap = new Map(
      savedRecipients.map((r: any) => [r.id.toString(), r])
    );

    let changed = false;
    const sanitizedBoxes = data.boxes.map((box: any) => {
      if (box.recipient_id) {
        const rec = validRecipientsMap.get(box.recipient_id.toString());

        if (!rec) {
          // Clear invalid recipient details
          changed = true;

          return {
            ...box,
            recipient_id: '',
            recipient_first_name: '',
            recipient_last_name: '',
            recipient_email: '',
            recipient_address: '',
            recipient_city: '',
            recipient_province: '',
            recipient_zip_code: '',
            recipient_phone: '',
            recipient_landmarks: '',
            recipient_latitude: null,
            recipient_longitude: null,
            area_id: '',
          };
        } else {
          // Check if fields are in sync with the saved contact.
          // If they aren't (e.g. database changed, contact updated), update them to match.
          const recipient = rec as any;
          const expectedFirstName = recipient.first_name || recipient.name?.split(' ')[0] || '';
          const expectedLastName = recipient.last_name || recipient.name?.split(' ').slice(1).join(' ') || '';
          const expectedEmail = recipient.email || '';
          const expectedAddress = recipient.address || '';
          const expectedCity = recipient.city || '';
          const expectedProvince = recipient.province || '';
          const expectedZipCode = recipient.zip_code || '';
          const expectedPhone = recipient.phone_number || '';
          const expectedSecondaryPhone = recipient.secondary_phone_number || '';
          const expectedLandmarks = recipient.landmarks || '';
          const expectedLatitude = recipient.latitude || null;
          const expectedLongitude = recipient.longitude || null;
          const expectedAreaId = recipient.area_id || '';

          if (
            box.recipient_first_name !== expectedFirstName ||
            box.recipient_last_name !== expectedLastName ||
            box.recipient_email !== expectedEmail ||
            box.recipient_address !== expectedAddress ||
            box.recipient_city !== expectedCity ||
            box.recipient_province !== expectedProvince ||
            box.recipient_zip_code !== expectedZipCode ||
            box.recipient_phone !== expectedPhone ||
            box.recipient_secondary_phone !== expectedSecondaryPhone ||
            box.recipient_landmarks !== expectedLandmarks ||
            box.recipient_latitude !== expectedLatitude ||
            box.recipient_longitude !== expectedLongitude ||
            box.area_id?.toString() !== expectedAreaId?.toString()
          ) {
            changed = true;

            return {
              ...box,
              recipient_first_name: expectedFirstName,
              recipient_last_name: expectedLastName,
              recipient_email: expectedEmail,
              recipient_address: expectedAddress,
              recipient_city: expectedCity,
              recipient_province: expectedProvince,
              recipient_zip_code: expectedZipCode,
              recipient_phone: expectedPhone,
              recipient_secondary_phone: expectedSecondaryPhone,
              recipient_landmarks: expectedLandmarks,
              recipient_latitude: expectedLatitude,
              recipient_longitude: expectedLongitude,
              area_id: expectedAreaId,
            };
          }
        }
      }

      return box;
    });

    if (changed) {
      setData('boxes', sanitizedBoxes);
    }
  }, [data.boxes, savedRecipients, setData]);

  const addBox = () => {
    const master = data.boxes[0] || {};
    setData('boxes', [
      ...data.boxes,
      {
        ...master,
        box_type_id: '',
        is_custom_size: false,
        custom_length: '',
        custom_width: '',
        custom_height: '',
      },
    ]);
  };

  const removeBox = (index: number) => {
    const newBoxes = [...data.boxes];
    newBoxes.splice(index, 1);
    setData('boxes', newBoxes);
  };

  const updateBox = (index: number, field: string, value: any) => {
    const newBoxes = [...data.boxes];
    // @ts-expect-error - TS doesn't know the exact keys here
    newBoxes[index][field] = value;

    if (field === 'recipient_province' || field === 'recipient_city') {
        newBoxes[index]['area_id'] = resolveDestinationAreaId(
            newBoxes[index].recipient_province,
            newBoxes[index].recipient_city,
        );
    }

    setData('boxes', newBoxes);
  };

  const updatePrimaryRecipient = (field: string, value: any) => {
    const newBoxes = data.boxes.map(box => {
      const newBox = { ...box, [field]: value };
      if (field === 'recipient_province' || field === 'recipient_city') {
        newBox['area_id'] = resolveDestinationAreaId(
            newBox.recipient_province,
            newBox.recipient_city,
        );
      }
      return newBox;
    });
    setData('boxes', newBoxes);
  };

  const getCurrentLocation = (type: 'sender' | 'recipient') => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');

      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const coordsString = ` [GPS: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}]`;

          if (type === 'sender') {
            setData((currentData: any) => ({
              ...currentData,
              notes: (currentData.notes || '') + (currentData.notes ? '\n' : '') + `Pickup GPS Coordinates: ${latitude}, ${longitude}`
            }));
            alert(`Location captured! Coordinates added to notes.`);
          } else if (type === 'recipient') {
            updatePrimaryRecipient('recipient_landmarks', (data.boxes?.[0]?.recipient_landmarks || '') + coordsString);
          }
        } catch (error) {
          console.error('Error getting address from coordinates', error);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        alert(`Unable to retrieve your location: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const applySavedRecipient = (recId: string) => {
    const rec = savedRecipients?.find((r: any) => r.id.toString() === recId) as any;

    if (!rec) {
      const newBoxes = data.boxes.map(box => ({ ...box, recipient_id: '', recipient_first_name: '', recipient_last_name: '', recipient_email: '', recipient_address: '', recipient_city: '', recipient_province: '', recipient_zip_code: '', recipient_phone: '', recipient_secondary_phone: '', recipient_landmarks: '', recipient_latitude: null, recipient_longitude: null, area_id: '' }));
      setData('boxes', newBoxes);

      return;
    }

    const newBoxes = data.boxes.map(box => ({
      ...box,
      recipient_id: rec.id,
      recipient_first_name: rec.first_name || (rec.name ? rec.name.split(' ')[0] : ''),
      recipient_last_name: rec.last_name || (rec.name ? rec.name.split(' ').slice(1).join(' ') : ''),
      recipient_email: rec.email || '',
      recipient_address: rec.address,
      recipient_city: rec.city,
      recipient_province: rec.province,
      recipient_zip_code: rec.zip_code,
      recipient_phone: rec.phone_number || '',
      recipient_secondary_phone: rec.secondary_phone_number || '',
      recipient_landmarks: rec.landmarks || '',
      recipient_latitude: rec.latitude,
      recipient_longitude: rec.longitude,
      area_id: rec.area_id
    }));
    setData('boxes', newBoxes);
  };

  const getCbmRate = (areaId: string | number) => {
    const customCbmType = boxTypes?.find((bt: any) => bt.name?.toLowerCase().includes('cbm') || bt.name?.toLowerCase() === 'custom box');
    let rate = 0;

    if (customCbmType && data.pickup_zone_id) {
        const exactPriceRecord = boxPrices?.find(
            (p: any) => p.area_id.toString() === areaId.toString() && p.box_type_id.toString() === customCbmType.id.toString() && p.pickup_zone_id?.toString() === data.pickup_zone_id?.toString()
        );
        if (exactPriceRecord) {
            rate = parseFloat(exactPriceRecord.price);
        }
    }

    // Fallback removed as cbm_rate is no longer on the area model

    return rate;
  };

  const getBoxPrice = (box: any) => {
    // Custom size path: CBM × area's CBM rate
    if (box.is_custom_size) {
      const l = parseFloat(box.custom_length || '0');
      const w = parseFloat(box.custom_width  || '0');
      const h = parseFloat(box.custom_height || '0');

      if (!box.area_id || l <= 0 || w <= 0 || h <= 0) {
        return 0;
      }

      const cbmRate = getCbmRate(box.area_id);

      if (!cbmRate) {
        return 0;
      }

      const cbm = (l * w * h) / 1_000_000;

      return Math.round(cbm * cbmRate * 100) / 100;
    }

    // Preset box path: price from area × box_type matrix
    if (!box.area_id || !box.box_type_id) {
return 0;
}

    const exactPriceRecord = boxPrices?.find(
      (p: any) => p.area_id.toString() === box.area_id.toString() && p.box_type_id.toString() === box.box_type_id.toString() && p.pickup_zone_id?.toString() === data.pickup_zone_id?.toString()
    );

    const fallbackPriceRecord = boxPrices?.find(
      (p: any) => p.area_id.toString() === box.area_id.toString() && p.box_type_id.toString() === box.box_type_id.toString() && !p.pickup_zone_id
    );

    const priceRecord = exactPriceRecord || fallbackPriceRecord;

    return priceRecord ? parseFloat(priceRecord.price) : 0;
  };

  const sanitizeRecipientId = (recipientId: any) => {
    if (recipientId === '' || recipientId === '0' || recipientId === null || recipientId === undefined) {
      return null;
    }

    const isValidRecipient = (savedRecipients || []).some((recipient: any) => recipient.id.toString() === recipientId.toString());

    return isValidRecipient ? recipientId : null;
  };

  const cargoSubtotal = data.boxes.reduce((acc, box) => acc + getBoxPrice(box), 0);
  const emptyBoxTotal = (Number(data.empty_box_count) || 0) * (Number(data.empty_box_fee) || 10.00);
  const totalEstimate = cargoSubtotal + emptyBoxTotal;
  const finalEstimate = Math.max(0, totalEstimate - discountAmount);

  const senderStep1Summary = useMemo(() => {
    const isDropOff = data.booking_type === 'drop_off';
    const methodStr = isDropOff ? 'Drop-Off' : 'Pick-Up';
    const name = `${data.first_name || ''} ${data.last_name || ''}`.trim();
    let dateStr = '';
    if (data.preferred_date) {
      try {
        dateStr = format(new Date(data.preferred_date), 'MMM d');
      } catch {
        dateStr = data.preferred_date.slice(0, 10);
      }
    }
    if (name && dateStr) return `${methodStr} • ${name} • ${dateStr}`;
    if (name) return `${methodStr} • ${name}`;
    if (dateStr) return `${methodStr} ${dateStr}`;
    return methodStr;
  }, [data.booking_type, data.first_name, data.last_name, data.preferred_date]);

  const senderStep2Summary = useMemo(() => {
    const count = data.boxes.length;
    const dest = data.boxes[0]?.recipient_city || data.boxes[0]?.recipient_province;
    const emptyCount = Number(data.empty_box_count) || 0;
    const emptyPart = emptyCount > 0 ? ` + ${emptyCount} Empty` : '';
    if (dest) {
      return `${count} ${count === 1 ? 'Box' : 'Boxes'}${emptyPart} • ${dest}`;
    }
    return `${count} ${count === 1 ? 'Box' : 'Boxes'}${emptyPart}`;
  }, [data.boxes, data.empty_box_count]);

  const senderStep3Summary = useMemo(() => {
    if (finalEstimate > 0) {
      return `$${finalEstimate.toFixed(0)} AUD${discountAmount > 0 ? ` (-$${discountAmount.toFixed(0)})` : ''}`;
    }
    return undefined;
  }, [finalEstimate, discountAmount]);

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
      return 'Limited time';
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
        return 'Ends today!';
      }
      if (diffDays === 1) {
        return 'Ends tomorrow!';
      }
      if (diffDays <= 7) {
        return `Ends in ${diffDays}d!`;
      }
      return `Valid until ${format(endDate, 'MMM d')}`;
    } catch (e) {
      return 'Active';
    }
  };

  const applyPromoCode = async (codeToUse?: string) => {
    const targetCode = (codeToUse !== undefined ? codeToUse : promoCodeInput).trim().toUpperCase();
    if (!targetCode) return;
    setPromoCodeInput(targetCode);
    setValidatingPromo(true);
    setPromoError(null);

    const getXsrfToken = () => {
        const match = document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'));
        return match ? decodeURIComponent(match[3]) : '';
    };

    try {
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
                boxes: data.boxes,
                subtotal: cargoSubtotal,
                empty_box_count: data.empty_box_count,
                empty_box_fee: data.empty_box_fee || 10.00,
            }),
        });

        const result = await response.json();

        if (response.ok && result.valid) {
            setDiscountAmount(result.discount_amount);
            setPromoSuccessMessage(`Promo applied: Saved $${result.discount_amount.toFixed(2)}`);
            if (data.promo_code !== targetCode) {
                setData('promo_code', targetCode);
            }
        } else {
            setDiscountAmount(0);
            setData('promo_code', '');
            setPromoError(result.message || 'Invalid promo code');
            setPromoCodeInput('');
        }
    } catch (e) {
        setDiscountAmount(0);
        setData('promo_code', '');
        setPromoError('Error validating promo code');
    } finally {
        setValidatingPromo(false);
    }
  };

  // Auto-revalidate/calculate discount if promo_code is restored or subtotal changes
  useEffect(() => {
    if (data.promo_code) {
      setPromoCodeInput(data.promo_code);
      applyPromoCode(data.promo_code);
    } else if (discountAmount > 0) {
      setDiscountAmount(0);
      setPromoSuccessMessage(null);
    }
  }, [data.promo_code, totalEstimate]);

  const removePromoCode = () => {
      setPromoCodeInput('');
      setData('promo_code', '');
      setDiscountAmount(0);
      setPromoSuccessMessage(null);
      setPromoError(null);
  };

  const getFriendlyError = (key: string, message: string) => {
    let friendlyKey = key;
    const cleaned = message.replace(/\.\d+\./g, ' ');

    if (key.startsWith('boxes.')) {
      const parts = key.split('.');
      const index = parseInt(parts[1]) + 1;
      let field = parts.slice(2).join(' ').replace(/_/g, ' ');

      // Normalize field names
      if (field === 'area id') {
field = 'destination area';
}

      if (field === 'box type id') {
field = 'box type';
}

      if (field === 'custom length') {
field = 'length';
}

      if (field === 'custom width') {
field = 'width';
}

      if (field === 'custom height') {
field = 'height';
}

      if (field === 'recipient phone') {
field = 'recipient mobile number';
}

      // Check if the message already includes "Box X" or "Unit X"
      if (cleaned.toLowerCase().includes(`box ${index}`) || cleaned.toLowerCase().includes(`unit ${index}`)) {
        return cleaned;
      }

      // Strip recipient_ prefix for check
      const strippedField = field.replace(/^recipient\s+/, '').replace(/^sender\s+/, '');

      // If the message contains either the full field name or the stripped field name, prepend "Box X: "
      if (cleaned.toLowerCase().includes(field.toLowerCase()) || cleaned.toLowerCase().includes(strippedField.toLowerCase())) {
        return `Box ${index}: ${cleaned.charAt(0).toUpperCase() + cleaned.slice(1)}`;
      }

      friendlyKey = `Box ${index} ${field}`;
    } else {
      friendlyKey = key.replace(/_/g, ' ');
    }

    // Capitalize first letter
    friendlyKey = friendlyKey.charAt(0).toUpperCase() + friendlyKey.slice(1);

    if (cleaned.toLowerCase().includes(friendlyKey.toLowerCase())) {
      return cleaned;
    }

    return `${friendlyKey}: ${cleaned}`;
  };

  const validateStep = (step: number) => {
    clearErrors();
    let hasErrors = false;

    if (step === 1) {
      const isDropOff = data.booking_type === 'drop_off';
      const requiredFields: Record<string, string> = {
        first_name: 'First Name',
        last_name: 'Last Name',
        email: 'Email Address',
        mobile: 'Contact Phone',
        address: isDropOff ? 'Sender Address' : 'Pickup Address',
        suburb: 'Suburb',
        state: 'State',
        postcode: 'Postcode',
        preferred_date: isDropOff ? 'Preferred Drop-Off Date' : 'Preferred Pickup Time',
      };
      Object.entries(requiredFields).forEach(([field, label]) => {
        if (!data[field as keyof typeof data]) {
          setError(field as any, `${label} is required`);
          hasErrors = true;
        }
      });

      if (!isDropOff && !data.pickup_zone_id) {
        setError('pickup_zone_id', 'Please select or confirm your pickup area');
        hasErrors = true;
      }

      if (data.mobile) {
        const phoneError = validatePhone(data.mobile, 'Contact Phone', senderCountryCode);

        if (phoneError) {
          setError('mobile', phoneError);
          hasErrors = true;
        }
      }

      // Thorough Schedule Validation
      if (data.preferred_date) {
        const selectedDate = new Date(data.preferred_date);
        const now = new Date();

        if (selectedDate < now) {
          setError('preferred_date', isDropOff ? 'Drop-off date cannot be in the past' : 'Pickup date cannot be in the past');
          hasErrors = true;
        } else if (activeLogistics) {
          const evalResult = evaluateDateAvailability(selectedDate, activeLogistics);
          if (evalResult.isInvalid && evalResult.message) {
            setError('preferred_date', evalResult.message);
            hasErrors = true;
          }
        }
      }

      if (data.mobile) {
        const phoneError = validatePhone(data.mobile, 'Contact Phone', senderCountryCode);
        if (phoneError) {
          setError('mobile', phoneError);
          hasErrors = true;
        }
      }

      if (data.secondary_mobile) {
        const secondaryPhoneError = validatePhone(data.secondary_mobile, 'Secondary Phone Number', senderCountryCode);
        if (secondaryPhoneError) {
          setError('secondary_mobile', secondaryPhoneError);
          hasErrors = true;
        }
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (data.email && !emailRegex.test(data.email)) {
        setError('email', 'Please enter a valid email address');
        hasErrors = true;
      }

      // If there are errors on sender fields, expand the edit form so the
      // user can actually see which fields are highlighted in red.
      if (hasErrors) {
        setIsEditingSender(true);
      }
    }

if (step === 2) {
      // Validate Primary Recipient (data.boxes[0])
      const primaryBox = data.boxes[0];
      if (primaryBox) {
        if (!primaryBox.recipient_id) {
            const recipientRequired: Record<string, string> = {
                recipient_first_name: 'Receiver First Name',
                recipient_last_name: 'Receiver Last Name',
                recipient_email: 'Receiver Email',
                recipient_address: 'Receiver Address',
                recipient_city: 'City',
                recipient_province: 'Province',
                recipient_zip_code: 'Zip Code',
                recipient_phone: 'Receiver Phone',
            };
            Object.entries(recipientRequired).forEach(([field, label]) => {
                if (!primaryBox[field as keyof typeof primaryBox]) {
                    setError(`boxes.0.${field}` as any, `${label} is required`);
                    hasErrors = true;
                }
            });
        }

        if (!primaryBox.recipient_id && primaryBox.recipient_phone) {
            const phoneError = validatePhone(primaryBox.recipient_phone, 'Receiver Phone', 'PH');

            if (phoneError) {
                setError(`boxes.0.recipient_phone` as any, phoneError);
                hasErrors = true;
            }
        }

        if (!primaryBox.recipient_id && primaryBox.recipient_secondary_phone) {
            const secondaryPhoneError = validatePhone(primaryBox.recipient_secondary_phone, 'Secondary Contact Phone', 'PH');

            if (secondaryPhoneError) {
                setError(`boxes.0.recipient_secondary_phone` as any, secondaryPhoneError);
                hasErrors = true;
            }
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (primaryBox.recipient_email && !emailRegex.test(primaryBox.recipient_email)) {
          setError(`boxes.0.recipient_email` as any, 'Receiver Email is invalid');
          hasErrors = true;
        }
      }

      // Validate Box Specifications
      data.boxes.forEach((box, i) => {
        // Always required: area_id
        if (!box.area_id) {
            setError(`boxes.${i}.area_id` as any, 'Destination Area is required');
            hasErrors = true;
        }

        // box_type_id is only required when NOT using custom size
        if (!box.is_custom_size && !box.box_type_id) {
            setError(`boxes.${i}.box_type_id` as any, 'Box Type is required');
            hasErrors = true;
        }

        // For custom size, all three dimensions are required and must be > 0
        if (box.is_custom_size) {
            const dims = [
                { key: 'custom_length', label: 'Length' },
                { key: 'custom_width',  label: 'Width' },
                { key: 'custom_height', label: 'Height' },
            ] as const;
            dims.forEach(({ key, label }) => {
                const val = parseFloat((box as any)[key] || '0');

                if (!val || val <= 0) {
                    setError(`boxes.${i}.${key}` as any, `${label} must be greater than 0`);
                    hasErrors = true;
                }
            });
        }

        // Validate price configuration (skip price check when CBM rate is not set for custom sizes)
        if (box.area_id && !box.is_custom_size && box.box_type_id) {
          const price = getBoxPrice(box);

          if (price <= 0) {
            setError(`boxes.${i}.box_type_id` as any, 'No price configured for this area and box type combination. Please contact support.');
            hasErrors = true;
          }
        }
      });
    }

    if (hasErrors) {
        setTimeout(() => {
          const firstError = document.querySelector('.text-red-600');

          if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);

        return false;
    }

    return true;
  };

  const nextStep = async () => {
    if (!validateStep(currentStep)) {
      return;
    }

    // Step 1 -> Step 2
    if (currentStep === 1) {
      setCurrentStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Step 2 -> Step 3 (Review Details)
    if (currentStep === 2) {
      setCurrentStep(3);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Step 3 -> Step 4 (Proceed to Payment / Confirmation)
    if (currentStep === 3) {
        // Re-validate steps 1 and 2 before submitting to the server
        if (!validateStep(1)) {
            setCurrentStep(1);
            toast.error('Please complete all required sender details before proceeding.');
            return;
        }

        if (!validateStep(2)) {
            setCurrentStep(2);
            toast.error('Please complete all required box and recipient details before proceeding.');
            return;
        }

        // Additional validation: ensure total price is greater than 0
        if (totalEstimate <= 0) {
            toast.error('Total booking amount must be greater than $0. Please check that prices are configured for your selected area and box types.');
            return;
        }

        if (isGuest && !agreeTerms) {
            toast.error('Please accept the Terms of Service to proceed to payment.');
            return;
        }

        setInitializingPayment(true);
        setHasSubmittedBooking(true);
        let submittedBookingId: number | null = null;

        try {
            const getXsrfToken = () => {
                const match = document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'));
                return match ? decodeURIComponent(match[3]) : '';
            };
            const initEndpoint = isGuest ? '/guest/bookings/initialize' : '/bookings/initialize';
            const response = await fetch(initEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-XSRF-TOKEN': getXsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'include',
                body: JSON.stringify({
                    ...data,
                    mobile: data.mobile ? data.mobile.replace(/[\s\-\(\)]/g, '') : '',
                    secondary_mobile: data.secondary_mobile ? data.secondary_mobile.replace(/[\s\-\(\)]/g, '') : '',
                    boxes: data.boxes.map((box: any) => ({
                      ...box,
                      recipient_phone: (!box.recipient_id && box.recipient_phone) ? box.recipient_phone.replace(/[\s\-\(\)]/g, '') : box.recipient_phone,
                      recipient_secondary_phone: (!box.recipient_id && box.recipient_secondary_phone) ? box.recipient_secondary_phone.replace(/[\s\-\(\)]/g, '') : box.recipient_secondary_phone,
                      recipient_id: sanitizeRecipientId(box.recipient_id),
                    })),
                    draft_id: draftId,
                    booking_id: initializedBookingId,
                    initialization_key: initializationKey,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Initialize validation errors:', JSON.stringify(errorData, null, 2));

                if (errorData.booking_id) {
                    submittedBookingId = errorData.booking_id;
                    setInitializedBookingId(errorData.booking_id);
                }

                if (errorData.errors) {
                    const errorMessages = Object.entries(errorData.errors)
                        .map(([key, msgs]: [string, any]) => getFriendlyError(key, Array.isArray(msgs) ? msgs[0] : msgs))
                        .slice(0, 5);

                    throw new Error(errorMessages.join('\n'));
                }

                throw new Error(errorData.error || errorData.message || 'Initialization failed');
            }

            const result = await response.json();
            submittedBookingId = result.booking.id;
            setInitializedBookingId(result.booking.id);
            setDraftId(null);
            setPaymentData(result);
            clearSavedData();
            localStorage.removeItem('booking_initialization_key');
            setCurrentStep(4);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error: any) {
            if (!submittedBookingId) {
                setHasSubmittedBooking(false);
            }

            toast.error(error.message || 'Failed to initialize booking. Please try again.');
        } finally {
            setInitializingPayment(false);
        }

        return;
    }

    setCurrentStep(currentData => Math.min(currentData + 1, 4));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prevStep = () => {
    setCurrentStep(currentData => Math.max(currentData - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveDraft = async () => {
    if (isGuest) {
      toast.info('Shipment draft is preserved in your current browser.');
      return;
    }

    if (hasSubmittedBooking) {
      return;
    }

    setSavingDraft(true);

    try {
      await saveToServerNow(true);
      toast.success('Draft saved successfully');
    } finally {
      setSavingDraft(false);
    }
  };

  const submit = (e: React.SyntheticEvent) => {
    e.preventDefault();

    if (currentStep < 4) {
      nextStep();
      return;
    }

    const isStepOneValid = validateStep(1);
    const isStepTwoValid = validateStep(2);

    if (!isStepOneValid || !isStepTwoValid) {
        if (!isStepOneValid) {
          setCurrentStep(1);
        } else if (!isStepTwoValid) {
          setCurrentStep(2);
        }

        return;
    }

    const submissionData = {
      ...data,
      mobile: data.mobile ? data.mobile.replace(/[\s\-\(\)]/g, '') : '',
      secondary_mobile: data.secondary_mobile ? data.secondary_mobile.replace(/[\s\-\(\)]/g, '') : '',
      boxes: data.boxes.map(box => ({
        ...box,
        recipient_phone: (!box.recipient_id && box.recipient_phone) ? box.recipient_phone.replace(/[\s\-\(\)]/g, '') : box.recipient_phone,
        recipient_secondary_phone: (!box.recipient_id && box.recipient_secondary_phone) ? box.recipient_secondary_phone.replace(/[\s\-\(\)]/g, '') : box.recipient_secondary_phone,
        recipient_id: sanitizeRecipientId(box.recipient_id),
      })),
    };

    transform(() => submissionData);
    setHasSubmittedBooking(true);
    clearSavedData();

    const submitOptions = {
      onSuccess: () => {
        clearSavedData();
        setDraftId(null);
      },
      onError: () => setHasSubmittedBooking(false),
      onFinish: () => {
        transform((formData) => formData);
      },
    };

    if (editingBooking) {
        put(`/bookings/${editingBooking.id}`, submitOptions);
    } else if (draftId) {
        // Submit the draft — promotes it to pending
        post(`/bookings/${draftId}/submit-draft`, submitOptions);
    } else {
        post('/bookings', submitOptions);
    }
  };

  const Layout = isGuest ? MarketingLayout : AppLayout;
  const layoutProps = isGuest ? { hideLogin: false, hideBookGuest: true } : { breadcrumbs };

  return (
    <Layout {...layoutProps}>
      <Head title={editingBooking ? 'Edit Booking' : isGuest ? 'Book a Balikbayan Box (Guest)' : 'Book a Pickup'} />

      <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-4 md:space-y-6">
        {/* Mobile Header (md:hidden) */}
        <div className="md:hidden space-y-1 pt-1 pb-1">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#B24A2B] dark:text-amber-500">
                SEND BALIKBAYAN BOX
            </p>
            <div className="flex items-center justify-between gap-2">
                <h1 className="font-serif text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {editingBooking ? `Edit Booking` : 'Book a Pickup'}
                </h1>
                {canAutoSaveDraft && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 shrink-0">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Auto-saved
                    </span>
                )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Send a box to the Philippines with door-to-door tracking.
            </p>
        </div>

        {/* Mobile Step Indicator Card (md:hidden) */}
        <div className="md:hidden rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs">
            <StepIndicator
                step={currentStep}
                isGuest={isGuest}
                onStepClick={(s) => {
                    if (s < currentStep) {
                        setCurrentStep(s);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }}
                step1Summary={senderStep1Summary}
                step2Summary={senderStep2Summary}
                step3Summary={senderStep3Summary}
                mode="mobile"
            />
        </div>

        {/* Desktop Hero Header & Steps Card (hidden md:block) */}
        <div className="hidden md:block rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            {/* Top Row: Title, Description & Action Badges */}
            <div className="p-5 sm:p-6 pb-4 sm:pb-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Back/Breadcrumb & Title */}
                    <div className="flex items-center gap-3.5">
                        <Link
                            href={isGuest ? '/' : '/dashboard'}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors shadow-2xs"
                            title={isGuest ? "Back to home" : "Back to dashboard"}
                        >
                            <ArrowLeft className="size-4" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                                    {editingBooking ? `Edit Booking: ${editingBooking.reference_number}` : 'Book a Balikbayan Box'}
                                </h1>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-brand-warm/30 dark:bg-brand-rust/30 text-brand-rust dark:text-brand-warm text-[10px] font-extrabold uppercase tracking-wide border border-brand-rust/15">
                                    {editingBooking ? 'Edit Mode' : isGuest ? 'Quick Guest Booking' : 'Sender Portal'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Autosave Status & Save Draft */}
                    {(canAutoSaveDraft || (!editingBooking && !isGuest)) && (
                        <div className="flex items-center gap-2.5 self-start lg:self-center flex-wrap">
                            {canAutoSaveDraft && (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span>Auto-saved</span>
                                </div>
                            )}

                            {!editingBooking && !isGuest && (
                                <button
                                    type="button"
                                    onClick={handleSaveDraft}
                                    disabled={savingDraft}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                                    title="Save current draft"
                                >
                                    <Save className={cn("size-3.5", savingDraft && "animate-spin")} />
                                    <span>{savingDraft ? 'Saving...' : 'Save Draft'}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Integrated Step Indicator Ribbon */}
            <div className="border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/60 p-2 sm:px-4 sm:py-2.5">
                <StepIndicator
                    step={currentStep}
                    isGuest={isGuest}
                    onStepClick={(s) => {
                        if (s < currentStep) {
                            setCurrentStep(s);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }}
                    step1Summary={senderStep1Summary}
                    step2Summary={senderStep2Summary}
                    step3Summary={senderStep3Summary}
                    mode="desktop"
                />
            </div>
        </div>

        <div className="space-y-8">

            {/* STEP 1: SENDER & PICKUP DETAILS */}
            {currentStep === 1 && (
              <form onSubmit={submit} className="space-y-8">
                <section className="space-y-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                    <SectionHeader title="Sender Information" subtitle="Personal and contact details" />
                    {data.address && !isGuest && (
                      <button
                        type="button"
                        onClick={() => setIsEditingSender(!isEditingSender)}
                        className="text-xs font-semibold text-sky-600 hover:text-sky-700"
                      >
                        {isEditingSender ? 'Lock Details' : 'Edit Details'}
                      </button>
                    )}
                  </div>

                  {!isEditingSender && data.address && !isGuest ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Full Name</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{data.first_name} {data.last_name}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Contact</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{data.mobile}</p>
                        {data.secondary_mobile && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-300 font-mono">Alt: {data.secondary_mobile}</p>
                        )}
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{data.email}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Address</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {data.address}, {data.suburb}, {data.state} {data.postcode}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {/* Hidden honeypot for bots */}
                      <input
                        type="text"
                        name="website"
                        className="hidden"
                        tabIndex={-1}
                        autoComplete="off"
                        value={data.website || ''}
                        onChange={(e) => setData('website', e.target.value)}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="First Name" required error={errors.first_name}>
                          <input title="First Name" placeholder="e.g. Maria" className={baseInputClass} value={data.first_name || ''} onChange={e => setData('first_name', e.target.value)} />
                        </Field>
                        <Field label="Last Name" required error={errors.last_name}>
                          <input title="Last Name" placeholder="e.g. Santos" className={baseInputClass} value={data.last_name || ''} onChange={e => setData('last_name', e.target.value)} />
                        </Field>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Contact Phone" required error={errors.mobile}>
                          <PhoneInput value={data.mobile || ''} onChange={val => setData('mobile', val)} defaultCountryCode={senderCountryCode} />
                        </Field>
                        <Field label="Secondary Phone" hint="Optional" error={errors.secondary_mobile}>
                          <PhoneInput value={data.secondary_mobile || ''} onChange={val => setData('secondary_mobile', val)} defaultCountryCode={senderCountryCode} />
                        </Field>
                        <div className="md:col-span-2">
                          <Field label="Email Address" required error={errors.email}>
                            <input title="Email Address" placeholder="e.g. maria.santos@gmail.com" className={baseInputClass} type="email" value={data.email || ''} onChange={e => setData('email', e.target.value)} />
                          </Field>
                        </div>
                      </div>

                      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-2">
                        {isGuest || !sender?.address ? (
                          <div className="space-y-4">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Pickup Address in Australia</p>
                              <p className="text-xs text-zinc-400 dark:text-zinc-500">Provide the collection address where our driver will inspect and pick up your balikbayan box.</p>
                            </div>

                            <Field label="Street Address" required error={errors.address} hint="Unit / House number, street name">
                              <input
                                title="Street Address"
                                placeholder="e.g. Unit 3, 42 King Street"
                                className={baseInputClass}
                                value={data.address || ''}
                                onChange={(e) => setData('address', e.target.value)}
                              />
                            </Field>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="md:col-span-1">
                                <Field label="Suburb" required error={errors.suburb}>
                                  <SuburbSelect
                                    value={data.suburb || ''}
                                    onChange={handleSuburbChange}
                                    suburbs={suburbs}
                                    placeholder="Select suburb..."
                                  />
                                </Field>
                              </div>

                              <div>
                                <Field label="State" required error={errors.state}>
                                  <select
                                    className={cn(baseInputClass)}
                                    value={data.state || 'NSW'}
                                    onChange={(e) => setData('state', e.target.value)}
                                  >
                                    {AUSTRALIAN_STATES.map((st) => (
                                      <option key={st} value={st}>
                                        {st}
                                      </option>
                                    ))}
                                  </select>
                                </Field>
                              </div>

                              <div>
                                <Field label="Postcode" required error={errors.postcode}>
                                  <input
                                    title="Postcode"
                                    placeholder="e.g. 2000"
                                    maxLength={4}
                                    className={baseInputClass}
                                    value={data.postcode || ''}
                                    onChange={(e) => setData('postcode', e.target.value)}
                                  />
                                </Field>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Pickup Address & Location</p>
                            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                              {data.address}, {data.suburb}, {data.state} {data.postcode}
                            </p>
                            <div className="mt-2 rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/20 p-4 flex items-start gap-3">
                              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                              <div className="text-xs text-amber-800 dark:text-amber-300">
                                <span className="font-semibold">Need to use a different pickup address?</span> To avoid data confusion, pickup address and GPS location coordinates must be updated in your settings. Please go to <a href="/settings/profile" className="underline font-bold hover:text-amber-950 dark:hover:text-amber-200">Settings</a> to change your pickup address or add a new pickup address.
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>

                <section className="space-y-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <SectionHeader
                    title={data.booking_type === 'drop_off' ? 'Drop-Off Schedule' : 'Pickup Schedule'}
                    subtitle={data.booking_type === 'drop_off' ? 'Choose your preferred drop-off date' : 'Choose your preferred pickup date'}
                  />

                  {/* Compact Collection Method Segmented Control */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Collection Method
                      </label>
                      <span className="text-[11px] text-zinc-400">
                        {data.booking_type === 'drop_off' ? 'Drop-off at Gold Coast depot' : 'Doorstep collection'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/60">
                      <button
                        type="button"
                        onClick={() => {
                          const detected = data.suburb ? resolveZoneIdForSuburb(data.suburb) : '';
                          setData((prev: any) => ({
                            ...prev,
                            booking_type: 'home_pickup',
                            pickup_zone_id: detected || prev.pickup_zone_id,
                          }));
                          clearErrors('booking_type');
                        }}
                        className={cn(
                          "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer",
                          data.booking_type === 'home_pickup'
                            ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/80 dark:border-zinc-700"
                            : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                        )}
                      >
                        <Truck className={cn("size-4 shrink-0", data.booking_type === 'home_pickup' ? "text-brand-rust" : "text-zinc-400")} />
                        <span>Home Pick-Up</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setData((prev: any) => ({
                            ...prev,
                            booking_type: 'drop_off',
                            pickup_zone_id: '',
                          }));
                          clearErrors('booking_type');
                          clearErrors('pickup_zone_id');
                        }}
                        className={cn(
                          "flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer",
                          data.booking_type === 'drop_off'
                            ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs border border-zinc-200/80 dark:border-zinc-700"
                            : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                        )}
                      >
                        <Building2 className={cn("size-4 shrink-0", data.booking_type === 'drop_off' ? "text-sky-600" : "text-zinc-400")} />
                        <span>Drop-Off at Depot</span>
                      </button>
                    </div>
                  </div>

                  {/* Home Pickup Zone Detection (Auto-assigned based on suburb or selected) */}
                  {data.booking_type === 'home_pickup' && (
                    <div className="space-y-3">
                      {selectedZone ? (
                        <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 text-xs shadow-2xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 shrink-0">
                              <MapPin className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-zinc-900 dark:text-zinc-100 font-semibold truncate">
                                Pickup Area: <span className="font-bold text-emerald-800 dark:text-emerald-300">{selectedZone.name}</span>
                              </p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                {data.suburb ? `Auto-assigned from suburb "${data.suburb}"` : 'Selected service area'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                              <CheckCircle className="size-3" /> Area Assigned
                            </span>
                            <button
                              type="button"
                              onClick={() => setData('pickup_zone_id', '')}
                              className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline cursor-pointer"
                            >
                              Change
                            </button>
                          </div>
                        </div>
                      ) : data.suburb ? (
                        <Field
                          label="Pickup Area"
                          required
                          error={errors.pickup_zone_id}
                          hint={`We couldn't automatically match "${data.suburb}" to a pickup zone. Please select your pickup area from the list.`}
                        >
                          <select
                            className={cn(baseInputClass)}
                            value={data.pickup_zone_id || ''}
                            onChange={(e) => {
                              setData('pickup_zone_id', e.target.value);
                              clearErrors('pickup_zone_id');
                            }}
                            disabled={!!editingBooking}
                          >
                            <option value="" disabled>Select your pickup area</option>
                            {pickupZones?.map((zone: any) => (
                              <option key={zone.id} value={zone.id}>
                                {zone.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                      ) : (
                        <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="flex size-8 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                              <MapPin className="size-4" />
                            </div>
                            <div className="space-y-1 min-w-0">
                              <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                Suburb or Pickup Area Required
                              </p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                                Please select your <strong>Suburb</strong> in the address section above to automatically detect your pickup area and see available collection schedules.
                              </p>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800">
                            <Field label="Or select your pickup area directly" hint="Optional if you already know your pickup zone">
                              <select
                                className={cn(baseInputClass)}
                                value={data.pickup_zone_id || ''}
                                onChange={(e) => {
                                  setData('pickup_zone_id', e.target.value);
                                  clearErrors('pickup_zone_id');
                                }}
                                disabled={!!editingBooking}
                              >
                                <option value="">-- Choose Pickup Area --</option>
                                {pickupZones?.map((zone: any) => (
                                  <option key={zone.id} value={zone.id}>
                                    {zone.name}
                                  </option>
                                ))}
                              </select>
                            </Field>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Placeholder when pickup area is not yet determined */}
                  {data.booking_type === 'home_pickup' && !selectedZone && (
                    <div className="rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 text-center space-y-2 bg-zinc-50/40 dark:bg-zinc-900/20">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mx-auto">
                        <CalendarIcon className="size-5" />
                      </div>
                      <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        Pickup Schedule Will Appear Here
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                        Once your suburb or pickup area is selected, operating schedule, advance notice rules, and upcoming collection runs will display here.
                      </p>
                    </div>
                  )}

                  {/* Pickup Rules & Schedule Showcase */}
                  {(data.booking_type === 'drop_off' || (data.booking_type === 'home_pickup' && !!selectedZone)) && (
                    <PickupScheduleShowcase />
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {(data.booking_type === 'drop_off' || (data.booking_type === 'home_pickup' && !!selectedZone)) && (
                      <Field
                        label={data.booking_type === 'drop_off' ? 'Preferred Drop-Off Date' : 'Preferred Pickup Date'}
                        required
                        error={errors.preferred_date}
                        hint={`Minimum ${activeLogistics?.leadTimeDays ?? 2} days lead time required.`}
                      >
                        <div className="flex w-full items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "flex-1 h-12 w-full justify-start text-left font-normal rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800",
                                  !data.preferred_date && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {data.preferred_date ? format(new Date(data.preferred_date), "PPP") : <span>Pick a date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={data.preferred_date ? new Date(data.preferred_date) : undefined}
                                onSelect={(date) => {
                                  if (date) {
                                    const evalRes = evaluateDateAvailability(date, activeLogistics);
                                    const [hhStr, mmStr] = (evalRes.timeStart || '09:00').split(':');
                                    const hours = parseInt(hhStr, 10) || 9;
                                    const minutes = parseInt(mmStr, 10) || 0;

                                    const newDate = new Date(date);
                                    newDate.setHours(hours, minutes, 0, 0);

                                    const offset = newDate.getTimezoneOffset() * 60000;
                                    const localDate = new Date(newDate.getTime() - offset);

                                    setData('preferred_date', localDate.toISOString().slice(0, 16));
                                    clearErrors('preferred_date');
                                  }
                                }}
                                disabled={(date) => {
                                  if (!activeLogistics) {
                                    return false;
                                  }
                                  return evaluateDateAvailability(date, activeLogistics).isInvalid;
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>

                        {data.preferred_date && (() => {
                          const evalRes = evaluateDateAvailability(data.preferred_date, activeLogistics);
                          if (evalRes.isInvalid) return null;
                          return (
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                              <CheckCircle className="size-3.5 shrink-0" />
                              <span>
                                Confirmed: <strong>{format(new Date(data.preferred_date), 'EEEE, MMMM d, yyyy')}</strong> ({formatTime(evalRes.timeStart || '08:00')} – {formatTime(evalRes.timeEnd || '17:00')})
                              </span>
                            </div>
                          );
                        })()}
                      </Field>
                    )}

                    {(data.booking_type === 'drop_off' || (data.booking_type === 'home_pickup' && !!data.pickup_zone_id)) && (
                      <Field
                        label={data.booking_type === 'drop_off' ? 'Additional Drop-Off Notes' : 'Additional Pickup Notes'}
                        hint={data.booking_type === 'drop_off' ? 'Estimated arrival time or depot remarks.' : 'Gate codes, parking info, etc.'}
                      >
                        <textarea
                          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-800 min-h-25"
                          placeholder={data.booking_type === 'drop_off' ? 'Optional remarks for warehouse team...' : 'Optional notes for the driver...'}
                          value={data.notes || ''}
                          onChange={e => setData('notes', e.target.value)}
                        />
                      </Field>
                    )}
                  </div>
                </section>
              </form>
            )}

            {/* STEP 2: BOXES & RECIPIENTS */}
            {currentStep === 2 && (
              <form onSubmit={submit} className="space-y-8">
                {/* Primary Recipient Information */}
                <section className="space-y-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                    <SectionHeader title="Primary Recipient" subtitle="Who is receiving these boxes?" />
                    {savedRecipients && savedRecipients.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 shrink-0 hidden sm:inline">Use Saved Contact:</span>
                        <select
                          className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900 px-3 pr-8 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-rust/20 focus:border-brand-rust transition-all cursor-pointer shadow-2xs"
                          value={data.boxes[0].recipient_id || ''}
                          onChange={e => applySavedRecipient(e.target.value)}
                          aria-label="Select Saved Contact"
                        >
                          <option value="">+ Enter New Recipient (Manual)</option>
                          {savedRecipients.map((rec: any) => (
                            <option key={rec.id} value={rec.id}>
                              👤 {rec.name} {rec.city ? `(${rec.city})` : rec.area?.name ? `(${rec.area.name})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Show indicator when using saved recipient */}
                  {data.boxes[0].recipient_id && (
                    <div className="rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 p-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <ShieldCheck className="size-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Using saved contact. Recipient details auto-filled & locked.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => applySavedRecipient('')}
                        className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
                      >
                        Clear / Edit Manually
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="First Name" required error={errors[`boxes.0.recipient_first_name` as keyof typeof errors]}>
                      <input
                        title="Receiver First Name"
                        className={baseInputClass}
                        placeholder="Receiver's first name"
                        value={data.boxes[0].recipient_first_name || ''}
                        disabled={!!data.boxes[0].recipient_id}
                        onChange={e => updatePrimaryRecipient('recipient_first_name', e.target.value)}
                      />
                    </Field>
                    <Field label="Last Name" required error={errors[`boxes.0.recipient_last_name` as keyof typeof errors]}>
                      <input
                        title="Receiver Last Name"
                        className={baseInputClass}
                        placeholder="Receiver's last name"
                        value={data.boxes[0].recipient_last_name || ''}
                        disabled={!!data.boxes[0].recipient_id}
                        onChange={e => updatePrimaryRecipient('recipient_last_name', e.target.value)}
                      />
                    </Field>
                  </div>

                  <Field label="Physical Distribution Point (Address)" required error={errors[`boxes.0.recipient_address` as keyof typeof errors]}>
                    <input
                      title="Recipient Address"
                      className={baseInputClass}
                      placeholder="House number, street, barangay..."
                      value={data.boxes[0].recipient_address || ''}
                      disabled={!!data.boxes[0].recipient_id}
                      onChange={e => updatePrimaryRecipient('recipient_address', e.target.value)}
                    />
                  </Field>

                  <div className="mt-4 mb-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">Pin Delivery Location on Map</p>
                    {!data.boxes[0].recipient_id ? (
                      <>
                        <p className="text-xs text-muted-foreground mb-2">Click on the map or use <strong>"Use My Location"</strong> to auto-fill the address fields below.</p>
                        <LocationPickerMap
                          initialCenter={data.boxes[0].recipient_latitude && data.boxes[0].recipient_longitude ? [data.boxes[0].recipient_latitude, data.boxes[0].recipient_longitude] : [14.5995, 120.9842]}
                          onLocationSelect={(lat, lng, address) => {
                            setData((currentData: any) => {
                              const newBoxes = currentData.boxes.map((box: any) => {
                                const newBox = {
                                  ...box,
                                  recipient_latitude: lat,
                                  recipient_longitude: lng,
                                  ...(address ? {
                                    recipient_address: address.address || '',
                                    recipient_city: address.city || address.suburb || '',
                                    recipient_province: address.province || address.state || '',
                                    recipient_zip_code: address.postcode || '',
                                  } : {}),
                                };
                                if (address) {
                                  newBox.area_id = resolveDestinationAreaId(
                                    newBox.recipient_province,
                                    newBox.recipient_city,
                                  );
                                }
                                return newBox;
                              });
                              return { ...currentData, boxes: newBoxes };
                            });
                          }}
                        />
                      </>
                    ) : (
                      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          Location data is from saved contact. To update, please edit the contact in your saved recipients list.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="City" required error={errors[`boxes.0.recipient_city` as keyof typeof errors]}>
                      <input
                        title="City"
                        placeholder="City"
                        className={baseInputClass}
                        value={data.boxes[0].recipient_city || ''}
                        disabled={!!data.boxes[0].recipient_id}
                        onChange={e => updatePrimaryRecipient('recipient_city', e.target.value)}
                      />
                    </Field>
                    <Field label="Province" required error={errors[`boxes.0.recipient_province` as keyof typeof errors]}>
                      <select
                        className={baseInputClass}
                        value={data.boxes[0].recipient_province || ''}
                        disabled={!!data.boxes[0].recipient_id}
                        onChange={e => updatePrimaryRecipient('recipient_province', e.target.value)}
                        aria-label="Province"
                      >
                        <option value="">Select Province...</option>
                        {provinces?.map((p: any) => (
                          <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Zip Code" required error={errors[`boxes.0.recipient_zip_code` as keyof typeof errors]}>
                      <input
                        title="Zip Code"
                        placeholder="Zip Code"
                        className={baseInputClass}
                        value={data.boxes[0].recipient_zip_code || ''}
                        disabled={!!data.boxes[0].recipient_id}
                        onChange={e => updatePrimaryRecipient('recipient_zip_code', e.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Primary Contact Number" required error={errors[`boxes.0.recipient_phone` as keyof typeof errors]}>
                      <PhoneInput
                        value={data.boxes[0].recipient_phone || ''}
                        onChange={val => updatePrimaryRecipient('recipient_phone', val)}
                        defaultCountryCode="PH"
                        disabled={!!data.boxes[0].recipient_id}
                      />
                    </Field>
                    <Field label="Secondary Contact Number" hint="Optional" error={errors[`boxes.0.recipient_secondary_phone` as keyof typeof errors]}>
                      <PhoneInput
                        value={data.boxes[0].recipient_secondary_phone || ''}
                        onChange={val => updatePrimaryRecipient('recipient_secondary_phone', val)}
                        defaultCountryCode="PH"
                        disabled={!!data.boxes[0].recipient_id}
                      />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label="Receiver Email" required error={errors[`boxes.0.recipient_email` as keyof typeof errors]}>
                        <input
                          title="Receiver Email"
                          className={baseInputClass}
                          type="email"
                          placeholder="recipient@example.com"
                          value={data.boxes[0].recipient_email || ''}
                          disabled={!!data.boxes[0].recipient_id}
                          onChange={e => updatePrimaryRecipient('recipient_email', e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>

                  <Field
                    label="Receiver Landmarks"
                    error={errors[`boxes.0.recipient_landmarks` as keyof typeof errors]}
                    hint={data.boxes[0].recipient_id ? "Landmarks are from saved contact" : "Beside the church, yellow gate, etc."}
                  >
                    <div className="relative">
                      <input
                        title="Receiver Landmarks"
                        className={baseInputClass}
                        placeholder="Help the driver find the location..."
                        value={data.boxes[0].recipient_landmarks || ''}
                        disabled={!!data.boxes[0].recipient_id}
                        onChange={e => updatePrimaryRecipient('recipient_landmarks', e.target.value)}
                      />
                      {!data.boxes[0].recipient_id && (
                        <button
                          type="button"
                          onClick={() => getCurrentLocation('recipient')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-sky-600 transition-colors"
                          title="Capture GPS Coordinates"
                        >
                          <MapPinned className="size-4" />
                        </button>
                      )}
                    </div>
                  </Field>
                </section>

                <section className="space-y-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                    <SectionHeader title="Your Units" subtitle="Define box types and destinations" />
                    <Button type="button" onClick={addBox} variant="outline" className="h-10 rounded-xl border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold px-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all text-xs">
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Box
                    </Button>
                  </div>

                  <div className="space-y-6">
                    {data.boxes.map((box, index) => (
                      <div key={index} className="relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 group">
                        {index > 0 && (
                          <button
                            type="button"
                            title="Remove Box"
                            onClick={() => removeBox(index)}
                            className="absolute right-4 top-4 h-8 w-8 flex items-center justify-center rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all"
                          >
                            <X className="size-4" />
                          </button>
                        )}

                        <div className="space-y-6">
                          {/* Unit Header */}
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-800 text-white shadow-sm">
                              <Package className="size-5" />
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Unit {String(index + 1).padStart(2, '0')}</p>
                              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Package Details</p>
                            </div>
                            <div className="ml-auto text-right">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Unit Value</p>
                                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">${getBoxPrice(box).toFixed(0)}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Box Type / Custom Size Toggle */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                                  Box Type {!box.is_custom_size && <span className="ml-1 text-red-500">*</span>}
                                </label>
                                {/* Custom Size Toggle */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = !box.is_custom_size;
                                    const newBoxes = [...data.boxes];
                                    newBoxes[index] = {
                                      ...newBoxes[index],
                                      is_custom_size: next,
                                      box_type_id: next ? '' : newBoxes[index].box_type_id,
                                      custom_length: '',
                                      custom_width: '',
                                      custom_height: '',
                                    };
                                    setData('boxes', newBoxes);
                                  }}
                                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                                    box.is_custom_size
                                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                                      : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-sky-400 hover:text-sky-600'
                                  }`}
                                  title="Toggle custom size entry"
                                >
                                  <Ruler className="size-3" />
                                  {box.is_custom_size ? 'Custom' : 'Custom Size?'}
                                </button>
                              </div>

                              {!box.is_custom_size ? (
                                <div className="grid grid-cols-2 gap-2">
                                  {boxTypes?.filter((bt: any) => !bt.name?.toLowerCase().includes('cbm') && bt.name?.toLowerCase() !== 'custom box').map((bt: any) => {
                                    const hasPrice = (() => {
                                      if (!box.area_id) return true; // no area yet — allow selection
                                      const exactPriceRecord = boxPrices?.find(
                                        (p: any) => p.area_id.toString() === box.area_id.toString() && p.box_type_id.toString() === bt.id.toString() && p.pickup_zone_id?.toString() === data.pickup_zone_id?.toString()
                                      );

                                      const fallbackPriceRecord = boxPrices?.find(
                                        (p: any) => p.area_id.toString() === box.area_id.toString() && p.box_type_id.toString() === bt.id.toString() && !p.pickup_zone_id
                                      );

                                      const priceRecord = exactPriceRecord || fallbackPriceRecord;
                                      return priceRecord ? parseFloat(priceRecord.price) > 0 : false;
                                    })();

                                    const isSelected = box.box_type_id?.toString() === bt.id.toString();
                                    const capacityTip = (() => {
                                      const lower = bt.name.toLowerCase();
                                      if (lower.includes('jumbo')) return 'Fits comforters, appliances, bulky goods';
                                      if (lower.includes('standard')) return 'Fits ~20 canned goods, 6 shoes, clothes (~60kg)';
                                      if (lower.includes('junior') || lower.includes('mini')) return 'Fits chocolates, gifts, toiletries';
                                      return 'Standard Balikbayan cargo';
                                    })();

                                    return (
                                      <button
                                        key={bt.id}
                                        type="button"
                                        onClick={() => {
                                          if (!hasPrice) {
                                            toast.error('Unable to select this box size — no price is configured for this destination area. Please contact customer support.');
                                            return;
                                          }
                                          updateBox(index, 'box_type_id', bt.id.toString());
                                        }}
                                        title={!hasPrice ? 'No price configured — contact customer support' : (bt.dimensions || bt.name)}
                                        className={`relative flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition-all ${
                                          !hasPrice
                                            ? 'border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/50 opacity-50 cursor-not-allowed'
                                            : isSelected
                                              ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 shadow-md ring-2 ring-zinc-900/10'
                                              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-500 cursor-pointer shadow-xs'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between w-full">
                                          <span className={`text-xs font-black truncate ${
                                            !hasPrice ? 'text-zinc-400 dark:text-zinc-500' : isSelected ? 'text-white dark:text-zinc-900' : 'text-zinc-900 dark:text-zinc-100'
                                          }`}>
                                            {bt.name.toUpperCase()}
                                          </span>
                                          {bt.dimensions && (
                                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                                              isSelected ? 'bg-white/20 text-white dark:text-zinc-900 dark:bg-black/10' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                                            }`}>
                                              {bt.dimensions}
                                            </span>
                                          )}
                                        </div>
                                        <p className={`text-[10px] leading-tight mt-0.5 line-clamp-2 ${
                                          isSelected ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-500 dark:text-zinc-400'
                                        }`}>
                                          {capacityTip}
                                        </p>
                                        {!hasPrice && box.area_id && (
                                          <span className="text-[9px] font-bold uppercase tracking-wider text-rose-500 mt-1">
                                            No rate for area
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>

                              ) : (
                                /* Custom Size Dimension Inputs */
                                <div className="space-y-2">
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                        L (cm) <span className="text-red-500">*</span>
                                      </label>
                                      <input
                                        type="number"
                                        min="1"
                                        max="500"
                                        step="0.1"
                                        placeholder="100"
                                        title="Length in cm"
                                        className={baseInputClass}
                                        value={box.custom_length || ''}
                                        onChange={e => updateBox(index, 'custom_length', e.target.value)}
                                      />
                                      {errors[`boxes.${index}.custom_length` as keyof typeof errors] && (
                                        <p className="text-xs font-medium text-red-600">{errors[`boxes.${index}.custom_length` as keyof typeof errors]}</p>
                                      )}
                                    </div>
                                    <div className="space-y-1">
                                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                        W (cm) <span className="text-red-500">*</span>
                                      </label>
                                      <input
                                        type="number"
                                        min="1"
                                        max="500"
                                        step="0.1"
                                        placeholder="80"
                                        title="Width in cm"
                                        className={baseInputClass}
                                        value={box.custom_width || ''}
                                        onChange={e => updateBox(index, 'custom_width', e.target.value)}
                                      />
                                      {errors[`boxes.${index}.custom_width` as keyof typeof errors] && (
                                        <p className="text-xs font-medium text-red-600">{errors[`boxes.${index}.custom_width` as keyof typeof errors]}</p>
                                      )}
                                    </div>
                                    <div className="space-y-1">
                                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                        H (cm) <span className="text-red-500">*</span>
                                      </label>
                                      <input
                                        type="number"
                                        min="1"
                                        max="500"
                                        step="0.1"
                                        placeholder="170"
                                        title="Height in cm"
                                        className={baseInputClass}
                                        value={box.custom_height || ''}
                                        onChange={e => updateBox(index, 'custom_height', e.target.value)}
                                      />
                                      {errors[`boxes.${index}.custom_height` as keyof typeof errors] && (
                                        <p className="text-xs font-medium text-red-600">{errors[`boxes.${index}.custom_height` as keyof typeof errors]}</p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Live CBM Calculator */}
                                  {(() => {
                                    const l = parseFloat(box.custom_length || '0');
                                    const w = parseFloat(box.custom_width  || '0');
                                    const h = parseFloat(box.custom_height || '0');

                                    if (l <= 0 || w <= 0 || h <= 0) {
                                      return (
                                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
                                          Enter dimensions above to see the estimated cost.
                                        </p>
                                      );
                                    }

                                    const cbm = (l * w * h) / 1_000_000;
                                    const cbmRate = getCbmRate(box.area_id);
                                    const estimated = cbmRate > 0 ? Math.round(cbm * cbmRate * 100) / 100 : null;

                                    return (
                                      <div className="rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 p-3 space-y-1.5">
                                        <div className="flex items-center justify-between">
                                          <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400 flex items-center gap-1">
                                            <Ruler className="size-3" /> Volume
                                          </span>
                                          <span className="text-sm font-bold text-sky-700 dark:text-sky-300 font-mono">
                                            {cbm.toFixed(4)} m³
                                          </span>
                                        </div>
                                        {cbmRate > 0 && (
                                          <div className="flex items-center justify-between text-[11px] text-sky-600/90 dark:text-sky-400/90">
                                            <span>Rate per m³</span>
                                            <span className="font-semibold font-mono">${cbmRate.toFixed(2)} / m³</span>
                                          </div>
                                        )}
                                        {estimated !== null ? (
                                          <div className="flex items-center justify-between border-t border-sky-200 dark:border-sky-800/50 pt-1.5">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                                              Est. Cost
                                            </span>
                                            <div className="text-right">
                                              <span className="text-base font-black text-sky-700 dark:text-sky-200">${estimated.toFixed(2)}</span>
                                              <p className="text-[9px] text-sky-500 dark:text-sky-400 uppercase tracking-wider">Subject to admin review</p>
                                            </div>
                                          </div>
                                        ) : !box.area_id ? (
                                          <p className="text-[10px] text-amber-600 dark:text-amber-400 border-t border-sky-200 dark:border-sky-800/50 pt-1.5">
                                            Select a destination area to see the estimated cost.
                                          </p>
                                        ) : (
                                          <p className="text-[10px] text-amber-600 dark:text-amber-400 border-t border-sky-200 dark:border-sky-800/50 pt-1.5">
                                            Estimated cost will be calculated by admin after submission.
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}

                              {!box.is_custom_size && errors[`boxes.${index}.box_type_id` as keyof typeof errors] && (
                                <p className="text-xs font-medium text-red-600">{errors[`boxes.${index}.box_type_id` as keyof typeof errors]}</p>
                              )}
                            </div>

                            {/* Destination Area is now automatically derived from the Province selection */}
                          </div>


                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={addBox}
                    className="w-full flex items-center justify-center gap-3 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all font-semibold uppercase tracking-wider text-xs bg-zinc-50/30 dark:bg-zinc-900/50"
                  >
                    <PlusCircle className="size-5" /> Add Another Box
                  </button>
                </section>

                {/* Empty Box Delivery Add-On */}
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="flex items-center gap-3 cursor-pointer select-none min-w-0">
                      <input
                        type="checkbox"
                        checked={Number(data.empty_box_count || 0) > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setData('empty_box_count', Math.max(1, Number(data.empty_box_count) || data.boxes.length || 1));
                          } else {
                            setData('empty_box_count', 0);
                          }
                        }}
                        className="size-4.5 rounded border-zinc-300 dark:border-zinc-700 text-brand-rust focus:ring-brand-rust"
                      />
                      <div className="min-w-0">
                        <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <Package className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          Need empty boxes delivered in advance? ($10.00 each)
                        </span>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                          Heavy-duty balikbayan boxes dispatched to your address prior to pickup
                        </p>
                      </div>
                    </label>

                    {Number(data.empty_box_count || 0) > 0 && (
                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto bg-zinc-50 dark:bg-zinc-800/80 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                        <span className="text-xs font-semibold text-zinc-500">Qty:</span>
                        <button
                          type="button"
                          onClick={() => setData('empty_box_count', Math.max(1, (Number(data.empty_box_count) || 1) - 1))}
                          className="size-6 rounded-lg border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-200 transition-colors"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-xs text-zinc-900 dark:text-zinc-100 font-mono">
                          {data.empty_box_count}
                        </span>
                        <button
                          type="button"
                          onClick={() => setData('empty_box_count', (Number(data.empty_box_count) || 1) + 1)}
                          className="size-6 rounded-lg border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-200 transition-colors"
                        >
                          <PlusCircle className="size-3.5" />
                        </button>
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 font-mono pl-1.5 border-l border-zinc-200 dark:border-zinc-700">
                          +${((Number(data.empty_box_count) || 0) * (data.empty_box_fee || 10)).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </form>
            )}

            {/* STEP 3: REVIEW DETAILS */}
            {currentStep === 3 && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Review Booking Details</h2>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Please verify all shipment information before proceeding to payment.</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300 font-medium shrink-0">
                    <ShieldCheck className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Review carefully before payment</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left 2 Cols: Sender & Pickup + Cargo Breakdown */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Card 1: Sender & Pickup Details */}
                    <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                          <MapPinned className="size-5 text-brand-rust" />
                          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">
                            {data.booking_type === 'drop_off' ? 'Sender & Drop-Off Information' : 'Sender & Pickup Information'}
                          </h3>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentStep(1)}
                          className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 h-8 px-3 rounded-lg"
                        >
                          {data.booking_type === 'drop_off' ? 'Edit Drop-Off Details' : 'Edit Pickup Details'}
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Collection Method</p>
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                            {data.booking_type === 'drop_off' ? (
                              <><Building2 className="size-3.5 text-sky-600" /> Drop-Off at Depot</>
                            ) : (
                              <><Truck className="size-3.5 text-emerald-600" /> Home Pick-Up</>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                            {data.booking_type === 'drop_off' ? 'Preferred Drop-Off Date' : 'Preferred Pickup Date'}
                          </p>
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <CalendarIcon className="size-3.5" />
                            {data.preferred_date ? format(new Date(data.preferred_date), 'PPP') : 'Not specified'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Sender Name</p>
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">{data.first_name} {data.last_name}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Contact Number</p>
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {data.mobile}
                            {data.secondary_mobile && (
                              <span className="text-xs font-normal text-zinc-500 ml-1.5">• Alt: {data.secondary_mobile}</span>
                            )}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Email Address</p>
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">{data.email}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                            {data.booking_type === 'drop_off' ? 'Sender Address' : 'Pickup Address'}
                          </p>
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {data.address}, {data.suburb} {data.state} {data.postcode}
                          </p>
                          {data.booking_type === 'drop_off' ? (
                            <div className="mt-1 space-y-0.5">
                              <p className="text-xs text-sky-600 dark:text-sky-400 flex items-center gap-1">
                                <MapPinned className="size-3 shrink-0" /> Drop-Off Depot: {depotAddress}
                              </p>
                              {depotInstructions && (
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 pl-4">
                                  {depotInstructions}
                                </p>
                              )}
                            </div>
                          ) : (
                            data.pickup_zone_id && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                Zone: {pickupZones?.find((z: any) => z.id.toString() === data.pickup_zone_id.toString())?.name || 'Selected Zone'}
                              </p>
                            )
                          )}
                        </div>
                        {data.notes && (
                          <div className="sm:col-span-2 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                              {data.booking_type === 'drop_off' ? 'Drop-Off Notes' : 'Pickup Notes'}
                            </p>
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-0.5">{data.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card 2: Cargo & Recipients Breakdown */}
                    <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                        <div className="flex items-center gap-2">
                          <Package className="size-5 text-brand-rust" />
                          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">Cargo & Recipient Details ({data.boxes.length} item{data.boxes.length !== 1 ? 's' : ''})</h3>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentStep(2)}
                          className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 h-8 px-3 rounded-lg"
                        >
                          Edit Boxes & Recipients
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {data.boxes.map((box: any, index: number) => {
                          const price = getBoxPrice(box);
                          const boxTypeName = box.is_custom_size
                            ? 'Custom Size (CBM)'
                            : boxTypes?.find((bt: any) => bt.id.toString() === box.box_type_id?.toString())?.name || 'Standard Box';
                          const areaName = areas?.find((a: any) => a.id.toString() === box.area_id?.toString())?.name || 'Destination Area';
                          const l = parseFloat(box.custom_length || '0');
                          const w = parseFloat(box.custom_width  || '0');
                          const h = parseFloat(box.custom_height || '0');
                          const cbm = (l * w * h) / 1_000_000;
                          const cbmRate = box.area_id ? getCbmRate(box.area_id) : 0;

                          // Recipient details
                          const recipient = (savedRecipients || []).find((r: any) => r.id.toString() === box.recipient_id?.toString());
                          const recFirstName = recipient?.first_name || box.recipient_first_name || '';
                          const recLastName = recipient?.last_name || box.recipient_last_name || '';
                          const recAddress = recipient?.address || box.recipient_address || '';
                          const recCity = recipient?.city || box.recipient_city || '';
                          const recProvince = recipient?.province || box.recipient_province || '';
                          const recZip = recipient?.zip_code || box.recipient_zip_code || '';
                          const recPhone = recipient?.phone_number || box.recipient_phone || '';
                          const recSecondaryPhone = recipient?.secondary_phone_number || box.recipient_secondary_phone || '';

                          return (
                            <div key={index} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 space-y-3">
                              <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-200 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                    {index + 1}
                                  </span>
                                  <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                                    {boxTypeName}
                                  </span>
                                </div>
                                <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-base">
                                  ${price.toFixed(2)}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Destination Area</p>
                                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">{areaName}</p>
                                </div>

                                {box.is_custom_size ? (
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Dimensions & Volume</p>
                                    <p className="font-semibold text-sky-700 dark:text-sky-300 font-mono">
                                      {l}×{w}×{h} cm ({cbm.toFixed(4)} m³)
                                    </p>
                                    {cbmRate > 0 && (
                                      <p className="text-[10px] text-sky-600 dark:text-sky-400 font-mono">
                                        @ ${cbmRate.toFixed(2)} / m³
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Box Type</p>
                                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">{boxTypeName}</p>
                                  </div>
                                )}

                                <div className="sm:col-span-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-800">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Recipient</p>
                                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                                    {recFirstName} {recLastName} {recPhone ? `• ${recPhone}` : ''} {recSecondaryPhone ? `(Alt: ${recSecondaryPhone})` : ''}
                                  </p>
                                  <p className="text-zinc-600 dark:text-zinc-400 text-xs">
                                    {recAddress}{recCity ? `, ${recCity}` : ''}{recProvince ? `, ${recProvince}` : ''}{recZip ? ` ${recZip}` : ''}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {Number(data.empty_box_count || 0) > 0 && (
                          <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="size-9 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <Package className="size-5" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                                  Empty Box Delivery Add-On
                                </p>
                                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                  {data.empty_box_count} empty box{Number(data.empty_box_count) !== 1 ? 'es' : ''} requested to be delivered in advance
                                </p>
                              </div>
                            </div>
                            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                              ${emptyBoxTotal.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Col: Price Summary Sidebar */}
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-5 sticky top-24">
                      <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base border-b border-zinc-100 dark:border-zinc-800 pb-3">
                        Cost Summary
                      </h3>

                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                          <span>Total Boxes</span>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{data.boxes.length} unit{data.boxes.length !== 1 ? 's' : ''}</span>
                        </div>

                        <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                          <span>Cargo Subtotal</span>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">${cargoSubtotal.toFixed(2)}</span>
                        </div>

                        {Number(data.empty_box_count || 0) > 0 && (
                          <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                            <span>Empty Boxes ({data.empty_box_count}x @ ${(Number(data.empty_box_fee) || 10).toFixed(2)})</span>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">${emptyBoxTotal.toFixed(2)}</span>
                          </div>
                        )}

                        {discountAmount > 0 && (
                          <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                            <span className="flex items-center gap-1.5">
                              <Tag className="size-3.5" /> Promo Discount
                            </span>
                            <span className="font-mono">-${discountAmount.toFixed(2)}</span>
                          </div>
                        )}

                        {/* Promo / Voucher Section */}
                        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                          {/* Active / Applied Voucher Banner */}
                          {data.promo_code && discountAmount > 0 ? (
                            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                              <div className="flex items-center gap-2">
                                <div className="size-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
                                  <CheckCircle className="size-3.5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-black text-xs text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
                                      {data.promo_code}
                                    </span>
                                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                      (-${discountAmount.toFixed(2)})
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                                    {promoSuccessMessage}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={removePromoCode}
                                className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400 p-1 transition-colors"
                                title="Remove promo code"
                              >
                                <X className="size-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <div className="relative flex-1">
                                  <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-zinc-400">
                                    <Tag className="size-3.5" />
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="Enter promo code"
                                    value={promoCodeInput}
                                    onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPromoCode(); } }}
                                    className="w-full pl-8 h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 text-xs uppercase font-bold tracking-wider placeholder:normal-case placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                                  />
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => applyPromoCode()}
                                  disabled={!promoCodeInput.trim() || validatingPromo}
                                  className="h-9 px-3.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all disabled:opacity-50"
                                >
                                  {validatingPromo ? <Loader2 className="size-3 animate-spin" /> : 'Apply'}
                                </Button>
                              </div>
                              {promoError && (
                                <p className="text-red-500 text-[11px] font-medium flex items-center gap-1">
                                  <AlertTriangle className="size-3 shrink-0" /> {promoError}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Available Customer Vouchers (Shopee-style) */}
                          {activePromotions && activePromotions.length > 0 && (
                            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                                  <Sparkles className="size-3 text-amber-500" /> Available Vouchers
                                </span>
                                <span className="text-[10px] text-zinc-400">1-Tap Apply</span>
                              </div>

                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                                {activePromotions.map((promo: any) => {
                                  const isApplied = Boolean(data.promo_code && data.promo_code === promo.code && discountAmount > 0);
                                  return (
                                    <div
                                      key={promo.id || promo.code}
                                      className={cn(
                                        "flex items-center justify-between p-2 rounded-lg border transition-all text-left",
                                        isApplied
                                          ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                                          : "bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-500"
                                      )}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className={cn(
                                          "px-2 py-1 rounded text-[10px] font-black text-center shrink-0 min-w-[58px]",
                                          isApplied
                                            ? "bg-emerald-600 text-white"
                                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/60"
                                        )}>
                                          {getPromoBadge(promo)}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-mono font-bold text-xs text-zinc-900 dark:text-zinc-100 uppercase">
                                              {promo.code}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex-wrap">
                                            {promo.min_spend > 0 && (
                                              <span>Min. ${Number(promo.min_spend).toFixed(0)}</span>
                                            )}
                                            {promo.min_spend > 0 && promo.valid_to && <span>•</span>}
                                            <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium">
                                              <Clock className="size-2.5" />
                                              {getPromoLifespan(promo)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="shrink-0 ml-2">
                                        {isApplied ? (
                                          <button
                                            type="button"
                                            onClick={removePromoCode}
                                            className="text-[11px] font-bold text-red-600 dark:text-red-400 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40"
                                          >
                                            Remove
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => applyPromoCode(promo.code)}
                                            disabled={validatingPromo}
                                            className="text-[11px] font-bold text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-1 rounded-md shadow-xs transition-colors"
                                          >
                                            Use
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-baseline">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">Total Estimate</span>
                          <span className="text-2xl font-black text-brand-rust font-mono">${finalEstimate.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 p-4 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                          <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" /> Transparent Pricing
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                          {isGuest
                            ? 'Review your shipment details above. Click "Proceed to Payment" to choose your payment method and complete your payment securely.'
                            : 'Review your shipment details above. Click "Proceed to Payment" when you are ready to confirm your order.'}
                        </p>
                      </div>

                      {/* Terms & Conditions Agreement for Guest */}
                      {isGuest && (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-zinc-800 dark:text-zinc-200 space-y-2 mt-4">
                          <div className="flex items-start gap-2.5">
                            <input
                              id="guest-agree-terms"
                              type="checkbox"
                              checked={agreeTerms}
                              onChange={(e) => setAgreeTerms(e.target.checked)}
                              className="mt-0.5 rounded border-amber-400 text-brand-rust focus:ring-brand-rust cursor-pointer"
                              required
                            />
                            <div className="leading-relaxed">
                              <label htmlFor="guest-agree-terms" className="cursor-pointer">
                                I agree to the{' '}
                              </label>
                              <a
                                href="/terms"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="font-bold underline text-brand-rust hover:brightness-110 inline-flex items-center gap-0.5 cursor-pointer"
                              >
                                Terms of Service
                                <ExternalLink className="size-3 inline-block ml-0.5 opacity-70" />
                              </a>
                              <label htmlFor="guest-agree-terms" className="cursor-pointer">
                                ,{' '}
                              </label>
                              <a
                                href="/customs-guide"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="font-bold underline text-brand-rust hover:brightness-110 inline-flex items-center gap-0.5 cursor-pointer"
                              >
                                Cargo Prohibited Items Policy
                                <ExternalLink className="size-3 inline-block ml-0.5 opacity-70" />
                              </a>
                              <label htmlFor="guest-agree-terms" className="cursor-pointer">
                                , and understand that Philippine customs packing declaration is required for every balikbayan box.
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: DIRECT PAYMENT CONSOLE (Sender & Guest) */}
            {currentStep === 4 && paymentData && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start animate-in fade-in duration-500">
                  {/* Left Column: Order Summary (Consistent with PaymentConsole design) */}
                  <div className="lg:col-span-2 space-y-6">
                      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
                          <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/50">
                              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">Order Summary</h3>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{paymentData.booking.boxes.length} item{paymentData.booking.boxes.length !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="p-6 space-y-3">
                              {paymentData.booking.boxes.map((box: any, i: number) => (
                                  <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 group/item transition-all hover:bg-white dark:hover:bg-zinc-800 hover:shadow-md">
                                      <div className="h-12 w-12 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shrink-0 shadow-sm group-hover/item:border-zinc-300 dark:group-hover/item:border-zinc-600 transition-colors">
                                          {box.is_custom_size
                                            ? <Ruler className="size-5 text-sky-500" />
                                            : <Package className="size-5 text-zinc-400 group-hover/item:text-zinc-600 dark:group-hover/item:text-zinc-300 transition-colors" />
                                          }
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between mb-1">
                                              <div className="flex flex-col">
                                                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Item {String(i + 1).padStart(2, '0')}</span>
                                                  {box.is_custom_size ? (
                                                    <span className="text-sm font-bold text-sky-700 dark:text-sky-300">
                                                      Custom {box.custom_length}×{box.custom_width}×{box.custom_height} cm
                                                    </span>
                                                  ) : (
                                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{box.box_type?.name || box.boxType?.name || 'Standard Box'}</span>
                                                  )}
                                              </div>
                                              <div className="text-right">
                                                <span className="text-base font-mono font-bold text-zinc-900 dark:text-zinc-100">${parseFloat(box.price_charged || '0').toFixed(2)}</span>
                                                {box.price_is_estimate && (
                                                  <p className="text-[9px] text-amber-600 font-bold uppercase tracking-wider">Est.</p>
                                                )}
                                              </div>
                                          </div>
                                          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                                              {box.is_custom_size && box.custom_length && box.custom_width && box.custom_height && (
                                                <span className="text-sky-500 font-mono">
                                                  {((+box.custom_length * +box.custom_width * +box.custom_height) / 1_000_000).toFixed(4)} m³
                                                </span>
                                              )}
                                              <p className="truncate flex items-center gap-1">
                                                  <MapPinned className="size-3 text-zinc-400" /> {box.recipient?.city}, {box.recipient?.province}
                                              </p>
                                          </div>
                                      </div>
                                  </div>
                              ))}

                              {Number(paymentData.booking.empty_box_count || 0) > 0 && (
                                  <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40">
                                      <div className="h-12 w-12 rounded-xl bg-white dark:bg-zinc-900 flex items-center justify-center border border-amber-200 dark:border-amber-800 shrink-0 shadow-sm text-amber-600 dark:text-amber-400">
                                          <Package className="size-5" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className="flex items-center justify-between mb-0.5">
                                              <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Empty Box Delivery</span>
                                              <span className="text-base font-mono font-bold text-zinc-900 dark:text-zinc-100">
                                                  ${(Number(paymentData.booking.empty_box_count) * Number(paymentData.booking.empty_box_fee || 10)).toFixed(2)}
                                              </span>
                                          </div>
                                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                                              {paymentData.booking.empty_box_count} empty box{Number(paymentData.booking.empty_box_count) !== 1 ? 'es' : ''} ordered (@ ${Number(paymentData.booking.empty_box_fee || 10).toFixed(2)} each)
                                          </p>
                                      </div>
                                  </div>
                              )}

                              <div className="pt-6 mt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
                                  {paymentData.booking.payment_status === 'paid' && (
                                    <div className="flex flex-col gap-2 mb-4 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800">
                                      <div className="flex items-center gap-2">
                                        <CheckCircle className="size-4 text-emerald-600 dark:text-emerald-400" />
                                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Payment Completed</span>
                                      </div>
                                      {paymentData.booking.payment_reference && (
                                        <div className="text-xs text-emerald-600 dark:text-emerald-500 font-mono">
                                          Ref: {paymentData.booking.payment_reference}
                                        </div>
                                      )}
                                      {paymentData.booking.proof_of_payment && (
                                        <a href={`/storage/${paymentData.booking.proof_of_payment}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 dark:text-emerald-500 underline underline-offset-2">
                                          View Proof of Payment
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex justify-between text-sm px-1 font-bold">
                                      <span className="text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-[10px]">Amount Due</span>
                                      <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">${paymentData.booking.payment_status === 'paid' ? '0.00' : finalEstimate.toFixed(2)}</span>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Right Column: Embedded Payment Flow */}
                  <div className="lg:col-span-3">
                      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm">
                          <div className="mb-8 border-b border-zinc-100 dark:border-zinc-800 pb-4 flex items-center justify-between">
                             <SectionHeader title="Payment Details" subtitle="Complete your transaction securely" />
                             <Wallet className="size-5 text-zinc-300" />
                          </div>
                          <PaymentFlow
                            booking={paymentData.booking}
                            stripeKey={paymentData.stripeKey}
                            clientSecret={paymentData.clientSecret}
                            role={isGuest ? 'guest' : 'sender'}
                            backUrl={isGuest ? `/track?tracking_number=${paymentData.booking.reference_number}` : '/bookings'}
                            backLabel={isGuest ? 'Track My Shipment' : 'Go to My Bookings'}
                            onSuccess={() => {
                                setPaymentData((prev: any) => ({
                                    ...prev,
                                    booking: { ...prev.booking, payment_status: 'paid' }
                                }));
                                clearSavedData();
                            }}
                            isLoading={initializingPayment}
                          />
                      </div>
                  </div>
              </div>
            )}

          {Object.keys(errors).length > 0 && (
            <div className="rounded-2xl bg-red-50 dark:bg-red-950/20 p-6 border border-red-100 dark:border-red-900/50">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-3">
                    <AlertTriangle className="size-4" />
                    <p className="text-xs font-bold uppercase tracking-wider">Validation Errors</p>
                </div>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                    {Object.entries(errors).map(([key, err], i) => (
                        <li key={i} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                            <span className="h-1 w-1 rounded-full bg-red-400 dark:bg-red-500" />
                            {getFriendlyError(key, err as string)}
                        </li>
                    ))}
                </ul>
            </div>
          )}

          {currentStep < 4 && (
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-zinc-200 dark:border-zinc-800">
               {currentStep > 1 && (
                  <div className="hidden md:block">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Total Shipment Value</p>
                      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">${finalEstimate.toFixed(0)}</p>
                  </div>
               )}
               <div className="flex items-center gap-4 w-full md:w-auto">
                  {currentStep > 1 && paymentData?.booking?.payment_status !== 'paid' && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={prevStep}
                      disabled={processing || initializingPayment}
                      className="flex-1 md:flex-none h-12 rounded-xl border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-8 font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                    >
                      Back
                    </Button>
                  )}

                  {currentStep === 1 && (
                    <Button
                      type="button"
                      onClick={nextStep}
                      disabled={!data.address || !data.preferred_date || !data.first_name || !data.last_name || !data.mobile || !data.email}
                      className="flex-1 md:w-64 h-12 rounded-xl bg-brand-rust text-white font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-rust/20 flex items-center justify-center gap-2"
                    >
                      Continue <ArrowRight className="size-4" />
                    </Button>
                  )}

                  {currentStep === 2 && (
                    <Button
                      type="button"
                      onClick={nextStep}
                      disabled={data.boxes.some(box =>
                        !box.area_id ||
                        (box.is_custom_size
                          ? (!box.custom_length || !box.custom_width || !box.custom_height)
                          : !box.box_type_id)
                      )}
                      className="flex-1 md:w-64 h-12 rounded-xl bg-brand-rust text-white font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-rust/20 flex items-center justify-center gap-2"
                    >
                      Review Details <ArrowRight className="size-4" />
                    </Button>
                  )}

                  {currentStep === 3 && (
                    <Button
                      type="button"
                      onClick={nextStep}
                      disabled={initializingPayment || (isGuest && !agreeTerms)}
                      className="flex-1 md:w-64 h-12 rounded-xl bg-brand-rust text-white font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-rust/20 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {initializingPayment ? (
                        <><Loader2 className="animate-spin size-4" /> Preparing Payment...</>
                      ) : (
                        <>Proceed to Payment <ArrowRight className="size-4" /></>
                      )}
                    </Button>
                  )}
               </div>
            </div>
          )}
        </div>


      {/* Floating Sticky Pricing Summary Pill */}
      {/* {currentStep < 4 && finalEstimate > 0 && (
          <div className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-30 pointer-events-auto animate-in fade-in slide-in-from-bottom-3 duration-300">
              <div className="glass-dock rounded-2xl px-4 py-2.5 shadow-2xl border border-zinc-200 dark:border-zinc-700 flex items-center gap-3">
                  <div className="size-8 rounded-xl bg-brand-primary text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      {data.boxes.length}
                  </div>
                  <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                          {data.boxes.length === 1 ? '1 Box' : `${data.boxes.length} Boxes`} Estimated
                      </p>
                      <p className="text-base font-black text-zinc-900 dark:text-zinc-100">
                          ${finalEstimate.toFixed(0)} AUD
                      </p>
                  </div>
              </div>
          </div>
      )} */}

      </div>
    </Layout>
  );
}
