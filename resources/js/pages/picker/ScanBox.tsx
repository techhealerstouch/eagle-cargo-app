import { Head } from '@inertiajs/react';
import { Html5Qrcode } from 'html5-qrcode';
import {
    ArrowRight,
    Banknote,
    Camera,
    CheckCircle2,
    ExternalLink,
    FileText,
    History,
    Loader2,
    PlayCircle,
    QrCode,
    RefreshCw,
    Repeat2,
    ShieldAlert,
    Upload,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

/** Session key for persisting recent scans in localStorage */
const RECENT_SCANS_STORAGE_KEY = 'picker:recent-scans';
const MAX_RECENT_SCANS = 10;

/** Session key for persisting selected camera */
const SELECTED_CAMERA_KEY = 'picker:selected-camera';

/** Load recent scans from localStorage */
const loadRecentScansFromStorage = (): RecentScan[] => {
    if (typeof window === 'undefined') {
        return [];
    }

    try {
        const stored = localStorage.getItem(RECENT_SCANS_STORAGE_KEY);

        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

/** Save recent scans to localStorage */
const saveRecentScansToStorage = (scans: RecentScan[]) => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        localStorage.setItem(
            RECENT_SCANS_STORAGE_KEY,
            JSON.stringify(scans.slice(0, MAX_RECENT_SCANS)),
        );
    } catch {
        // Silent fail
    }
};

/** Save selected camera to localStorage */
const saveSelectedCameraToStorage = (cameraId: string) => {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        localStorage.setItem(SELECTED_CAMERA_KEY, cameraId);
    } catch {
        // Silent fail
    }
};

interface RecentScan {
    trackingNumber: string;
    timeLabel: string;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Picker Dashboard', href: '/picker/dashboard' },
    { title: 'Scan Box', href: '/picker/scan' },
];

type ScanAction =
    | 'collected'
    | 'already_scanned'
    | 'payment_required'
    | 'missing_declaration'
    | 'needs_review';

interface PickerScanResponse {
    action: ScanAction;
    message: string;
    box: {
        id: number;
        trackingNumber: string;
        serialNumber?: string;
        status: string;
        detailUrl: string;
        booking: {
            id: number;
            referenceNumber: string;
            paymentStatus: string;
            declarationFormStatus: string;
            senderName: string;
            boxesCount: number;
            totalAmount: number;
            paymentConsoleUrl: string | null;
            paymentPostUrl: string | null;
            uploadDeclarationUrl: string;
        } | null;
    };
}

const getXsrfToken = () => {
    const match = document.cookie.match(
        new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'),
    );

    return match ? decodeURIComponent(match[3]) : '';
};

const readJson = async (response: Response) => {
    try {
        return await response.json();
    } catch {
        return null;
    }
};

const responseMessage = (payload: any, fallback: string) => {
    if (payload?.message) {
        return payload.message;
    }

    const firstError = payload?.errors
        ? Object.values(payload.errors)[0]
        : null;

    if (Array.isArray(firstError) && firstError[0]) {
        return String(firstError[0]);
    }

    if (typeof firstError === 'string') {
        return firstError;
    }

    return fallback;
};

export default function ScanBox() {
    const [manualTracking, setManualTracking] = useState('');
    const [isScanning, setIsScanning] = useState(true);
    const [scannerCollapsed, setScannerCollapsed] = useState(false);
    const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<string>('');
    const [scanError, setScanError] = useState('');
    const [lastScanStatus, setLastScanStatus] = useState<
        'idle' | 'success' | 'error'
    >('idle');
    const [lastScanMessage, setLastScanMessage] = useState('');
    const [recentScans, setRecentScans] = useState<RecentScan[]>(() =>
        loadRecentScansFromStorage(),
    );
    const [isFlippingCamera, setIsFlippingCamera] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [exceptionScan, setExceptionScan] =
        useState<PickerScanResponse | null>(null);
    const [declarationFile, setDeclarationFile] = useState<File | null>(null);
    const [isUploadingDeclaration, setIsUploadingDeclaration] = useState(false);
    const [isRecordingPayment, setIsRecordingPayment] = useState(false);
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true,
    );

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scannerQueueRef = useRef<Promise<void>>(Promise.resolve());
    const selectedCameraRef = useRef<string>('');
    const inputRef = useRef<HTMLInputElement>(null);
    const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cameraDecodeLockRef = useRef(0);

    // Autofocus input on mount
    useEffect(() => {
        const timeout = setTimeout(() => {
            inputRef.current?.focus();
        }, 100);

        return () => clearTimeout(timeout);
    }, []);

    // Monitor online/offline status
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const queueScannerTask = useCallback((task: () => Promise<void>) => {
        scannerQueueRef.current = scannerQueueRef.current
            .catch(() => {})
            .then(task);

        return scannerQueueRef.current;
    }, []);

    const emitFeedbackSignal = useCallback((status: 'success' | 'error') => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(status === 'success' ? [35] : [90, 45, 90]);
        }

        if (typeof window === 'undefined') {
            return;
        }

        const extendedWindow = window as Window & {
            webkitAudioContext?: typeof AudioContext;
        };
        const AudioContextCtor =
            window.AudioContext ?? extendedWindow.webkitAudioContext;

        if (!AudioContextCtor) {
            return;
        }

        try {
            const audioContext = new AudioContextCtor();
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            oscillator.type = status === 'success' ? 'triangle' : 'square';
            oscillator.frequency.value = status === 'success' ? 960 : 220;
            gain.gain.value = 0.045;
            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            oscillator.start();
            oscillator.stop(
                audioContext.currentTime + (status === 'success' ? 0.08 : 0.16),
            );
            oscillator.onended = () => {
                void audioContext.close();
            };
        } catch {
            /* Silent fail */
        }
    }, []);

    const triggerFeedback = useCallback(
        (status: 'success' | 'error', message: string) => {
            setLastScanStatus(status);
            setLastScanMessage(message);
            emitFeedbackSignal(status);

            if (feedbackTimerRef.current) {
                clearTimeout(feedbackTimerRef.current);
            }

            feedbackTimerRef.current = setTimeout(() => {
                setLastScanStatus('idle');
                setLastScanMessage('');
            }, 2000);
        },
        [emitFeedbackSignal],
    );

    const addRecentScan = useCallback((trackingNumber: string) => {
        const timeLabel = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });
        setRecentScans((current) => {
            const newScans = [{ trackingNumber, timeLabel }, ...current].slice(
                0,
                MAX_RECENT_SCANS,
            );
            saveRecentScansToStorage(newScans);

            return newScans;
        });
    }, []);

    const submitScan = useCallback(
        async (trackingNumber: string) => {
            const normalized = trackingNumber.trim().toUpperCase();

            if (!normalized || isProcessing) {
                return;
            }

            setIsProcessing(true);
            setScanError('');

            try {
                const response = await fetch('/picker/scan', {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-XSRF-TOKEN': getXsrfToken(),
                    },
                    credentials: 'include',
                    body: JSON.stringify({ tracking_number: normalized }),
                });

                const payload = await readJson(response);

                if (!response.ok && !payload?.action) {
                    throw new Error(responseMessage(payload, 'Scan failed'));
                }

                const result = payload as PickerScanResponse;
                const isClearScan =
                    result.action === 'collected' ||
                    result.action === 'already_scanned';

                if (isClearScan) {
                    triggerFeedback(
                        'success',
                        result.message || `Scanned ${normalized}`,
                    );
                    addRecentScan(result.box?.serialNumber || result.box?.trackingNumber || normalized);
                    setManualTracking('');
                    setExceptionScan(null);
                    setDeclarationFile(null);
                    setIsScanning(true);
                    toast.success(
                        result.message || `Box ${normalized} scanned.`,
                    );
                    inputRef.current?.focus();

                    return;
                }

                triggerFeedback('error', result.message || 'Needs attention');
                setScanError(
                    result.message || 'Needs attention before collection.',
                );
                setExceptionScan(result);
                setManualTracking('');
                setIsScanning(false);
                toast.info(
                    result.message || 'Box needs attention before collection.',
                );
            } catch (error) {
                const msg =
                    error instanceof Error ? error.message : 'Scan failed';
                triggerFeedback('error', msg);
                setScanError(msg);
                toast.error(msg);
                inputRef.current?.focus();
            } finally {
                setIsProcessing(false);
            }
        },
        [isProcessing, triggerFeedback, addRecentScan],
    );

    const resumeScanner = useCallback(() => {
        setExceptionScan(null);
        setDeclarationFile(null);
        setScanError('');
        setIsScanning(true);
        setTimeout(() => inputRef.current?.focus(), 50);
    }, []);

    const handleDeclarationUpload = useCallback(
        async (event: FormEvent) => {
            event.preventDefault();
            const uploadUrl = exceptionScan?.box.booking?.uploadDeclarationUrl;
            const trackingNumber = exceptionScan?.box.trackingNumber;

            if (!uploadUrl || !trackingNumber || !declarationFile) {
                return;
            }

            const formData = new FormData();
            formData.append('declaration_form', declarationFile);

            setIsUploadingDeclaration(true);

            try {
                const response = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-XSRF-TOKEN': getXsrfToken(),
                    },
                    credentials: 'include',
                    body: formData,
                });
                const payload = await readJson(response);

                if (!response.ok) {
                    throw new Error(
                        responseMessage(payload, 'Declaration upload failed'),
                    );
                }

                toast.success(payload?.message || 'Declaration uploaded.');
                triggerFeedback('success', 'Declaration uploaded');
                setExceptionScan(null);
                setDeclarationFile(null);
                await submitScan(trackingNumber);
            } catch (error) {
                const msg =
                    error instanceof Error
                        ? error.message
                        : 'Declaration upload failed';
                toast.error(msg);
                triggerFeedback('error', msg);
            } finally {
                setIsUploadingDeclaration(false);
            }
        },
        [declarationFile, exceptionScan, submitScan, triggerFeedback],
    );

    const handleRecordCashPayment = useCallback(async () => {
        const booking = exceptionScan?.box.booking;
        const trackingNumber = exceptionScan?.box.trackingNumber;

        if (!booking?.paymentPostUrl || !trackingNumber) {
            return;
        }

        setIsRecordingPayment(true);

        try {
            const response = await fetch(booking.paymentPostUrl, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify({
                    booking_id: booking.id,
                    amount: booking.totalAmount,
                    payment_method: 'cash',
                    idempotency_key: `picker_scan_cash_${booking.id}_${Date.now()}`,
                }),
            });
            const payload = await readJson(response);

            if (!response.ok) {
                throw new Error(
                    responseMessage(payload, 'Payment recording failed'),
                );
            }

            toast.success(payload?.message || 'Cash payment recorded.');
            triggerFeedback('success', 'Payment recorded');
            setExceptionScan(null);
            await submitScan(trackingNumber);
        } catch (error) {
            const msg =
                error instanceof Error
                    ? error.message
                    : 'Payment recording failed';
            toast.error(msg);
            triggerFeedback('error', msg);
        } finally {
            setIsRecordingPayment(false);
        }
    }, [exceptionScan, submitScan, triggerFeedback]);

    const stopScanner = useCallback(async () => {
        await queueScannerTask(async () => {
            if (!scannerRef.current || !scannerRef.current.isScanning) {
                return;
            }

            try {
                await scannerRef.current.stop();
            } catch (err) {
                console.error('Failed to stop scanner', err);
            }
        });
    }, [queueScannerTask]);

    const startScanInternal = useCallback(
        (cameraId: string) => {
            void queueScannerTask(async () => {
                if (!scannerRef.current) {
                    scannerRef.current = new Html5Qrcode('picker-reader');
                } else if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop();
                }

                const qrboxFunction = (
                    viewfinderWidth: number,
                    viewfinderHeight: number,
                ) => {
                    const minEdgeSize = Math.min(
                        viewfinderWidth,
                        viewfinderHeight,
                    );
                    const qrboxSize = Math.floor(minEdgeSize * 0.7);

                    return {
                        width: qrboxSize,
                        height: qrboxSize,
                    };
                };

                await scannerRef.current.start(
                    cameraId,
                    {
                        fps: 10,
                        qrbox: qrboxFunction,
                        aspectRatio: 1.0,
                    },
                    (decodedText) => {
                        const now = Date.now();

                        if (now - cameraDecodeLockRef.current < 1500) {
                            return;
                        }

                        cameraDecodeLockRef.current = now;
                        submitScan(decodedText);
                    },
                    () => {},
                );
            }).catch(() => setScanError('Unable to start camera scanner.'));
        },
        [queueScannerTask, submitScan],
    );

    const startScanner = useCallback(
        (cameraId: string) => {
            setScanError('');
            startScanInternal(cameraId);
        },
        [startScanInternal],
    );

    useEffect(() => {
        let cancelled = false;

        if (isScanning && !scannerCollapsed) {
            Html5Qrcode.getCameras()
                .then((devices) => {
                    if (cancelled || !devices.length) {
                        return;
                    }

                    setCameras(devices);
                    let camId = selectedCameraRef.current || devices[0].id;
                    const backCam = devices.find((d) =>
                        d.label.toLowerCase().includes('back'),
                    );

                    if (backCam && !selectedCameraRef.current) {
                        camId = backCam.id;
                    }

                    setSelectedCamera(camId);
                    selectedCameraRef.current = camId;
                    startScanner(camId);
                })
                .catch(() => setScanError('Could not access camera.'));
        } else {
            void stopScanner();
        }

        return () => {
            cancelled = true;
            void stopScanner();
        };
    }, [isScanning, scannerCollapsed, startScanner, stopScanner]);

    const handleCameraChange = (e: ChangeEvent<HTMLSelectElement>) => {
        const camId = e.target.value;
        setSelectedCamera(camId);
        selectedCameraRef.current = camId;
        saveSelectedCameraToStorage(camId);
        startScanner(camId);
    };

    /** Flip between front and back camera */
    const flipCamera = useCallback(async () => {
        if (cameras.length < 2 || isFlippingCamera) {
            return;
        }

        setIsFlippingCamera(true);

        const currentId = selectedCameraRef.current || selectedCamera;
        const currentIndex = cameras.findIndex((c) => c.id === currentId);
        const nextIndex = (currentIndex + 1) % cameras.length;
        const nextCamera = cameras[nextIndex];

        setSelectedCamera(nextCamera.id);
        selectedCameraRef.current = nextCamera.id;
        saveSelectedCameraToStorage(nextCamera.id);

        await stopScanner();
        startScanner(nextCamera.id);

        setIsFlippingCamera(false);
    }, [cameras, selectedCamera, isFlippingCamera, stopScanner, startScanner]);

    useEffect(() => {
        const handleShortcut = (event: KeyboardEvent) => {
            if (event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }

            if (
                event.key === '/' &&
                document.activeElement !== inputRef.current
            ) {
                event.preventDefault();
                inputRef.current?.focus();
            } else if (
                event.key.toLowerCase() === 'c' &&
                document.activeElement?.tagName !== 'INPUT'
            ) {
                setScannerCollapsed((current) => !current);
            } else if (
                event.key.toLowerCase() === 'f' &&
                document.activeElement?.tagName !== 'INPUT'
            ) {
                void flipCamera();
            }
        };

        window.addEventListener('keydown', handleShortcut);

        return () => window.removeEventListener('keydown', handleShortcut);
    }, [flipCamera]);

    const handleManualSubmit = (e: FormEvent) => {
        e.preventDefault();
        submitScan(manualTracking);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Picker Scanner | Command Center" />
            <Dialog
                open={Boolean(exceptionScan)}
                onOpenChange={(open) => {
                    if (!open) {
                        resumeScanner();
                    }
                }}
            >
                <DialogContent className="max-w-xl overflow-hidden rounded-[2rem] border-brand-sand bg-white p-0 shadow-2xl">
                    {exceptionScan && (
                        <div className="flex flex-col">
                            <div className="bg-brand-navy p-6 text-white">
                                <div className="flex items-start gap-4">
                                    <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                                        {exceptionScan.action ===
                                        'payment_required' ? (
                                            <Banknote className="size-6" />
                                        ) : (
                                            <ShieldAlert className="size-6" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <DialogTitle className="font-serif text-2xl font-bold">
                                            {exceptionScan.action ===
                                            'payment_required'
                                                ? 'Payment Required'
                                                : exceptionScan.action ===
                                                    'missing_declaration'
                                                  ? 'Declaration Required'
                                                  : 'Needs Review'}
                                        </DialogTitle>
                                        <DialogDescription className="mt-1 text-sm font-semibold text-white/70">
                                            {exceptionScan.message}
                                        </DialogDescription>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-5 p-6">
                                <div className="rounded-2xl border border-brand-sand/50 bg-brand-warm/20 p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="font-mono text-sm font-black tracking-widest text-brand-navy uppercase">
                                                {
                                                    exceptionScan.box
                                                        .trackingNumber
                                                }
                                            </p>
                                            <p className="mt-1 text-sm font-bold text-brand-text">
                                                {exceptionScan.box.booking
                                                    ?.senderName || 'Sender'}
                                            </p>
                                            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                                                Booking{' '}
                                                {exceptionScan.box.booking
                                                    ?.referenceNumber ||
                                                    'N/A'}{' '}
                                                -{' '}
                                                {exceptionScan.box.booking
                                                    ?.boxesCount || 1}{' '}
                                                box
                                                {(exceptionScan.box.booking
                                                    ?.boxesCount || 1) === 1
                                                    ? ''
                                                    : 'es'}
                                            </p>
                                        </div>
                                        <a
                                            href={exceptionScan.box.detailUrl}
                                            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-brand-sand bg-white px-3 py-2 text-[10px] font-black tracking-widest text-brand-navy uppercase hover:bg-brand-warm/40"
                                        >
                                            <ExternalLink className="size-3.5" />
                                            Details
                                        </a>
                                    </div>
                                </div>

                                {exceptionScan.action === 'payment_required' &&
                                    exceptionScan.box.booking && (
                                        <div className="space-y-3">
                                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                                <p className="text-[10px] font-black tracking-widest text-amber-700 uppercase">
                                                    Amount Due
                                                </p>
                                                <p className="mt-1 font-mono text-3xl font-black text-amber-950">
                                                    $
                                                    {Number(
                                                        exceptionScan.box
                                                            .booking
                                                            .totalAmount || 0,
                                                    ).toFixed(2)}
                                                </p>
                                            </div>

                                            {exceptionScan.box.booking
                                                .paymentStatus ===
                                                'cash_on_pickup' &&
                                            exceptionScan.box.booking
                                                .paymentPostUrl ? (
                                                <button
                                                    type="button"
                                                    onClick={
                                                        handleRecordCashPayment
                                                    }
                                                    disabled={
                                                        isRecordingPayment
                                                    }
                                                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-600 px-5 py-4 text-xs font-black tracking-widest text-white uppercase shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                                                >
                                                    {isRecordingPayment ? (
                                                        <Loader2 className="size-4 animate-spin" />
                                                    ) : (
                                                        <Banknote className="size-4" />
                                                    )}
                                                    {isRecordingPayment
                                                        ? 'Recording...'
                                                        : 'Confirm Cash Collected'}
                                                </button>
                                            ) : exceptionScan.box.booking
                                                  .paymentConsoleUrl ? (
                                                <a
                                                    href={
                                                        exceptionScan.box
                                                            .booking
                                                            .paymentConsoleUrl
                                                    }
                                                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-brand-navy px-5 py-4 text-xs font-black tracking-widest text-white uppercase shadow-lg active:scale-95"
                                                >
                                                    <Banknote className="size-4" />
                                                    Open Payment Console
                                                </a>
                                            ) : null}
                                        </div>
                                    )}

                                {exceptionScan.action ===
                                    'missing_declaration' &&
                                    exceptionScan.box.booking && (
                                        <form
                                            onSubmit={handleDeclarationUpload}
                                            className="space-y-4"
                                        >
                                            <div className="relative rounded-2xl border-2 border-dashed border-red-200 bg-red-50/70 p-4">
                                                <input
                                                    type="file"
                                                    accept="image/*,.pdf"
                                                    capture="environment"
                                                    onChange={(event) =>
                                                        setDeclarationFile(
                                                            event.target
                                                                .files?.[0] ||
                                                                null,
                                                        )
                                                    }
                                                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                                                    disabled={
                                                        isUploadingDeclaration
                                                    }
                                                />
                                                <div className="flex items-center gap-3">
                                                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-red-600 shadow-sm">
                                                        {declarationFile ? (
                                                            <FileText className="size-5" />
                                                        ) : (
                                                            <Upload className="size-5" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-black tracking-widest text-red-900 uppercase">
                                                            {declarationFile
                                                                ? declarationFile.name
                                                                : 'Capture Declaration Form'}
                                                        </p>
                                                        <p className="truncate text-xs font-semibold text-red-700/70">
                                                            JPG, PNG, or PDF up
                                                            to 5 MB
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={
                                                    !declarationFile ||
                                                    isUploadingDeclaration
                                                }
                                                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-red-600 px-5 py-4 text-xs font-black tracking-widest text-white uppercase shadow-lg shadow-red-600/20 active:scale-95 disabled:opacity-50"
                                            >
                                                {isUploadingDeclaration ? (
                                                    <Loader2 className="size-4 animate-spin" />
                                                ) : (
                                                    <Upload className="size-4" />
                                                )}
                                                {isUploadingDeclaration
                                                    ? 'Uploading...'
                                                    : 'Upload and Resume'}
                                            </button>
                                        </form>
                                    )}

                                <button
                                    type="button"
                                    onClick={resumeScanner}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-sand bg-white px-5 py-3 text-xs font-black tracking-widest text-brand-navy uppercase hover:bg-brand-warm/30"
                                >
                                    <X className="size-4" />
                                    Skip for Now
                                </button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <div className="flex h-screen flex-col overflow-hidden bg-brand-warm/10 lg:flex-row">
                {/* Left Sidebar: Pickup Vitals */}
                <aside className="custom-scrollbar z-20 hidden w-[380px] flex-col overflow-y-auto border-r border-brand-sand/40 bg-white shadow-xl lg:flex">
                    <div className="space-y-10 p-8">
                        {/* Heading */}
                        <div className="space-y-1">
                            <h2 className="font-serif text-2xl font-bold text-brand-text">
                                Command Center
                            </h2>
                            <p className="text-[10px] font-black tracking-[0.3em] text-muted-foreground uppercase">
                                Logistics • Pickup Hub
                            </p>
                        </div>

                        {/* Recent Scan History */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2">
                                <History className="size-4 text-brand-text/40" />
                                <h3 className="text-[10px] font-black tracking-widest text-brand-text uppercase">
                                    Recent Activity
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {recentScans.map((scan, i) => (
                                    <div
                                        key={i}
                                        className="flex animate-in items-center gap-4 rounded-2xl border border-brand-sand/40 bg-brand-warm/30 p-4 fade-in slide-in-from-left-2"
                                    >
                                        <div className="flex size-8 items-center justify-center rounded-lg bg-brand-secondary/20 text-brand-secondary">
                                            <QrCode className="size-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-mono text-[11px] font-black text-brand-text uppercase">
                                                {scan.trackingNumber}
                                            </p>
                                            <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase">
                                                {scan.timeLabel} • Collected
                                            </p>
                                        </div>
                                    </div>
                                ))}
                                {recentScans.length === 0 && (
                                    <p className="py-4 text-center text-[10px] font-bold tracking-widest text-muted-foreground uppercase italic opacity-50">
                                        No activity yet
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Pickup Tips */}
                        <div className="space-y-4 rounded-[2rem] bg-brand-secondary p-6 text-white shadow-lg shadow-brand-secondary/20">
                            <h4 className="text-[10px] font-black tracking-widest text-white/60 uppercase">
                                Operational Note
                            </h4>
                            <p className="text-xs leading-relaxed font-bold">
                                Scanning a{' '}
                                <span className="underline decoration-white/30 underline-offset-4">
                                    PAID
                                </span>{' '}
                                box automatically marks it as COLLECTED in the
                                system.
                            </p>
                            <div className="pt-2">
                                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[9px] font-black tracking-widest uppercase">
                                    <PlayCircle className="size-3" />
                                    Active Session
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Right Main Area: Operations Hub */}
                <main className="relative flex h-full flex-1 flex-col overflow-hidden">
                    {/* Visual Success/Error Feedback Overlay */}
                    {lastScanStatus !== 'idle' && (
                        <div
                            className={`pointer-events-none absolute inset-0 z-50 transition-all duration-500 ${
                                lastScanStatus === 'success'
                                    ? 'bg-emerald-500/5'
                                    : 'bg-red-500/5'
                            }`}
                        >
                            <div
                                className={`absolute top-0 left-0 h-1 w-full ${
                                    lastScanStatus === 'success'
                                        ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.8)]'
                                        : 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)]'
                                }`}
                            />
                        </div>
                    )}

                    {/* Fixed Toolbar */}
                    <div className="z-10 flex items-center justify-between border-b border-brand-sand/40 bg-white px-10 py-6 shadow-sm">
                        <div className="flex flex-col">
                            <h3 className="font-serif text-xl font-bold text-brand-text">
                                Operations Hub
                            </h3>
                            <div className="mt-0.5 flex items-center gap-2">
                                <span
                                    className={`size-2 rounded-full ${isScanning ? 'animate-pulse bg-emerald-500' : 'bg-muted'}`}
                                />
                                <span className="text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                    Picker Scanner •{' '}
                                    {isScanning ? 'Live' : 'Paused'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="custom-scrollbar flex-1 space-y-12 overflow-y-auto p-6 lg:p-10">
                        <section className="mx-auto w-full max-w-4xl">
                            <div
                                className={`group relative overflow-hidden rounded-[3rem] border-2 bg-white p-8 shadow-2xl transition-all duration-500 ${
                                    lastScanStatus === 'success'
                                        ? 'border-emerald-500 ring-8 ring-emerald-500/5'
                                        : lastScanStatus === 'error'
                                          ? 'border-red-500 ring-8 ring-red-500/5'
                                          : 'border-brand-navy ring-8 ring-brand-navy/5'
                                }`}
                            >
                                {/* Decorative backdrop */}
                                <div className="pointer-events-none absolute -right-10 -bottom-10 font-serif text-[180px] font-black text-brand-text/[0.03] uppercase italic">
                                    PICKUP
                                </div>

                                <div className="relative flex flex-col items-start gap-10 xl:flex-row">
                                    {/* Scanner Portal */}
                                    <div className="w-full shrink-0 space-y-4 xl:w-[320px]">
                                        <div className="mb-2 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-brand-text uppercase">
                                                <Camera className="size-4 text-brand-secondary" />
                                                Live Viewfinder
                                            </div>
                                            <button
                                                onClick={() =>
                                                    setScannerCollapsed(
                                                        !scannerCollapsed,
                                                    )
                                                }
                                                className="text-[9px] font-black tracking-widest text-muted-foreground uppercase hover:text-brand-text"
                                            >
                                                {scannerCollapsed
                                                    ? '[ Expand ]'
                                                    : '[ Collapse ]'}
                                            </button>
                                        </div>

                                        {!scannerCollapsed ? (
                                            <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] border-4 border-brand-text bg-black shadow-2xl shadow-brand-text/20">
                                                <div
                                                    id="picker-reader"
                                                    className="h-full w-full [&_video]:object-cover"
                                                />
                                                <div className="pointer-events-none absolute inset-0 border-[20px] border-black/40">
                                                    <div className="h-full w-full rounded-xl border border-white/20" />
                                                </div>
                                                <div className="absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-2xl border-2 border-brand-secondary/50" />
                                            </div>
                                        ) : (
                                            <div className="flex aspect-square w-full flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-brand-sand bg-brand-warm/50 text-muted-foreground italic">
                                                <QrCode className="mb-3 size-12 opacity-20" />
                                                <p className="px-8 text-center text-[10px] font-black tracking-widest uppercase opacity-60">
                                                    Camera paused. <br />
                                                    Manual entry active.
                                                </p>
                                            </div>
                                        )}

                                        {cameras.length > 1 &&
                                            !scannerCollapsed && (
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        className="h-10 flex-1 cursor-pointer appearance-none rounded-xl border-brand-sand bg-brand-warm/20 px-4 text-[10px] font-black tracking-widest uppercase transition-all hover:bg-brand-warm"
                                                        value={selectedCamera}
                                                        onChange={
                                                            handleCameraChange
                                                        }
                                                    >
                                                        {cameras.map((c) => (
                                                            <option
                                                                key={c.id}
                                                                value={c.id}
                                                            >
                                                                {c.label ||
                                                                    `Camera ${c.id}`}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={flipCamera}
                                                        disabled={
                                                            isFlippingCamera ||
                                                            cameras.length < 2
                                                        }
                                                        className="flex h-10 items-center justify-center rounded-xl border border-brand-sand bg-white px-3 text-brand-navy shadow-sm transition-all hover:bg-brand-warm/30 disabled:cursor-not-allowed disabled:opacity-50"
                                                        title="Flip Camera"
                                                    >
                                                        {isFlippingCamera ? (
                                                            <RefreshCw className="size-4 animate-spin" />
                                                        ) : (
                                                            <Repeat2 className="size-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                    </div>

                                    {/* Action Form */}
                                    <div className="w-full flex-1 space-y-8">
                                        <div className="space-y-2">
                                            <h4 className="font-serif text-3xl font-bold tracking-tight text-brand-text">
                                                Collect Shipment
                                            </h4>
                                            <p className="text-sm font-bold text-muted-foreground">
                                                Scan box labels to view details
                                                or automatically collect paid
                                                boxes during pickup.
                                            </p>
                                        </div>

                                        <form
                                            onSubmit={handleManualSubmit}
                                            className="space-y-6"
                                        >
                                            {/* Tracking Input */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="ml-1 text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                                                        Box Serial Entry
                                                    </label>
                                                    {lastScanStatus !==
                                                        'idle' && (
                                                        <div
                                                            className={`flex items-center gap-1 text-[11px] font-black tracking-widest uppercase ${lastScanStatus === 'success' ? 'text-emerald-700' : 'text-red-700'}`}
                                                        >
                                                            {lastScanStatus ===
                                                            'success' ? (
                                                                <CheckCircle2 className="size-3" />
                                                            ) : (
                                                                <ShieldAlert className="size-3" />
                                                            )}
                                                            {lastScanStatus}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="group relative">
                                                    <input
                                                        ref={inputRef}
                                                        type="text"
                                                        placeholder="LBB-2026-000001"
                                                        value={manualTracking}
                                                        onChange={(e) =>
                                                            setManualTracking(
                                                                e.target.value.toUpperCase(),
                                                            )
                                                        }
                                                        className={`w-full rounded-[2rem] border-2 p-6 pr-20 text-3xl font-black shadow-inner transition-all focus:ring-8 ${
                                                            lastScanStatus ===
                                                            'success'
                                                                ? 'border-emerald-400 bg-emerald-50 text-emerald-900 focus:ring-emerald-500/10'
                                                                : lastScanStatus ===
                                                                    'error'
                                                                  ? 'border-red-400 bg-red-50 text-red-900 focus:ring-red-500/10'
                                                                  : 'border-brand-sand bg-brand-warm/5 text-brand-text focus:border-brand-navy focus:ring-brand-navy/10'
                                                        }`}
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={
                                                            isProcessing ||
                                                            !manualTracking.trim()
                                                        }
                                                        className={`absolute top-4 right-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-xl transition-all active:scale-90 disabled:opacity-30 ${
                                                            lastScanStatus ===
                                                            'success'
                                                                ? 'bg-emerald-500 text-white'
                                                                : lastScanStatus ===
                                                                    'error'
                                                                  ? 'bg-red-500 text-white'
                                                                  : 'bg-brand-navy text-white'
                                                        }`}
                                                    >
                                                        {isProcessing ? (
                                                            <Loader2 className="animate-spin" />
                                                        ) : (
                                                            <ArrowRight
                                                                className="size-8"
                                                                strokeWidth={3}
                                                            />
                                                        )}
                                                    </button>
                                                </div>
                                                {(lastScanMessage ||
                                                    scanError) && (
                                                    <p
                                                        className={`text-center text-[10px] font-black tracking-widest uppercase ${lastScanStatus === 'success' ? 'text-emerald-600' : 'text-red-600'}`}
                                                    >
                                                        {lastScanMessage ||
                                                            scanError}
                                                    </p>
                                                )}
                                            </div>
                                        </form>

                                        {/* Status Info */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="rounded-2xl border border-brand-sand/40 bg-brand-warm/30 p-5">
                                                <p className="mb-1 text-[9px] font-black tracking-widest text-muted-foreground uppercase">
                                                    Session Mode
                                                </p>
                                                <p className="text-sm font-black text-brand-text">
                                                    Active Pickup
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-brand-sand/40 bg-brand-warm/30 p-5">
                                                <p className="mb-1 text-[9px] font-black tracking-widest text-muted-foreground uppercase">
                                                    Cloud Sync
                                                </p>
                                                <p
                                                    className={`text-sm font-black ${isOnline ? 'text-brand-text' : 'text-red-600 dark:text-red-400'}`}
                                                >
                                                    {isOnline
                                                        ? 'Live Connected'
                                                        : 'Offline Mode'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </main>
            </div>
        </AppLayout>
    );
}
