import { Head, useForm, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { Package, MapPinned, X, PlusCircle, CheckCircle, ArrowRight, Wallet, Save, AlertTriangle, ShieldCheck, CalendarIcon, Loader2, Ruler, Lock } from 'lucide-react';
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
import AppLayout from '@/layouts/app-layout';
import { validatePhone, COUNTRIES } from '@/lib/countries';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

const baseInputClass = 'h-12 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400';

function StepIndicator({ step }: { step: number }) {
    const steps = [
        { id: 1, label: 'Sender & Pickup' },
        { id: 2, label: 'Boxes & Recipients' },
        { id: 3, label: 'Review Details' },
        { id: 4, label: 'Payment & Confirmation' },
    ];

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((item) => {
                const isActive = step === item.id;
                const isDone = step > item.id;

                return (
                    <div
                        key={item.id}
                        className={`rounded-2xl border p-4 transition-all ${
                            isActive
                                ? 'border-brand-rust/30 bg-brand-rust/5 dark:bg-brand-rust/10'
                                : isDone
                                    ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 dark:border-emerald-700/50'
                                    : 'border-zinc-200 bg-white dark:bg-zinc-900 dark:border-zinc-800'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                                    isDone
                                        ? 'bg-emerald-500 text-white'
                                        : isActive
                                            ? 'bg-brand-rust text-white'
                                            : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                }`}
                            >
                                {isDone ? <CheckCircle className="size-4" /> : item.id}
                            </div>
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Step {item.id} of 4</p>
                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.label}</p>
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
        <div className="space-y-1 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
            {subtitle ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}
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
    savedRecipients?: any[];
    cloneSource?: any;
    editingBooking?: any;
    draftBooking?: any;
    sender?: any;
}

export default function Book() {
  const { auth, areas, provinces, boxTypes, boxPrices, pickupZones, savedRecipients, cloneSource, editingBooking, draftBooking, sender, logistics } = usePage().props as any;

  const senderCountry = editingBooking?.sender?.country || sender?.country || 'Australia';
  const senderCountryCode = COUNTRIES.find(c => c.name === senderCountry)?.code || 'AU';

  const [currentStep, setCurrentStep] = useState(1);
  const [isEditingSender, setIsEditingSender] = useState(!sender || !sender.address);
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
  const hasAppliedDraftSource = useRef(false);
  const hasAppliedQueryDefaults = useRef(false);
  const hasAppliedCloneSource = useRef(false);
  const hasAppliedEditSource = useRef(false);
  const user = auth.user;

  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Home', href: '/dashboard' },
    { title: editingBooking ? 'Edit Booking' : 'Book a Pickup', href: editingBooking ? `/bookings/${editingBooking.id}/edit` : '/book' },
  ];

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
            setData(currentData => ({
              ...currentData,
              notes: (currentData.notes || '') + (currentData.notes ? '\n' : '') + `Pickup GPS Coordinates: ${latitude}, ${longitude}`
            }));
            alert(`Location captured! Coordinates added to notes.`);
          } else if (type === 'recipient') {
            updatePrimaryRecipient('recipient_landmarks', (data.boxes[0].recipient_landmarks || '') + coordsString);
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



  const detectPickupZoneBySuburb = (suburbStr: string) => {
    if (!suburbStr || !pickupZones) return '';
    const searchStr = suburbStr.toLowerCase().trim();
    for (const zone of pickupZones) {
      if (zone.suburbs && Array.isArray(zone.suburbs)) {
        if (zone.suburbs.some((s: any) => {
          const name = typeof s === 'string' ? s : (s.name || '');
          return name.toLowerCase().trim() === searchStr;
        })) {
          return zone.id.toString();
        }
      }
    }
    return '';
  };

  const getInitialValidDate = (zoneId?: string) => {
    let currentLogistics = logistics;

    // Auto-detect zone from suburb if not provided
    if (!zoneId && (sender?.suburb || editingBooking?.sender?.suburb)) {
        zoneId = detectPickupZoneBySuburb(sender?.suburb || editingBooking?.sender?.suburb || '');
    }

    if (zoneId) {
      const zone = pickupZones?.find((z: any) => z.id.toString() === zoneId.toString());
      if (zone) {
        currentLogistics = {
          ...logistics,
          pickupWindows: zone.pickup_windows?.length > 0 ? zone.pickup_windows : logistics.pickupWindows,
          blackoutDates: zone.blackout_dates?.length > 0 ? zone.blackout_dates : logistics.blackoutDates,
          leadTimeDays: zone.lead_time_days ?? logistics.leadTimeDays,
        };
      }
    }

    if (!currentLogistics) {
      return new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16);
    }

    let date = new Date(Date.now() + 86400000 * (currentLogistics.leadTimeDays || 2));
    const windows = currentLogistics.pickupWindows || [];

    // Keep shifting date if it doesn't match any window or is a blackout date
    let attempts = 0;

    while (attempts < 365) { // safety break
      attempts++;
      const dateStr = date.toISOString().slice(0, 10);
      const dayOfWeek = date.getDay();
      const weekOfMonth = Math.ceil(date.getDate() / 7);

      // Blackout check
      if (currentLogistics.blackoutDates?.includes(dateStr)) {
        date = new Date(date.getTime() + 86400000);
        continue;
      }

      // Windows check - if windows are defined, must match at least one
      if (windows.length > 0) {
        const matchingWindow = windows.find((w: any) =>
          w.enabled &&
          w.days.includes(dayOfWeek) &&
          (w.weeks_of_month || [1,2,3,4,5]).includes(weekOfMonth)
        );

        if (!matchingWindow) {
          date = new Date(date.getTime() + 86400000);
          continue;
        }

        // Use the first matching window's start time
        const [hh, mm] = matchingWindow.time_start.split(':');
        date.setHours(parseInt(hh), parseInt(mm), 0, 0);
      } else {
        date.setHours(9, 0, 0, 0); // default if no windows
      }

      break;
    }

    // Offset local timezone format for datetime-local
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);

    return localDate.toISOString().slice(0, 16);
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
    state: sender?.state || '',
    postcode: sender?.postcode || '',
    latitude: sender?.latitude || null,
    longitude: sender?.longitude || null,
    pickup_zone_id: sender?.pickup_zone_id?.toString() || editingBooking?.pickup_zone_id?.toString() || detectPickupZoneBySuburb(sender?.suburb || '') || '',

    // Shared Booking Data
    booking_type: editingBooking?.booking_type || draftBooking?.draft_data?.booking_type || 'home_pickup',
    preferred_date: getInitialValidDate(sender?.pickup_zone_id?.toString() || editingBooking?.pickup_zone_id?.toString() || detectPickupZoneBySuburb(sender?.suburb || '') || ''),
    payment_method: 'stripe',
    notes: '',

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

  const activeLogistics = useMemo(() => {
    if (!data?.pickup_zone_id) return logistics;
    const zone = pickupZones?.find((z: any) => z.id.toString() === data.pickup_zone_id.toString());
    if (!zone) return logistics;

    return {
      ...logistics,
      pickupWindows: zone.pickup_windows?.length > 0 ? zone.pickup_windows : logistics.pickupWindows,
      blackoutDates: zone.blackout_dates?.length > 0 ? zone.blackout_dates : logistics.blackoutDates,
      leadTimeDays: zone.lead_time_days ?? logistics.leadTimeDays,
    };
  }, [data?.pickup_zone_id, pickupZones, logistics]);

  useEffect(() => {
    if (!data.preferred_date || !activeLogistics) return;

    const date = new Date(data.preferred_date);
    let isInvalid = false;

    // Lead time check
    const leadTimeDate = new Date(Date.now() + 86400000 * (activeLogistics.leadTimeDays || 2));
    leadTimeDate.setHours(0, 0, 0, 0);

    if (date < leadTimeDate) {
      isInvalid = true;
    } else {
      // Blackout check
      const offset = date.getTimezoneOffset() * 60000;
      const localDateStr = new Date(date.getTime() - offset).toISOString().slice(0, 10);

      if (activeLogistics.blackoutDates?.includes(localDateStr)) {
        isInvalid = true;
      } else {
        // Pickup windows check
        const windows = activeLogistics.pickupWindows || [];
        if (windows.length > 0) {
          const dayOfWeek = date.getDay();
          const weekOfMonth = Math.ceil(date.getDate() / 7);

          const hasMatchingWindow = windows.some((w: any) =>
            w.enabled &&
            w.days.includes(dayOfWeek) &&
            (w.weeks_of_month || [1,2,3,4,5]).includes(weekOfMonth)
          );

          if (!hasMatchingWindow) {
            isInvalid = true;
          }
        }
      }
    }

    if (isInvalid) {
      const newValidDate = getInitialValidDate(data.pickup_zone_id);
      if (newValidDate && newValidDate !== data.preferred_date) {
        setData('preferred_date', newValidDate);
      }
    }
  }, [data.pickup_zone_id, activeLogistics, data.preferred_date]);

  const PickupScheduleSummary = () => {
    const windows = activeLogistics?.pickupWindows || [];

    if (windows.length === 0) {
      return null;
    }

    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
      <div className="mt-4 rounded-xl border border-sky-100 dark:border-sky-900/30 bg-sky-50/50 dark:bg-sky-950/20 p-4">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Our Collection Schedule</p>
        <ul className="space-y-2">
          {windows.filter((w: any) => w.enabled).map((window: any) => (
            <li key={window.id} className="text-xs text-zinc-600 dark:text-zinc-400">
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{window.label}: </span>
              {window.days.map((d: number) => daysOfWeek[d]).join(', ')}
              <span className="mx-1 text-zinc-400 dark:text-zinc-600">·</span>
              {formatTime(window.time_start)} – {formatTime(window.time_end)}
              {window.weeks_of_month && window.weeks_of_month.length < 5 && (
                <span className="ml-1 text-sky-600 dark:text-sky-400 italic">
                  ({window.weeks_of_month.map((w: number) => w === 1 ? '1st' : w === 2 ? '2nd' : w === 3 ? '3rd' : w === 4 ? '4th' : '5th (29+)').join(', ')} week only)
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const bookingDraftData = {
    preferred_date: data.preferred_date,
    notes: data.notes,
    boxes: data.boxes,
  };

  const handleAutoSaveSetData = useCallback((updatedData: any) => {
    setData((currentData: any) => {
      const currentDraft = {
        preferred_date: currentData.preferred_date,
        notes: currentData.notes,
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
        box?.recipient_landmarks,
        box?.area_id,
        box?.box_type_id,
      ].some((value) => String(value ?? '').trim().length > 0)
    ));

    return hasSenderDetails || hasNotes || hasBoxDetails;
  }, [data.mobile, data.address, data.suburb, data.state, data.postcode]);
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
    if (hasSubmittedBooking) {
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
  }, [draftId, hasSubmittedBooking, data.first_name, data.last_name, data.email, data.mobile, data.address, data.suburb, data.state, data.postcode, data.latitude, data.longitude, data.payment_method, hasMeaningfulDraftData]);

  const canAutoSaveDraft = !editingBooking && !hasSubmittedBooking;

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
      preferred_date: dd.preferred_date || currentData.preferred_date,
      payment_method: dd.payment_method || currentData.payment_method,
      notes: dd.notes || currentData.notes,
      boxes: dd.boxes && dd.boxes.length > 0 ? dd.boxes : currentData.boxes,
    }));
  }, [draftBooking, editingBooking, cloneSource, setData]);

  useEffect(() => {
    if (!editingBooking || hasAppliedEditSource.current) {
      return;
    }

    hasAppliedEditSource.current = true;
    setIsEditingSender(false);
    setData({
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
      preferred_date: editingBooking.preferred_date ? editingBooking.preferred_date.slice(0, 16) : '',
      payment_method: editingBooking.payment_method || 'stripe',
      notes: editingBooking.notes || '',
      boxes: editingBooking.boxes.map((box: any) => ({
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
      })),
    });
  }, [editingBooking, setData]);

  useEffect(() => {
    if (hasAppliedQueryDefaults.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const boxTypeId = params.get('box_type_id');
    const areaId = params.get('area_id');

    if (!boxTypeId && !areaId) {
      return;
    }

    hasAppliedQueryDefaults.current = true;
    setData((currentData) => ({
      ...currentData,
      boxes: [{
        ...(currentData.boxes[0] ?? {}),
        box_type_id: boxTypeId || '',
        area_id: areaId || '',
      }],
    }));
  }, [setData]);

  useEffect(() => {
    if (!cloneSource || hasAppliedCloneSource.current || !Array.isArray(cloneSource.boxes)) {
      return;
    }

    hasAppliedCloneSource.current = true;
    setData((currentData) => ({
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
        recipient_landmarks: box.recipient?.landmarks || '',
        recipient_latitude: box.recipient?.latitude || null,
        recipient_longitude: box.recipient?.longitude || null,
        area_id: box.recipient?.area_id || '',
        box_type_id: box.box_type_id || '',
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

  const applySavedRecipient = (recId: string) => {
    const rec = savedRecipients?.find((r: any) => r.id.toString() === recId) as any;

    if (!rec) {
      const newBoxes = data.boxes.map(box => ({ ...box, recipient_id: '', recipient_first_name: '', recipient_last_name: '', recipient_email: '', recipient_address: '', recipient_city: '', recipient_province: '', recipient_zip_code: '', recipient_phone: '', recipient_landmarks: '', recipient_latitude: null, recipient_longitude: null, area_id: '' }));
      setData('boxes', newBoxes);

      return;
    }

    const newBoxes = data.boxes.map(box => ({
      ...box,
      recipient_id: rec.id,
      recipient_first_name: rec.first_name || rec.name?.split(' ')[0] || '',
      recipient_last_name: rec.last_name || rec.name?.split(' ').slice(1).join(' ') || '',
      recipient_email: rec.email || '',
      recipient_address: rec.address,
      recipient_city: rec.city,
      recipient_province: rec.province,
      recipient_zip_code: rec.zip_code,
      recipient_phone: rec.phone_number || '',
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

  const totalEstimate = data.boxes.reduce((acc, box) => acc + getBoxPrice(box), 0);

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
      const requiredFields: Record<string, string> = {
        first_name: 'First Name',
        last_name: 'Last Name',
        email: 'Email Address',
        mobile: 'Contact Phone',
        address: 'Pickup Address',
        suburb: 'Suburb',
        state: 'State',
        postcode: 'Postcode',
        preferred_date: 'Preferred Pickup Time',
      };
      Object.entries(requiredFields).forEach(([field, label]) => {
        if (!data[field as keyof typeof data]) {
          setError(field as any, `${label} is required`);
          hasErrors = true;
        }
      });

      if (data.mobile) {
        const phoneError = validatePhone(data.mobile, 'Contact Phone', senderCountryCode);

        if (phoneError) {
          setError('mobile', phoneError);
          hasErrors = true;
        }
      }

      // Thorough Pickup Schedule Validation
      if (data.preferred_date) {
        const selectedDate = new Date(data.preferred_date);
        const now = new Date();

        if (selectedDate < now) {
            setError('preferred_date', 'Pickup date cannot be in the past');
            hasErrors = true;
        } else if (logistics) {
            // Lead time check
            const leadTimeDate = new Date(Date.now() + 86400000 * (logistics.leadTimeDays || 2));
            leadTimeDate.setHours(0, 0, 0, 0);

            const checkDate = new Date(selectedDate);
            checkDate.setHours(0, 0, 0, 0);

            if (checkDate < leadTimeDate) {
                setError('preferred_date', `Minimum ${logistics.leadTimeDays || 2} days lead time required`);
                hasErrors = true;
            }

            // Blackout check

            const offset = selectedDate.getTimezoneOffset() * 60000;
            const localDateStr = new Date(selectedDate.getTime() - offset).toISOString().slice(0, 10);

            if (logistics.blackoutDates?.includes(localDateStr)) {
              setError('preferred_date', 'The selected date is an unavailable blackout date');
              hasErrors = true;
            }

            // Pickup windows check
            const windows = logistics.pickupWindows || [];

            if (windows.length > 0) {
                const dayOfWeek = selectedDate.getDay();
                const weekOfMonth = Math.ceil(selectedDate.getDate() / 7);

                const hasMatchingWindow = windows.some((w: any) =>
                    w.enabled &&
                    w.days.includes(dayOfWeek) &&
                    (w.weeks_of_month || [1,2,3,4,5]).includes(weekOfMonth)
                );

                if (!hasMatchingWindow) {
                    setError('preferred_date', 'No pickup service available on the selected day');
                    hasErrors = true;
                }
            }
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

        setInitializingPayment(true);
        setHasSubmittedBooking(true);
        let submittedBookingId: number | null = null;

        try {
            const getXsrfToken = () => {
                const match = document.cookie.match(new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'));
                return match ? decodeURIComponent(match[3]) : '';
            };
            const response = await fetch('/bookings/initialize', {
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
                      recipient_secondary_phone: (!box.recipient_id && box.recipient_secondary_phone) ? box.recipient_secondary_phone.replace(/[\s\-\(\)]/g, '') : (box.recipient_secondary_phone || ''),
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
        recipient_secondary_phone: (!box.recipient_id && box.recipient_secondary_phone) ? box.recipient_secondary_phone.replace(/[\s\-\(\)]/g, '') : (box.recipient_secondary_phone || ''),
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



  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={editingBooking ? 'Edit Booking' : 'Book a Pickup'} />

      <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <Heading
                    eyebrow="Booking Form"
                    title={editingBooking ? `Edit Booking: ${editingBooking.reference_number}` : 'New Booking'}
                    description={editingBooking ? 'Update the details for your active shipment.' : 'Enter your booking details and cargo information to schedule a pickup.'}
                />
                {!editingBooking && (
                    <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={savingDraft}
                        className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 h-10 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all disabled:opacity-50"
                    >
                        <Save className={`size-4 ${savingDraft ? 'animate-spin' : ''}`} />
                        {savingDraft ? 'Saving...' : 'Save Draft'}
                    </button>
                )}
            </div>

            <StepIndicator step={currentStep} />

            <div className="space-y-8">

            {/* STEP 1: SENDER & PICKUP DETAILS */}
            {currentStep === 1 && (
              <form onSubmit={submit} className="space-y-8">
                <section className="space-y-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                    <SectionHeader title="Sender Information" subtitle="Personal and contact details" />
                    {data.address && (
                      <button
                        type="button"
                        onClick={() => setIsEditingSender(!isEditingSender)}
                        className="text-xs font-semibold text-sky-600 hover:text-sky-700"
                      >
                        {isEditingSender ? 'Lock Details' : 'Edit Details'}
                      </button>
                    )}
                  </div>

                  {!data.address ? (
                    <div className="rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex gap-3">
                        <AlertTriangle className="size-5 text-red-600 dark:text-red-400 mt-0.5 md:mt-0 shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-red-900 dark:text-red-200">No Pickup Address Found</p>
                          <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                            You must configure a pickup address in your profile settings before you can book a shipment.
                          </p>
                        </div>
                      </div>
                      <a
                        href="/settings/profile"
                        className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-red-600 text-white font-semibold text-xs uppercase tracking-wider hover:bg-red-700 transition-all whitespace-nowrap"
                      >
                        Configure Pickup Address
                      </a>
                    </div>
                  ) : !isEditingSender ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Full Name</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{data.first_name} {data.last_name}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Contact</p>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{data.mobile}</p>
                        {data.secondary_mobile && (
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">Alt: {data.secondary_mobile}</p>
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="First Name" required error={errors.first_name}>
                          <input title="First Name" placeholder="First Name" className={baseInputClass} value={data.first_name || ''} onChange={e => setData('first_name', e.target.value)} />
                        </Field>
                        <Field label="Last Name" required error={errors.last_name}>
                          <input title="Last Name" placeholder="Last Name" className={baseInputClass} value={data.last_name || ''} onChange={e => setData('last_name', e.target.value)} />
                        </Field>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Field label="Contact Phone" required error={errors.mobile}>
                          <PhoneInput value={data.mobile || ''} onChange={val => setData('mobile', val)} defaultCountryCode={senderCountryCode} />
                        </Field>
                        <Field label="Secondary Phone" error={errors.secondary_mobile} hint="Optional">
                          <PhoneInput value={data.secondary_mobile || ''} onChange={val => setData('secondary_mobile', val)} defaultCountryCode={senderCountryCode} />
                        </Field>
                        <Field label="Email Address" required error={errors.email}>
                          <input title="Email Address" placeholder="Email Address" className={baseInputClass} type="email" value={data.email || ''} onChange={e => setData('email', e.target.value)} />
                        </Field>
                      </div>

                      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-2">
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
                      </div>
                    </div>
                  )}
                </section>

                <section className="space-y-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 md:p-8">
                  <SectionHeader title="Pickup Schedule" subtitle="Choose your preferred pickup date" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(() => {
                      const detectedZoneId = sender?.pickup_zone_id?.toString() || detectPickupZoneBySuburb(data.suburb || '');
                      const isLocked = !!detectedZoneId;
                      const activeZoneId = data.pickup_zone_id || detectedZoneId;
                      const selectedZone = pickupZones?.find((z: any) => z.id.toString() === activeZoneId?.toString());

                      return (
                        <Field
                          label="Pickup Area"
                          required
                          error={errors.pickup_zone_id}
                          hint={!isLocked ? "Select your pickup area to see available schedule." : undefined}
                        >
                          {isLocked ? (
                            <div className="relative flex items-center">
                              <input
                                type="text"
                                readOnly
                                className={cn(
                                  baseInputClass,
                                  "bg-zinc-100/70 dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 font-semibold cursor-not-allowed pr-10 border-zinc-200 dark:border-zinc-800"
                                )}
                                value={selectedZone?.name || 'Assigned Zone'}
                              />
                              <div className="absolute right-3 flex items-center justify-center p-1 rounded-lg bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-500 dark:text-zinc-400" title="Locked based on address">
                                <Lock className="size-3.5" />
                              </div>
                            </div>
                          ) : (
                            <select
                              className={cn(baseInputClass)}
                              value={data.pickup_zone_id || ''}
                              onChange={(e) => setData('pickup_zone_id', e.target.value)}
                              disabled={!!editingBooking}
                            >
                              <option value="" disabled>Select your pickup area</option>
                              {pickupZones?.map((zone: any) => (
                                <option key={zone.id} value={zone.id}>
                                  {zone.name}
                                </option>
                              ))}
                            </select>
                          )}

                          {isLocked && (
                            <div className="mt-2.5 flex items-center gap-2 rounded-xl bg-sky-50/80 dark:bg-sky-950/20 border border-sky-200/70 dark:border-sky-900/40 px-3.5 py-2 text-xs text-sky-800 dark:text-sky-300 font-medium">
                              <ShieldCheck className="size-4 text-sky-600 dark:text-sky-400 shrink-0" />
                              <span>Area auto-assigned and locked based on your address.</span>
                            </div>
                          )}

                          {!isLocked && data.suburb && (
                            <div className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5 leading-snug">
                              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                              <p>We couldn't automatically match <strong>{data.suburb}</strong> to a zone. Please select the closest area carefully.</p>
                            </div>
                          )}
                        </Field>
                      );
                    })()}

                    <Field
                      label="Preferred Pickup Date"
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
                                  const existing = data.preferred_date ? new Date(data.preferred_date) : null;
                                  const hours = existing ? existing.getHours() : 9;
                                  const minutes = existing ? existing.getMinutes() : 0;

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

                                // Lead time check
                                const leadTimeDate = new Date(Date.now() + 86400000 * (activeLogistics.leadTimeDays || 2));
                                leadTimeDate.setHours(0, 0, 0, 0);

                                if (date < leadTimeDate) {
                                  return true;
                                }

                                // Blackout check
                                const offset = date.getTimezoneOffset() * 60000;
                                const localDateStr = new Date(date.getTime() - offset).toISOString().slice(0, 10);

                                if (activeLogistics.blackoutDates?.includes(localDateStr)) {
                                  return true;
                                }

                                // Pickup windows check
                                const windows = activeLogistics.pickupWindows || [];

                                if (windows.length === 0) {
                                  return false;
                                }

                                const dayOfWeek = date.getDay();
                                const weekOfMonth = Math.ceil(date.getDate() / 7);

                                const hasMatchingWindow = windows.some((w: { enabled: boolean; days: number[]; weeks_of_month?: number[] }) =>
                                  w.enabled &&
                                  w.days.includes(dayOfWeek) &&
                                  (w.weeks_of_month || [1,2,3,4,5]).includes(weekOfMonth)
                                );

                                return !hasMatchingWindow;
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>


                      </div>
                      <PickupScheduleSummary />
                    </Field>

                    <Field label="Additional Pickup Notes" hint="Gate codes, parking info, etc.">
                      <textarea
                        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-800 min-h-25"
                        placeholder="Optional notes for the driver..."
                        value={data.notes || ''}
                        onChange={e => setData('notes', e.target.value)}
                      />
                    </Field>
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

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Receiver Phone" required error={errors[`boxes.0.recipient_phone` as keyof typeof errors]}>
                      <PhoneInput
                        value={data.boxes[0].recipient_phone || ''}
                        onChange={val => updatePrimaryRecipient('recipient_phone', val)}
                        defaultCountryCode="PH"
                        disabled={!!data.boxes[0].recipient_id}
                      />
                    </Field>
                    <Field label="Secondary Phone" error={errors[`boxes.0.recipient_secondary_phone` as keyof typeof errors]} hint="Optional">
                      <PhoneInput
                        value={data.boxes[0].recipient_secondary_phone || ''}
                        onChange={val => updatePrimaryRecipient('recipient_secondary_phone', val)}
                        defaultCountryCode="PH"
                        disabled={!!data.boxes[0].recipient_id}
                      />
                    </Field>
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
                                        className={`relative flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all ${
                                          !hasPrice
                                            ? 'border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/50 opacity-50 cursor-not-allowed'
                                            : isSelected
                                              ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-900 dark:bg-zinc-100 shadow-sm'
                                              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-500 cursor-pointer'
                                        }`}
                                      >
                                        <span className={`text-xs font-bold truncate w-full ${
                                          !hasPrice ? 'text-zinc-400 dark:text-zinc-500' : isSelected ? 'text-white dark:text-zinc-900' : 'text-zinc-900 dark:text-zinc-100'
                                        }`}>
                                          {bt.name.toUpperCase()}
                                        </span>
                                        {bt.dimensions && (
                                          <span className={`text-[10px] font-mono truncate w-full ${
                                            !hasPrice ? 'text-zinc-400 dark:text-zinc-500' : isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'
                                          }`}>
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
                          <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base">Sender & Pickup Information</h3>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setCurrentStep(1)}
                          className="text-xs font-semibold text-sky-600 hover:text-sky-700 dark:text-sky-400 h-8 px-3 rounded-lg"
                        >
                          Edit Sender & Pickup
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Sender Name</p>
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">{data.first_name} {data.last_name}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Contact Number</p>
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">{data.mobile}</p>
                          {data.secondary_mobile && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">Alt: {data.secondary_mobile}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Email Address</p>
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">{data.email}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Preferred Pickup Date</p>
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <CalendarIcon className="size-3.5" />
                            {data.preferred_date ? format(new Date(data.preferred_date), 'PPP') : 'Not specified'}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Pickup Address</p>
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {data.address}, {data.suburb} {data.state} {data.postcode}
                          </p>
                          {data.pickup_zone_id && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                              Zone: {pickupZones?.find((z: any) => z.id.toString() === data.pickup_zone_id.toString())?.name || 'Selected Zone'}
                            </p>
                          )}
                        </div>
                        {data.notes && (
                          <div className="sm:col-span-2 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Pickup Notes</p>
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
                          const recPhone = recipient?.phone_number || recipient?.receiver_phone || box.recipient_phone || '';
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
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">${totalEstimate.toFixed(2)}</span>
                        </div>

                        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-baseline">
                          <span className="font-bold text-zinc-900 dark:text-zinc-100">Total Estimate</span>
                          <span className="text-2xl font-black text-brand-rust font-mono">${totalEstimate.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 p-4 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                          <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" /> Transparent Pricing
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 leading-relaxed">
                          Review your shipment details above. Click "Proceed to Payment" when you are ready to confirm your order.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: DIRECT PAYMENT CONSOLE */}
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
                                                    <span className="text-sm font-bold text-zinc-800">{box.box_type?.name || 'Standard Box'}</span>
                                                  )}
                                              </div>
                                              <div className="text-right">
                                                <span className="text-base font-mono font-bold text-zinc-900">${parseFloat(box.price_charged || '0').toFixed(2)}</span>
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
                                      <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">${paymentData.booking.payment_status === 'paid' ? '0.00' : totalEstimate.toFixed(2)}</span>
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
                            bankDetails={paymentData.bankDetails}
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
          </div>

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

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-8 border-t border-zinc-200 dark:border-zinc-800">
             {currentStep > 1 && (
                <div className="hidden md:block">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Total Shipment Value</p>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">${totalEstimate.toFixed(0)}</p>
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
                    disabled={initializingPayment}
                    className="flex-1 md:w-64 h-12 rounded-xl bg-brand-rust text-white font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-brand-rust/20 flex items-center justify-center gap-2"
                  >
                    {initializingPayment ? <><Loader2 className="animate-spin size-4" /> Initializing...</> : <>Proceed to Payment <CheckCircle className="size-4" /></>}
                  </Button>
                )}
              </div>
          </div>
        </div>

    </AppLayout>
  );
}
