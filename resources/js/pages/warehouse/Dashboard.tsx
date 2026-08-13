import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Html5Qrcode } from 'html5-qrcode';
import { AlertCircle, Anchor, ArrowRight, BarChart3, Box, Boxes, Camera, CheckCircle2, Clock, History, ListFilter, Loader2, QrCode, Ruler, ShieldAlert, Truck, Zap, FileWarning } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import { humanize } from '@/lib/utils';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Warehouse Dashboard', href: '/warehouse/dashboard' },
];

interface Batch {
    id: number;
    batch_number: string;
    status: string;
    current_box_count: number;
    capacity_boxes: number;
    current_cbm: number;
    capacity_cbm: number;
}

interface Box {
    id: number;
    tracking_number: string;
    warehouse_location: string | null;
    weight: number | null;
    actual_cbm: number | null;
    status: string;
    missing_siblings: number;
    missing_sibling_boxes?: { id: number; tracking_number: string; status: string }[];
    next_step: string;
    is_domestic: boolean;
    age_hours: number;
    aging_bucket: 'under_24' | '24_48' | '48_plus' | 'critical';
    aging_label: string;
    last_warehouse_event_at: string | null;
    recipient: {
        city: string;
        province: string;
    };
    booking: {
        id: number;
        reference_number: string;
        declaration_form_status?: string;
        payment_status?: string;
    };
    box_type: {
        id: number;
        name: string;
    };
    updates?: {
        id?: number;
        notes?: string | null;
        description?: string | null;
        created_at: string;
    }[];
}

interface Stats {
    pendingReceipt: number;
    needsSorting: number;
    readyToLoadCount: number;
    aging: {
        under_24: number;
        '24_48': number;
        '48_plus': number;
        critical: number;
    };
}

interface Filters {
    warehouse_location: string;
    status: string;
    batch_assignment: string;
    aging_bucket: string;
}

interface RecentScan {
    trackingNumber: string;
    mode: 'receive' | 'load' | 'unload';
    timeLabel: string;
}

export default function WarehouseDashboard({ activeBatches, readyToLoad, exceptionBoxes, stats, filters, receiveSteps, loadSteps }: { activeBatches: Batch[]; readyToLoad: Box[]; exceptionBoxes: Box[]; stats: Stats; filters: Filters; receiveSteps: any[]; loadSteps: any[] }) {
    const page = usePage();
    const queryString = page.url.split('?')[1] ?? '';
    const params = new URLSearchParams(queryString);

    const requestedMode = params.get('mode');
    const requestedBatchId = Number(params.get('batch_id'));
    const hasRequestedBatchId = Number.isFinite(requestedBatchId) && requestedBatchId > 0;
    const initialBatchId = hasRequestedBatchId
        ? requestedBatchId
        : activeBatches[0]?.id || null;
    const initialMode: 'receive' | 'load' =
        requestedMode === 'load' || hasRequestedBatchId ? 'load' : 'receive';

    const [mode, setMode] = useState<'receive' | 'load' | 'unload'>(initialMode);
    const [selectedBatchId, setSelectedBatchId] = useState<number | null>(initialBatchId);
    const [isScanning] = useState(true);
    const [scannerCollapsed, setScannerCollapsed] = useState(false);
    const [lastScanStatus, setLastScanStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [lastScanMessage, setLastScanMessage] = useState('');
    const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
    const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<string>('');
    const [localFilters, setLocalFilters] = useState<Filters>(filters);
    const [selectedBox, setSelectedBox] = useState<Box | null>(null);
    const [showDamageModal, setShowDamageModal] = useState(false);
    const [showHoldModal, setShowHoldModal] = useState(false);
    const [showPhysicalsModal, setShowPhysicalsModal] = useState(false);
    const [showPaymentOverrideModal, setShowPaymentOverrideModal] = useState(false);
    const [paymentOverrideData, setPaymentOverrideData] = useState<{tracking_number: string, message: string} | null>(null);
    const [showBatchDetailsModal, setShowBatchDetailsModal] = useState(false);
    const [batchDetails, setBatchDetails] = useState<any>(null);
    const [isLoadingBatchDetails, setIsLoadingBatchDetails] = useState(false);
    const [, setScanError] = useState('');
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scannerQueueRef = useRef<Promise<void>>(Promise.resolve());
    const selectedCameraRef = useRef<string>('');
    const inputRef = useRef<HTMLInputElement>(null);
    const submitScannedTrackingRef = useRef<(trackingNumber: string) => void>(() => {});
    const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSubmittedScanRef = useRef<{ tracking: string; timestamp: number }>({ tracking: '', timestamp: 0 });
    const cameraDecodeLockRef = useRef(0);

    // Autofocus input on mode change
    useEffect(() => {
        if (showDamageModal || showHoldModal || showPhysicalsModal || showPaymentOverrideModal) {
            return;
        }

        const timeout = setTimeout(() => {
            inputRef.current?.focus();
        }, 100);

        return () => clearTimeout(timeout);
    }, [mode, showDamageModal, showHoldModal, showPhysicalsModal, showPaymentOverrideModal]);

    const receiveForm = useForm({
        tracking_number: '',
        tracking_step_key: receiveSteps.find(s => s.key === 'received_by_branch')?.key || receiveSteps[0]?.key || '',
        force_receive: false,
    });

    const loadForm = useForm({
        tracking_number: '',
        batch_id: initialBatchId,
        tracking_step_key: loadSteps.find(s => s.key === 'loading_container')?.key || loadSteps[0]?.key || '',
    });

    const unloadForm = useForm({
        tracking_number: '',
    });

    const damageForm = useForm({
        tracking_number: '',
        notes: '',
    });

    const holdForm = useForm({
        tracking_number: '',
        notes: '',
    });

    const physicalsForm = useForm({
        tracking_number: '',
        weight: '',
        actual_cbm: '',
        warehouse_location: '',
    });

    const queueScannerTask = useCallback((task: () => Promise<void>) => {
        scannerQueueRef.current = scannerQueueRef.current
            .catch(() => {
                // Keep queue alive after a failed scanner task.
            })
            .then(task);

        return scannerQueueRef.current;
    }, []);

    const selectedBatch = activeBatches.find((batch) => batch.id === selectedBatchId);

    const emitFeedbackSignal = useCallback((status: 'success' | 'error') => {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate(status === 'success' ? [35] : [90, 45, 90]);
        }

        if (typeof window === 'undefined') {
            return;
        }

        const extendedWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
        const AudioContextCtor = window.AudioContext ?? extendedWindow.webkitAudioContext;

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
            oscillator.stop(audioContext.currentTime + (status === 'success' ? 0.08 : 0.16));
            oscillator.onended = () => {
                void audioContext.close();
            };
        } catch {
            // Non-blocking best effort feedback.
        }
    }, []);

    const triggerFeedback = useCallback((status: 'success' | 'error', message: string) => {
        setLastScanStatus(status);
        setLastScanMessage(message);
        emitFeedbackSignal(status);

        if (feedbackTimerRef.current) {
            clearTimeout(feedbackTimerRef.current);
        }

        feedbackTimerRef.current = setTimeout(() => {
            setLastScanStatus('idle');
            setLastScanMessage('');
        }, 1500);
    }, [emitFeedbackSignal]);

    useEffect(() => {
        return () => {
            if (feedbackTimerRef.current) {
                clearTimeout(feedbackTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        const override = page.props.flash?.payment_override;
        if (override) {
            setPaymentOverrideData(override as any);
            setShowPaymentOverrideModal(true);
        }
    }, [page.props.flash?.payment_override]);

    const fetchBatchDetails = async (batchId: number) => {
        setIsLoadingBatchDetails(true);
        setShowBatchDetailsModal(true);
        try {
            const res = await fetch(`/warehouse/api/batches/${batchId}`);
            if (res.ok) {
                const data = await res.json();
                setBatchDetails(data);
            } else {
                toast.error('Failed to load batch details.');
                setShowBatchDetailsModal(false);
            }
        } catch (error) {
            console.error('Error fetching batch details:', error);
            toast.error('Failed to load batch details.');
            setShowBatchDetailsModal(false);
        } finally {
            setIsLoadingBatchDetails(false);
        }
    };

    const addRecentScan = useCallback((trackingNumber: string, scanMode: 'receive' | 'load' | 'unload') => {
        const timeLabel = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        });

        setRecentScans((previous) => [
            { trackingNumber, mode: scanMode, timeLabel },
            ...previous,
        ].slice(0, 3));
    }, []);

    const processTrackingSubmission = useCallback((rawTrackingNumber: string, source: 'manual' | 'camera') => {
        const normalizedTracking = rawTrackingNumber.replace(/[\r\n]+/g, '').trim();

        if (!normalizedTracking) {
            if (source === 'camera') {
                setScanError('Scanned payload is empty. Please try again.');
            }

            return;
        }

        if (receiveForm.processing || loadForm.processing || unloadForm.processing) {
            return;
        }

        const now = Date.now();
        const { tracking, timestamp } = lastSubmittedScanRef.current;

        if (tracking === normalizedTracking && now - timestamp < 2000) {
            triggerFeedback('error', `Duplicate scan ignored: ${normalizedTracking}`);

            return;
        }

        lastSubmittedScanRef.current = { tracking: normalizedTracking, timestamp: now };
        setScanError('');

        if (mode === 'receive') {
            receiveForm.transform((data) => ({ ...data, tracking_number: normalizedTracking, force_receive: false }));
            receiveForm.setData('tracking_number', normalizedTracking);
            receiveForm.post('/warehouse/receive', {
                onSuccess: (page: any) => {
                    // If server returned a payment_override flash, don't treat as a
                    // completed receive — the useEffect will show the override modal.
                    if (page?.props?.flash?.payment_override) {
                        return;
                    }
                    triggerFeedback('success', `Received ${normalizedTracking}`);
                    addRecentScan(normalizedTracking, 'receive');
                    receiveForm.reset('tracking_number', 'force_receive');
                    inputRef.current?.focus();
                },
                onError: (errors) => {
                    const msg = (errors.tracking_number || Object.values(errors)[0] || 'Receipt failed') as string;

                    triggerFeedback('error', msg);
                    setScanError(msg);
                    toast.error(msg);
                    lastSubmittedScanRef.current = { tracking: '', timestamp: 0 };
                    receiveForm.reset('force_receive');
                    inputRef.current?.focus();
                },
            });

            return;
        }

        if (mode === 'unload') {
            unloadForm.transform((data) => ({ ...data, tracking_number: normalizedTracking }));
            unloadForm.setData('tracking_number', normalizedTracking);
            unloadForm.post('/warehouse/unload', {
                onSuccess: () => {
                    triggerFeedback('success', `Unloaded ${normalizedTracking}`);
                    addRecentScan(normalizedTracking, 'unload');
                    unloadForm.reset('tracking_number');
                    inputRef.current?.focus();
                },
                onError: (errors) => {
                    const msg = (errors.tracking_number || Object.values(errors)[0] || 'Unloading failed') as string;

                    triggerFeedback('error', msg);
                    setScanError(msg);
                    toast.error(msg);
                    lastSubmittedScanRef.current = { tracking: '', timestamp: 0 };
                    inputRef.current?.focus();
                },
            });
            return;
        }

        if (!loadForm.data.batch_id) {
            const message = 'Select a batch before scanning.';

            triggerFeedback('error', message);
            toast.error(message);
            lastSubmittedScanRef.current = { tracking: '', timestamp: 0 };

            return;
        }

        loadForm.transform((data) => ({ ...data, tracking_number: normalizedTracking }));
        loadForm.setData('tracking_number', normalizedTracking);
        loadForm.post('/warehouse/load', {
            onSuccess: () => {
                triggerFeedback('success', `Loaded ${normalizedTracking}`);
                addRecentScan(normalizedTracking, 'load');
                loadForm.reset('tracking_number');
                inputRef.current?.focus();
            },
            onError: (errors) => {
                const msg = (errors.tracking_number || Object.values(errors)[0] || 'Loading failed') as string;

                triggerFeedback('error', msg);
                setScanError(msg);
                toast.error(msg);
                lastSubmittedScanRef.current = { tracking: '', timestamp: 0 };
                inputRef.current?.focus();
            },
        });
    }, [addRecentScan, loadForm, unloadForm, mode, receiveForm, triggerFeedback]);

    const stopScanner = useCallback(async () => {
        await queueScannerTask(async () => {
            if (!scannerRef.current || !scannerRef.current.isScanning) {
                return;
            }

            try {
                await scannerRef.current.stop();
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);

                if (!message.toLowerCase().includes('already under transition')) {
                    console.error('Failed to stop scanner', err);
                }
            }
        });
    }, [queueScannerTask]);

    const submitScannedTracking = useCallback((trackingNumber: string) => {
        processTrackingSubmission(trackingNumber, 'camera');
    }, [processTrackingSubmission]);

    const handleTrackingInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') {
            return;
        }

        e.preventDefault();
        const trackingValue = mode === 'receive' 
            ? receiveForm.data.tracking_number 
            : mode === 'unload' 
                ? unloadForm.data.tracking_number 
                : loadForm.data.tracking_number;

        processTrackingSubmission(trackingValue, 'manual');
    }, [loadForm.data.tracking_number, unloadForm.data.tracking_number, mode, processTrackingSubmission, receiveForm.data.tracking_number]);

    const handleMarkDamaged = (e: React.FormEvent) => {
        e.preventDefault();
        damageForm.post('/warehouse/mark-damaged', {
            onSuccess: () => {
                setShowDamageModal(false);
                damageForm.reset();
            },
            onError: (errors) => toast.error(Object.values(errors)[0] || 'Failed to mark as damaged'),
        });
    };

    const handleMarkHeld = (e: React.FormEvent) => {
        e.preventDefault();
        holdForm.post('/warehouse/mark-held', {
            onSuccess: () => {
                setShowHoldModal(false);
                holdForm.reset();
            },
            onError: (errors) => toast.error(Object.values(errors)[0] || 'Hold failed'),
        });
    };

    const handleUpdatePhysicals = (e: React.FormEvent) => {
        e.preventDefault();
        physicalsForm.post('/warehouse/update-physicals', {
            onSuccess: () => {
                setShowPhysicalsModal(false);
                physicalsForm.reset();
            },
            onError: (errors) => toast.error(Object.values(errors)[0] || 'Update failed'),
        });
    };

    useEffect(() => {
        submitScannedTrackingRef.current = submitScannedTracking;
    }, [submitScannedTracking]);

    useEffect(() => {
        selectedCameraRef.current = selectedCamera;
    }, [selectedCamera]);

    const startScanInternal = useCallback((cameraId: string) => {
        void queueScannerTask(async () => {
            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode('warehouse-reader');
            } else if (scannerRef.current.isScanning) {
                await scannerRef.current.stop();
            }

            const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
                const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
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

                    if (now - cameraDecodeLockRef.current < 850) {
                        return;
                    }

                    cameraDecodeLockRef.current = now;
                    submitScannedTrackingRef.current(decodedText);
                },
                () => {
                    // Ignore continuous decode errors while waiting for a valid QR payload.
                },
            );
        }).catch((err) => {
            console.error('Failed to start scanner', err);
            setScanError('Unable to start camera scanner.');
        });
    }, [queueScannerTask]);

    const startScanner = useCallback((cameraId: string) => {
        setScanError('');
        startScanInternal(cameraId);
    }, [startScanInternal]);

    useEffect(() => {
        let cancelled = false;

        if (isScanning && !scannerCollapsed) {
            Html5Qrcode.getCameras().then((devices) => {
                if (cancelled) {
                    return;
                }

                if (devices && devices.length) {
                    setCameras(devices);

                    let cameraId = selectedCameraRef.current;
                    const hasSelectedCamera = cameraId && devices.some((device) => device.id === cameraId);

                    if (!hasSelectedCamera) {
                        cameraId = devices[0].id;
                        const backCamera = devices.find((device) =>
                            device.label.toLowerCase().includes('back'),
                        );

                        if (backCamera) {
                            cameraId = backCamera.id;
                        }
                    }

                    setSelectedCamera(cameraId);
                    selectedCameraRef.current = cameraId;
                    startScanner(cameraId);

                    return;
                }

                setScanError('No available camera detected.');
            }).catch((err) => {
                if (cancelled) {
                    return;
                }

                console.error('Error getting cameras', err);
                setScanError('Could not access camera. Please check permissions.');
            });
        } else {
            void stopScanner();
        }

        return () => {
            cancelled = true;
            void stopScanner();
        };
    }, [isScanning, scannerCollapsed, startScanner, stopScanner]);

    const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const cameraId = e.target.value;
        setSelectedCamera(cameraId);
        startScanner(cameraId);
    };

    const applyFilters = () => {
        router.get('/warehouse/dashboard', { ...localFilters }, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const clearFilters = () => {
        const cleared = {
            warehouse_location: '',
            status: '',
            batch_assignment: 'all',
            aging_bucket: 'all',
        };

        setLocalFilters(cleared);
        router.get('/warehouse/dashboard', { ...cleared }, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    const agingBadgeClass = (bucket: Box['aging_bucket']) => {
        return {
            under_24: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            '24_48': 'bg-amber-50 text-amber-700 border-amber-200',
            '48_plus': 'bg-orange-50 text-orange-700 border-orange-200',
            critical: 'bg-red-50 text-red-700 border-red-200',
        }[bucket];
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Warehouse Dashboard | Command Center" />

            <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-brand-warm/10">

                {/* Left Sidebar: Warehouse Vitals */}
                <aside className="hidden lg:flex w-100 flex-col bg-white border-r border-brand-sand/40 overflow-y-auto custom-scrollbar shadow-xl z-20">
                    <div className="p-8 space-y-10">
                        {/* Heading */}
                        <div className="space-y-1">
                            <h2 className="font-serif text-2xl font-medium text-brand-text">Warehouse Stats</h2>
                            <p className="text-xs font-medium tracking-[0.3em] text-muted-foreground">Inventory • Warehouse Vitals</p>
                        </div>

                        {/* Mode Selector */}
                        <div className="space-y-4">
                            <Label className="text-xs font-medium text-muted-foreground ml-1">Operations Mode</Label>
                            <div className="grid grid-cols-3 gap-2 bg-brand-warm/30 p-1.5 rounded-2xl border border-brand-sand/50 shadow-2xs">
                                <button
                                    type="button"
                                    onClick={() => setMode('receive')}
                                    className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                                        mode === 'receive' ? 'bg-brand-secondary text-white shadow-md' : 'text-brand-text hover:bg-white/50 bg-white/30'
                                    }`}
                                >
                                    <QrCode className="size-4 shrink-0" />
                                    <span>Receive</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('load')}
                                    className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                                        mode === 'load' ? 'bg-brand-rust text-white shadow-md' : 'text-brand-text hover:bg-white/50 bg-white/30'
                                    }`}
                                >
                                    <Truck className="size-4 shrink-0" />
                                    <span>Load</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('unload')}
                                    className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                                        mode === 'unload' ? 'bg-brand-text text-white shadow-md' : 'text-brand-text hover:bg-white/50 bg-white/30'
                                    }`}
                                >
                                    <Anchor className="size-4 shrink-0" />
                                    <span>Unload</span>
                                </button>
                            </div>
                        </div>

                        {/* Real-time Stats Cards */}
                        <div className="grid grid-cols-1 gap-4">
                            <div className="group p-4 rounded-xl bg-white border border-brand-sand/50 shadow-sm transition-all hover:shadow-md hover:border-brand-secondary/30">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="p-2 rounded-lg bg-brand-secondary/10 text-brand-secondary">
                                        <Clock className="size-4" />
                                    </div>
                                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Live Status</span>
                                </div>
                                <h4 className="text-xs font-medium text-muted-foreground">Awaiting Receipt</h4>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-3xl font-serif font-medium text-brand-text">{stats.pendingReceipt}</span>
                                    <span className="text-xs font-medium text-muted-foreground">Boxes</span>
                                </div>
                                <div className="mt-3 pt-3 border-t border-brand-sand/30">
                                    <div className="flex items-center gap-2">
                                        <div className="size-1.5 rounded-full bg-brand-secondary animate-pulse" />
                                        <p className="text-xs font-medium text-muted-foreground italic opacity-60">Items currently with pickers</p>
                                    </div>
                                </div>
                            </div>

                            <div className="group p-4 rounded-xl bg-white border border-brand-sand/50 shadow-sm transition-all hover:shadow-md hover:border-emerald-500/30">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                                        <ListFilter className="size-4" />
                                    </div>
                                </div>
                                <h4 className="text-xs font-medium text-muted-foreground">Needs Sorting</h4>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-3xl font-serif font-medium text-emerald-700">{stats.needsSorting}</span>
                                    <span className="text-xs font-medium text-muted-foreground">Boxes</span>
                                </div>
                            </div>

                            <div className="group p-4 rounded-xl bg-white border border-brand-sand/50 shadow-sm transition-all hover:shadow-md hover:border-red-500/30">
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="p-2 rounded-lg bg-red-500/10 text-red-600">
                                        <AlertCircle className="size-4" />
                                    </div>
                                    <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                                        Aging
                                    </span>
                                </div>
                                <h4 className="text-xs font-medium text-muted-foreground">Warehouse Aging</h4>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700">
                                        <p className="text-base font-semibold">{stats.aging.under_24}</p>
                                        <p className="text-[10px] font-medium">Under 24h</p>
                                    </div>
                                    <div className="rounded-lg bg-amber-50 p-2.5 text-amber-700">
                                        <p className="text-base font-semibold">{stats.aging['24_48']}</p>
                                        <p className="text-[10px] font-medium">24-48h</p>
                                    </div>
                                    <div className="rounded-lg bg-orange-50 p-2.5 text-orange-700">
                                        <p className="text-base font-semibold">{stats.aging['48_plus']}</p>
                                        <p className="text-[10px] font-medium">48h+</p>
                                    </div>
                                    <div className="rounded-lg bg-red-50 p-2.5 text-red-700">
                                        <p className="text-base font-semibold">{stats.aging.critical}</p>
                                        <p className="text-[10px] font-medium">Critical</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Active Batches Section */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="size-1.5 rounded-full bg-brand-rust" />
                                    <h3 className="text-xs font-medium text-brand-text">Active Containers</h3>
                                </div>
                                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                                    {activeBatches.length} Total
                                </span>
                            </div>

                            <div className="space-y-4">
                                {activeBatches.map((batch) => {
                                    const progress = Math.min((batch.current_box_count / batch.capacity_boxes) * 100, 100);
                                    const isSelected = selectedBatchId === batch.id;

                                    return (
                                        <div
                                            key={batch.id}
                                            onClick={() => {
                                                setMode('load');
                                                setSelectedBatchId(batch.id);
                                                loadForm.setData('batch_id', batch.id);
                                            }}
                                            className={`relative p-4 rounded-xl border transition-all cursor-pointer group ${
                                                isSelected ? 'border-brand-rust bg-brand-rust/3 ring-2 ring-brand-rust/5 shadow-md' : 'border-brand-sand/40 bg-white hover:border-brand-rust/30'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <p className="text-xs font-medium text-muted-foreground mb-0.5">Batch {batch.batch_number}</p>
                                                    <h5 className="text-base font-semibold text-brand-text">{batch.batch_number}</h5>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                    batch.status === 'loading' ? 'bg-amber-100 text-amber-700' : 'bg-brand-warm text-brand-text/60'
                                                }`}>
                                                    {humanize(batch.status)}
                                                </span>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-xs font-medium">
                                                        <span className="text-muted-foreground">Box Capacity</span>
                                                        <span className="text-brand-text">{batch.current_box_count} / {batch.capacity_boxes}</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-brand-warm rounded-full overflow-hidden border border-brand-sand/30">
                                                        <div
                                                            className="h-full bg-brand-rust transition-all duration-500 ease-out rounded-full shadow-[0_0_10px_rgba(183,73,55,0.4)]"
                                                            style={{ width: `${progress}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            fetchBatchDetails(batch.id);
                                                        }}
                                                        className="text-xs font-semibold text-brand-rust hover:text-brand-rust/80 flex items-center gap-1 transition-colors"
                                                    >
                                                        View Details <ArrowRight className="size-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Recent Scan History */}
                        <div className="space-y-6 pt-4">
                             <div className="flex items-center gap-2">
                                <History className="size-4 text-brand-text/40" />
                                <h3 className="text-xs font-medium text-brand-text">Recent Activity</h3>
                            </div>
                            <div className="space-y-3">
                                {recentScans.map((scan, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-brand-warm/30 border border-brand-sand/40">
                                        <div className={`size-8 rounded-lg flex items-center justify-center ${scan.mode === 'receive' ? 'bg-brand-secondary/20 text-brand-secondary' : scan.mode === 'unload' ? 'bg-brand-text/10 text-brand-text' : 'bg-brand-rust/20 text-brand-rust'}`}>
                                            {scan.mode === 'receive' ? <QrCode className="size-4" /> : scan.mode === 'unload' ? <Anchor className="size-4" /> : <Truck className="size-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-mono text-sm font-medium text-brand-text truncate">{scan.trackingNumber}</p>
                                            <p className="text-xs font-medium text-muted-foreground">{scan.timeLabel} • {scan.mode}</p>
                                        </div>
                                    </div>
                                ))}
                                {recentScans.length === 0 && (
                                    <p className="text-xs text-muted-foreground font-medium text-center py-4 opacity-50 italic">No activity yet</p>
                                )}
                            </div>
                        </div>
                    </div>
                </aside>

                {/* Right Main Area: Operations Hub */}
                <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                    {/* Visual Success/Error Feedback Overlay */}
                    {lastScanStatus !== 'idle' && (
                        <div className={`absolute inset-0 z-50 pointer-events-none transition-all duration-500 ${
                            lastScanStatus === 'success' ? 'bg-emerald-500/5' : 'bg-red-500/5'
                        }`}>
                            <div className={`absolute top-0 left-0 w-full h-1 ${
                                lastScanStatus === 'success' ? 'bg-emerald-500 shadow-[0_0_20px_rgba(10,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)]'
                            }`} />
                        </div>
                    )}

                    {/* Fixed Toolbar / Breadcrumbs */}
                    <div className="flex items-center justify-between px-4 sm:px-6 lg:px-10 py-4 sm:py-6 bg-white border-b border-brand-sand/40 shadow-sm z-10">
                        <div className="flex flex-col">
                            <h3 className="font-serif text-xl font-medium text-brand-text">Operations Hub</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`size-2 rounded-full ${isScanning ? 'bg-emerald-500 animate-pulse' : 'bg-muted'}`} />
                                <span className="text-xs font-medium text-muted-foreground">
                                    {mode === 'receive' ? 'Receipt Inbound' : mode === 'unload' ? 'Unload Container' : 'Export Loading'} • {isScanning ? 'Live' : 'Paused'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="hidden sm:flex items-center gap-3 bg-brand-warm/50 px-4 py-2 rounded-xl border border-brand-sand/40">
                                <BarChart3 className="size-4 text-brand-text/40" />
                                <span className="text-sm font-medium text-brand-text">
                                    {stats.readyToLoadCount} items ready to load
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-10 space-y-6 sm:space-y-12">
                        {/* Mobile & Tablet Mode Selector (Shown when desktop sidebar is hidden) */}
                        <div className="max-w-4xl mx-auto w-full lg:hidden">
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground ml-1">Operations Mode</Label>
                                <div className="grid grid-cols-3 gap-2 bg-brand-warm/30 p-1.5 rounded-2xl border border-brand-sand/50 shadow-2xs">
                                    <button
                                        type="button"
                                        onClick={() => setMode('receive')}
                                        className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                                            mode === 'receive' ? 'bg-brand-secondary text-white shadow-md' : 'text-brand-text hover:bg-white/50 bg-white/30'
                                        }`}
                                    >
                                        <QrCode className="size-4 shrink-0" />
                                        <span>Receive</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMode('load')}
                                        className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                                            mode === 'load' ? 'bg-brand-rust text-white shadow-md' : 'text-brand-text hover:bg-white/50 bg-white/30'
                                        }`}
                                    >
                                        <Truck className="size-4 shrink-0" />
                                        <span>Load</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMode('unload')}
                                        className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                                            mode === 'unload' ? 'bg-brand-text text-white shadow-md' : 'text-brand-text hover:bg-white/50 bg-white/30'
                                        }`}
                                    >
                                        <Anchor className="size-4 shrink-0" />
                                        <span>Unload</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Scanner Commands Section */}
                        <section className="max-w-4xl mx-auto w-full">
                            <div className={`group relative p-6 rounded-xl border transition-all duration-500 bg-white shadow-md overflow-hidden ${
                                lastScanStatus === 'success' ? 'border-emerald-500 ring-4 ring-emerald-500/5' :
                                lastScanStatus === 'error' ? 'border-red-500 ring-4 ring-red-500/5' :
                                mode === 'receive' ? 'border-brand-secondary ring-4 ring-brand-secondary/5' :
                                mode === 'unload' ? 'border-brand-text ring-4 ring-brand-text/5' : 'border-brand-rust ring-4 ring-brand-rust/5'
                            }`}>
                                {/* Decorative backdrop */}
                                <div className="absolute -bottom-10 -right-10 text-[180px] font-medium text-brand-text/[0.03] italic font-serif pointer-events-none">
                                    {mode}
                                </div>

                                <div className="relative flex flex-col xl:flex-row gap-6 items-start">
                                    {/* Scanner Portal */}
                                    <div className="w-full xl:w-[240px] shrink-0 space-y-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2 text-xs font-semibold text-brand-text">
                                                <Camera className="size-4 text-brand-rust" />
                                                Live Viewfinder
                                            </div>
                                            <button
                                                onClick={() => setScannerCollapsed(!scannerCollapsed)}
                                                className="text-xs font-semibold text-muted-foreground hover:text-brand-text"
                                            >
                                                {scannerCollapsed ? '[ Expand ]' : '[ Collapse ]'}
                                            </button>
                                        </div>
                                        {!scannerCollapsed ? (
                                            <div className="relative aspect-square w-full max-w-[320px] mx-auto xl:mx-0 rounded-xl border-2 border-brand-text bg-black overflow-hidden shadow-sm">
                                                <div id="warehouse-reader" className="w-full h-full [&_video]:object-cover" />
                                                <div className="absolute inset-0 border-[16px] border-black/40 pointer-events-none">
                                                    <div className="w-full h-full border border-white/20 rounded-lg" />
                                                </div>
                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-brand-secondary/50 rounded-xl animate-pulse" />
                                            </div>
                                        ) : (
                                            <div className="aspect-square w-full max-w-[320px] mx-auto xl:mx-0 rounded-xl bg-brand-warm/50 flex flex-col items-center justify-center text-muted-foreground border border-dashed border-brand-sand italic">
                                                <QrCode className="size-10 mb-2 opacity-20" />
                                                <p className="text-xs font-medium opacity-60 text-center px-4">Camera paused. <br/>Manual entry active.</p>
                                            </div>
                                        )}

                                        {cameras.length > 1 && !scannerCollapsed && (
                                            <select
                                                aria-label="Select camera"
                                                title="Select camera"
                                                className="w-full h-9 rounded-lg border border-brand-sand bg-brand-warm/20 text-xs font-medium px-3 appearance-none cursor-pointer hover:bg-brand-warm transition-all"
                                                value={selectedCamera}
                                                onChange={handleCameraChange}
                                            >
                                                {cameras.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                                            </select>
                                        )}
                                    </div>

                                    {/* Action Form */}
                                    <div className="flex-1 w-full space-y-6">
                                        <div className="space-y-1">
                                            <h4 className="font-serif text-2xl font-medium text-brand-text tracking-tight">
                                                {mode === 'receive' ? 'Receive Package' : mode === 'unload' ? 'Unload Container' : 'Load Container'}
                                            </h4>
                                            <p className="text-xs font-medium text-muted-foreground">
                                                {mode === 'receive' ? 'Scan items arriving from pickers to update their inventory status.' : mode === 'unload' ? 'Unlink boxes from their currently active shipping container.' : 'Link received boxes to the currently active shipping container.'}
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Tracking Input - THE BIG ONE */}
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold text-muted-foreground ml-1">Manual / Scanner Entry</Label>
                                                <div className="relative group">
                                                    <input
                                                        ref={inputRef}
                                                        type="text"
                                                        placeholder="Scan tracking number..."
                                                        className={`w-full h-14 rounded-xl border px-5 font-mono text-xl font-medium transition-all shadow-inner ${
                                                            lastScanStatus === 'success' ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-4 ring-emerald-500/10' :
                                                            lastScanStatus === 'error' ? 'border-red-500 bg-red-50 text-red-950 ring-4 ring-red-500/10' :
                                                            'border-brand-sand bg-brand-warm/10 text-brand-text focus:border-brand-text focus:ring-4 focus:ring-brand-text/5'
                                                        }`}
                                                        value={mode === 'receive' ? receiveForm.data.tracking_number : mode === 'unload' ? unloadForm.data.tracking_number : loadForm.data.tracking_number}
                                                        onKeyDown={handleTrackingInputKeyDown}
                                                        onChange={(e) => {
                                                            const val = e.target.value.toUpperCase();

                                                            if (mode === 'receive') {
                                                                receiveForm.setData('tracking_number', val);
                                                            } else if (mode === 'unload') {
                                                                unloadForm.setData('tracking_number', val);
                                                            } else {
                                                                loadForm.setData('tracking_number', val);
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => processTrackingSubmission(mode === 'receive' ? receiveForm.data.tracking_number : mode === 'unload' ? unloadForm.data.tracking_number : loadForm.data.tracking_number, 'manual')}
                                                        className={`absolute right-2 top-1/2 -translate-y-1/2 size-10 rounded-lg flex items-center justify-center transition-all active:scale-95 shadow-md ${
                                                            mode === 'receive' ? 'bg-brand-secondary text-white' : mode === 'unload' ? 'bg-brand-text text-white' : 'bg-brand-rust text-white'
                                                        }`}
                                                    >
                                                        {receiveForm.processing || unloadForm.processing || loadForm.processing ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
                                                    </button>
                                                </div>
                                                {lastScanMessage && (
                                                    <div className={`flex items-center gap-2 mt-2 ml-2 text-xs font-semibold ${lastScanStatus === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
                                                        {lastScanStatus === 'success' ? <CheckCircle2 className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
                                                        {lastScanMessage}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Phase Selection */}
                                            {mode !== 'unload' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-semibold text-muted-foreground ml-1">Update Milestone</Label>
                                                        <select
                                                            aria-label="Update Milestone"
                                                            className="w-full h-11 rounded-xl border border-brand-sand bg-brand-warm/20 px-4 text-xs font-medium text-brand-text appearance-none cursor-pointer hover:bg-brand-warm transition-all"
                                                            value={mode === 'receive' ? receiveForm.data.tracking_step_key : loadForm.data.tracking_step_key}
                                                            onChange={(e) => {
                                                                if (mode === 'receive') {
                                                                    receiveForm.setData('tracking_step_key', e.target.value);
                                                                } else {
                                                                    loadForm.setData('tracking_step_key', e.target.value);
                                                                }
                                                            }}
                                                        >
                                                            {mode === 'receive' ? (
                                                                receiveSteps.map(step => (
                                                                    <option key={step.key} value={step.key}>{step.label}</option>
                                                                ))
                                                            ) : (
                                                                loadSteps.map(step => (
                                                                    <option key={step.key} value={step.key}>{step.label}</option>
                                                                ))
                                                            )}
                                                        </select>
                                                    </div>

                                                    {mode === 'load' && (
                                                        <div className="space-y-1.5">
                                                            <Label className="text-xs font-semibold text-muted-foreground ml-1">Loading Target</Label>
                                                            <div className="relative">
                                                                <select
                                                                    aria-label="Loading Target"
                                                                    className="w-full h-11 rounded-xl border border-brand-rust/30 bg-brand-rust/5 px-4 pr-10 text-xs font-semibold text-brand-rust appearance-none cursor-pointer hover:bg-brand-rust/10 transition-all outline-none"
                                                                    value={selectedBatchId || ''}
                                                                    onChange={(e) => {
                                                                        const id = Number(e.target.value);
                                                                        setSelectedBatchId(id);
                                                                        loadForm.setData('batch_id', id);
                                                                    }}
                                                                >
                                                                    {activeBatches.map(batch => (
                                                                        <option key={batch.id} value={batch.id}>
                                                                            Batch {batch.batch_number} ({batch.current_box_count}/{batch.capacity_boxes})
                                                                        </option>
                                                                    ))}
                                                                    {activeBatches.length === 0 && (
                                                                        <option value="">No active batches</option>
                                                                    )}
                                                                </select>
                                                                <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-brand-rust">
                                                                    <Truck className="size-4" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Inventory Table Section */}
                        <section className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-xl bg-brand-warm flex items-center justify-center text-brand-rust">
                                        <Boxes className="size-5" />
                                    </div>
                                    <h3 className="font-serif text-2xl font-medium text-brand-text tracking-tight">Loose Inventory</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                     <div className="hidden sm:flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-brand-sand/50 shadow-sm">
                                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-xs font-medium text-muted-foreground">{readyToLoad.length} Ready to Process</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 rounded-xl border border-brand-sand/30 bg-white p-4 shadow-sm md:grid-cols-[1.2fr_1fr_1fr_1fr_auto_auto]">
                                <Input
                                    placeholder="Filter shelf/bin location"
                                    value={localFilters.warehouse_location}
                                    onChange={(event) => setLocalFilters({ ...localFilters, warehouse_location: event.target.value })}
                                    onKeyDown={(event) => event.key === 'Enter' && applyFilters()}
                                    className="h-10 rounded-lg border border-brand-sand bg-brand-warm/10 text-xs font-medium focus-visible:ring-2 focus-visible:ring-brand-rust/20"
                                />
                                <select
                                    value={localFilters.status}
                                    onChange={(event) => setLocalFilters({ ...localFilters, status: event.target.value })}
                                    aria-label="Filter by status"
                                    className="h-10 rounded-lg border border-brand-sand bg-brand-warm/10 px-4 text-xs font-medium text-brand-text focus-visible:ring-2 focus-visible:ring-brand-rust/20 outline-none"
                                >
                                    <option value="">All statuses</option>
                                    <option value="received_by_branch">At Warehouse</option>
                                    <option value="arrived">Arrived</option>
                                </select>
                                <select
                                    value={localFilters.batch_assignment}
                                    onChange={(event) => setLocalFilters({ ...localFilters, batch_assignment: event.target.value })}
                                    aria-label="Filter by batch state"
                                    className="h-10 rounded-lg border border-brand-sand bg-brand-warm/10 px-4 text-xs font-medium text-brand-text focus-visible:ring-2 focus-visible:ring-brand-rust/20 outline-none"
                                >
                                    <option value="all">All batch states</option>
                                    <option value="unbatched">Unbatched</option>
                                    <option value="batched">Batched</option>
                                </select>
                                <select
                                    value={localFilters.aging_bucket}
                                    onChange={(event) => setLocalFilters({ ...localFilters, aging_bucket: event.target.value })}
                                    aria-label="Filter by aging bucket"
                                    className="h-10 rounded-lg border border-brand-sand bg-brand-warm/10 px-4 text-xs font-medium text-brand-text focus-visible:ring-2 focus-visible:ring-brand-rust/20 outline-none"
                                >
                                    <option value="all">All ages</option>
                                    <option value="under_24">Under 24h</option>
                                    <option value="24_48">24-48h</option>
                                    <option value="48_plus">48h+</option>
                                    <option value="critical">Critical</option>
                                </select>
                                <div className="grid grid-cols-2 gap-2 md:contents">
                                    <Button type="button" onClick={applyFilters} className="h-10 rounded-lg px-6 text-xs font-medium w-full">
                                        Apply
                                    </Button>
                                    <Button type="button" variant="outline" onClick={clearFilters} className="h-10 rounded-lg px-6 text-xs font-medium w-full">
                                        Clear
                                    </Button>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-brand-sand/30 bg-white shadow-sm">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-brand-warm/30 border-b border-brand-sand/30">
                                            <th className="px-6 py-4 text-xs font-medium text-muted-foreground">Box Identifier</th>
                                            <th className="px-6 py-4 text-xs font-medium text-muted-foreground">Phase & Context</th>
                                            <th className="px-6 py-4 text-xs font-medium text-muted-foreground">Aging</th>
                                            <th className="px-6 py-4 text-xs font-medium text-muted-foreground">Consolidation</th>
                                            <th className="px-6 py-4 text-xs font-medium text-muted-foreground text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-brand-sand/20">
                                        {readyToLoad.map((box) => (
                                            <tr key={box.id} className="group hover:bg-brand-warm/10 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-10 rounded-xl bg-brand-warm/50 flex items-center justify-center text-brand-text group-hover:bg-brand-secondary/20 group-hover:text-brand-secondary transition-colors">
                                                            <Box className="size-4" />
                                                        </div>
                                                        <div>
                                                            <p className="font-mono text-sm font-medium text-brand-text tracking-tight">{box.tracking_number}</p>
                                                            <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{box.box_type?.name || 'Custom Box'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-2">
                                                            {box.is_domestic ? (
                                                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold border border-emerald-200">Manila Terminal</span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded bg-brand-warm text-brand-text/60 text-[10px] font-bold border border-brand-sand/50">Ocean Transit</span>
                                                            )}
                                                            <span className="text-xs font-semibold text-brand-text-mid truncate max-w-37.5">Dest: {box.recipient?.province || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Zap className="size-3 text-brand-rust" />
                                                            <span className="text-[11px] font-semibold text-brand-rust/80 italic">Next: {box.next_step}</span>
                                                        </div>
                                                        {box.warehouse_location && (
                                                            <div className="flex items-center gap-1.5">
                                                                <Anchor className="size-3 text-brand-secondary" />
                                                                <span className="text-[11px] font-semibold text-brand-secondary">Bin: {box.warehouse_location}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className={`inline-flex flex-col rounded-xl border px-3 py-2 ${agingBadgeClass(box.aging_bucket)}`}>
                                                        <span className="text-[10px] font-semibold uppercase tracking-wider opacity-85">{box.aging_label}</span>
                                                        <span className="text-lg font-bold leading-tight mt-0.5">{box.age_hours}h</span>
                                                        {box.last_warehouse_event_at && (
                                                            <span className="mt-0.5 text-[9px] font-medium opacity-70">
                                                                Since {new Date(box.last_warehouse_event_at).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {box.missing_siblings > 0 ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1.5 text-brand-rust">
                                                                <AlertCircle className="size-3.5" />
                                                                <span className="text-xs font-semibold tracking-tight">Partial Booking</span>
                                                            </div>
                                                            <p className="text-[11px] font-medium text-muted-foreground ml-5 italic">{box.missing_siblings} boxes remaining</p>
                                                            {box.missing_sibling_boxes && box.missing_sibling_boxes.length > 0 && (
                                                                <p className="ml-5 max-w-55 truncate font-mono text-[11px] font-medium text-brand-rust/80">
                                                                    {box.missing_sibling_boxes.map((sibling) => sibling.tracking_number).join(', ')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 text-emerald-600">
                                                            <CheckCircle2 className="size-3.5" />
                                                            <span className="text-xs font-semibold tracking-tight">Complete Booking</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            disabled={box.booking?.declaration_form_status === 'missing'}
                                                            onClick={() => {
                                                                if (box.booking?.declaration_form_status === 'missing') return;
                                                                setMode('load');
                                                                loadForm.setData('tracking_number', box.tracking_number);
                                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                            }}
                                                            className={`size-9 rounded-lg flex items-center justify-center transition-all ${
                                                                box.booking?.declaration_form_status === 'missing'
                                                                    ? 'bg-red-50 text-red-400 cursor-not-allowed opacity-70'
                                                                    : 'bg-brand-rust/10 text-brand-rust hover:bg-brand-rust hover:text-white active:scale-90'
                                                            }`}
                                                            title={box.booking?.declaration_form_status === 'missing' ? "Declaration Form Missing - Cannot Load" : "Load into Container"}
                                                        >
                                                            {box.booking?.declaration_form_status === 'missing' ? <FileWarning className="size-4 text-red-500" /> : <Truck className="size-4" />}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedBox(box);
                                                                physicalsForm.setData({
                                                                    tracking_number: box.tracking_number,
                                                                    weight: box.weight?.toString() || '',
                                                                    actual_cbm: box.actual_cbm?.toString() || '',
                                                                    warehouse_location: box.warehouse_location || '',
                                                                });
                                                                setShowPhysicalsModal(true);
                                                            }}
                                                            className="size-9 rounded-lg bg-brand-secondary/10 text-brand-secondary flex items-center justify-center hover:bg-brand-secondary hover:text-white transition-all active:scale-90"
                                                            title="Measure & Locate"
                                                        >
                                                            <Ruler className="size-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedBox(box);
                                                                damageForm.setData('tracking_number', box.tracking_number);
                                                                setShowDamageModal(true);
                                                            }}
                                                            className="size-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all active:scale-90"
                                                            title="Report Damage"
                                                        >
                                                            <ShieldAlert className="size-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedBox(box);
                                                                holdForm.setData('tracking_number', box.tracking_number);
                                                                setShowHoldModal(true);
                                                            }}
                                                            className="size-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center hover:bg-amber-600 hover:text-white transition-all active:scale-90"
                                                            title="Place on Hold"
                                                        >
                                                            <AlertCircle className="size-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {readyToLoad.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-16 text-center">
                                                    <div className="size-16 rounded-xl bg-brand-warm mx-auto flex items-center justify-center text-brand-text/20 mb-4">
                                                        <Boxes className="size-8" />
                                                    </div>
                                                    <p className="text-sm font-medium tracking-[0.3em] text-brand-text opacity-40">No boxes awaiting processing</p>
                                                    <p className="text-xs font-medium text-muted-foreground mt-2">Scan inbound packages to populate this list.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* Exception Queue */}
                        {exceptionBoxes.length > 0 && (
                            <section className="mt-8 space-y-4 pt-8 border-t border-brand-sand/30">
                                <div className="flex items-center gap-2">
                                    <div className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                                    <h3 className="font-serif text-xl font-medium text-brand-text tracking-tight flex items-center gap-2">
                                        Exception Queue
                                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                                            {exceptionBoxes.length} Issues
                                        </span>
                                    </h3>
                                </div>
                                <div className="overflow-x-auto rounded-xl border border-red-200 bg-white shadow-sm">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-red-50/50 border-b border-red-100">
                                                <th className="px-6 py-4 text-xs font-medium text-red-800">Box Identifier</th>
                                                <th className="px-6 py-4 text-xs font-medium text-red-800">Status</th>
                                                <th className="px-6 py-4 text-xs font-medium text-red-800">Destination</th>
                                                <th className="px-6 py-4 text-xs font-medium text-red-800">Last Update</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-red-100/50">
                                            {exceptionBoxes.map((box) => (
                                                <tr key={box.id} className="hover:bg-red-50/30 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="size-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600">
                                                                <FileWarning className="size-4" />
                                                            </div>
                                                            <div>
                                                                <p className="font-mono text-sm font-medium text-brand-text tracking-tight">{box.tracking_number}</p>
                                                                <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{box.booking?.reference_number}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                                                            box.status === 'damaged' 
                                                                ? 'bg-red-100 text-red-700 border-red-200' 
                                                                : 'bg-amber-100 text-amber-700 border-amber-200'
                                                        }`}>
                                                            {humanize(box.status)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-xs font-medium text-brand-text">{box.recipient?.city}</p>
                                                        <p className="text-[11px] font-medium text-muted-foreground">{box.recipient?.province}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {box.updates && box.updates.length > 0 ? (
                                                            <div className="text-xs">
                                                                <p className="font-medium text-brand-text max-w-[200px] truncate" title={box.updates[0].notes ?? undefined}>
                                                                    {box.updates[0].notes || 'No notes provided'}
                                                                </p>
                                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                                    {new Date(box.updates[0].created_at).toLocaleString()}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground italic">No details</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}

                        {/* Mobile Vitals (shown only on mobile/tablet) */}
                        <section className="lg:hidden space-y-8 pt-8 border-t border-brand-sand/30">
                            <div className="space-y-1">
                                <h3 className="font-serif text-2xl font-medium text-brand-text">Warehouse Vitals</h3>
                                <p className="text-xs font-medium text-muted-foreground">Real-time statistics & active container batches</p>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* Awaiting Receipt */}
                                <div className="group p-4 rounded-xl bg-white border border-brand-sand/50 shadow-sm transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="p-2 rounded-lg bg-brand-secondary/10 text-brand-secondary">
                                            <Clock className="size-4" />
                                        </div>
                                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Live Status</span>
                                    </div>
                                    <h4 className="text-xs font-medium text-muted-foreground">Awaiting Receipt</h4>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-3xl font-serif font-medium text-brand-text">{stats.pendingReceipt}</span>
                                        <span className="text-xs font-medium text-muted-foreground">Boxes</span>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-brand-sand/30">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-brand-secondary animate-pulse" />
                                            <p className="text-xs font-medium text-muted-foreground italic opacity-60">With pickers</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Needs Sorting */}
                                <div className="group p-4 rounded-xl bg-white border border-brand-sand/50 shadow-sm transition-all hover:shadow-md">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                                            <ListFilter className="size-4" />
                                        </div>
                                    </div>
                                    <h4 className="text-xs font-medium text-muted-foreground">Needs Sorting</h4>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-3xl font-serif font-medium text-emerald-700">{stats.needsSorting}</span>
                                        <span className="text-xs font-medium text-muted-foreground">Boxes</span>
                                    </div>
                                </div>

                                {/* Aging Stats */}
                                <div className="group p-4 rounded-xl bg-white border border-brand-sand/50 shadow-sm transition-all hover:shadow-md">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div className="p-2 rounded-lg bg-red-500/10 text-red-600">
                                            <AlertCircle className="size-4" />
                                        </div>
                                        <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">Aging</span>
                                    </div>
                                    <h4 className="text-xs font-medium text-muted-foreground">Warehouse Aging</h4>
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-700">
                                            <p className="text-sm font-semibold">{stats.aging.under_24}</p>
                                            <p className="text-[9px] font-medium">Under 24h</p>
                                        </div>
                                        <div className="rounded-lg bg-amber-50 p-2 text-amber-700">
                                            <p className="text-sm font-semibold">{stats.aging['24_48']}</p>
                                            <p className="text-[9px] font-medium">24-48h</p>
                                        </div>
                                        <div className="rounded-lg bg-orange-50 p-2 text-orange-700">
                                            <p className="text-sm font-semibold">{stats.aging['48_plus']}</p>
                                            <p className="text-[9px] font-medium">48h+</p>
                                        </div>
                                        <div className="rounded-lg bg-red-50 p-2 text-red-700">
                                            <p className="text-sm font-semibold">{stats.aging.critical}</p>
                                            <p className="text-[9px] font-medium">Critical</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Active Batches Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="size-1.5 rounded-full bg-brand-rust" />
                                        <h3 className="text-xs font-medium text-brand-text">Active Containers</h3>
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-md">
                                        {activeBatches.length} Total
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {activeBatches.map((batch) => {
                                        const progress = Math.min((batch.current_box_count / batch.capacity_boxes) * 100, 100);
                                        const isSelected = selectedBatchId === batch.id;

                                        return (
                                            <div
                                                key={batch.id}
                                                onClick={() => {
                                                    setMode('load');
                                                    setSelectedBatchId(batch.id);
                                                    loadForm.setData('batch_id', batch.id);
                                                }}
                                                className={`relative p-4 rounded-xl border transition-all cursor-pointer group ${
                                                    isSelected ? 'border-brand-rust bg-brand-rust/3 ring-2 ring-brand-rust/5 shadow-md' : 'border-brand-sand/40 bg-white hover:border-brand-rust/30'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <p className="text-xs font-medium text-muted-foreground mb-0.5">Batch {batch.batch_number}</p>
                                                        <h5 className="text-base font-semibold text-brand-text">{batch.batch_number}</h5>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                        batch.status === 'loading' ? 'bg-amber-100 text-amber-700' : 'bg-brand-warm text-brand-text/60'
                                                    }`}>
                                                        {humanize(batch.status)}
                                                    </span>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between text-xs font-medium">
                                                            <span className="text-muted-foreground">Box Capacity</span>
                                                            <span className="text-brand-text">{batch.current_box_count} / {batch.capacity_boxes}</span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-brand-warm rounded-full overflow-hidden border border-brand-sand/30">
                                                            <div
                                                                className="h-full bg-brand-rust transition-all duration-500 ease-out rounded-full shadow-[0_0_10px_rgba(183,73,55,0.4)]"
                                                                style={{ width: `${progress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                fetchBatchDetails(batch.id);
                                                            }}
                                                            className="text-xs font-semibold text-brand-rust hover:text-brand-rust/80 flex items-center gap-1 transition-colors"
                                                        >
                                                            View Details <ArrowRight className="size-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>
                    </div>
                </main>
            </div>

            {/* Modal for Reporting Damage */}
            <Dialog open={showDamageModal} onOpenChange={setShowDamageModal}>
                <DialogContent className="rounded-xl p-6 border border-brand-sand bg-white shadow-xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-xl font-medium text-brand-text">Report Damage: {selectedBox?.tracking_number}</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground">
                            Describe the damage found. This will notify the sender and create a log entry.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleMarkDamaged} className="space-y-6 mt-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="damage-notes" className="text-xs font-semibold text-muted-foreground ml-1">Damage Description</Label>
                            <textarea
                                id="damage-notes"
                                className="w-full min-h-25 rounded-lg border border-brand-sand bg-brand-warm/5 p-4 text-sm font-medium focus:border-brand-rust focus:ring-2 focus:ring-brand-rust/5 transition-all outline-none"
                                placeholder="e.g. Wet bottom, torn tape, crushed corner..."
                                value={damageForm.data.notes}
                                onChange={e => damageForm.setData('notes', e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setShowDamageModal(false)} className="rounded-lg px-5 h-10 text-xs font-medium">Cancel</Button>
                            <Button type="submit" disabled={damageForm.processing} variant="destructive" className="rounded-lg px-6 h-10 text-xs font-medium">Confirm Damage</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal for Placing Hold */}
            <Dialog open={showHoldModal} onOpenChange={setShowHoldModal}>
                <DialogContent className="rounded-xl p-6 border border-brand-sand bg-white shadow-xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-xl font-medium text-brand-text">Place Hold: {selectedBox?.tracking_number}</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground">
                            Specify the reason for holding this package at the warehouse.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleMarkHeld} className="space-y-6 mt-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="hold-notes" className="text-xs font-semibold text-muted-foreground ml-1">Hold Reason</Label>
                            <textarea
                                id="hold-notes"
                                className="w-full min-h-[100px] rounded-lg border border-brand-sand bg-brand-warm/5 p-4 text-sm font-medium focus:border-brand-rust focus:ring-2 focus:ring-brand-rust/5 transition-all outline-none"
                                placeholder="e.g. Waiting for other boxes, Payment pending..."
                                value={holdForm.data.notes}
                                onChange={e => holdForm.setData('notes', e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setShowHoldModal(false)} className="rounded-lg px-5 h-10 text-xs font-medium">Cancel</Button>
                            <Button type="submit" disabled={holdForm.processing} variant="warning" className="rounded-lg px-6 h-10 text-xs font-medium">Confirm Hold</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal for Physicals Update */}
            <Dialog open={showPhysicalsModal} onOpenChange={setShowPhysicalsModal}>
                <DialogContent className="rounded-xl p-6 border border-brand-sand bg-white shadow-xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-xl font-medium text-brand-text">Inventory Logistics: {selectedBox?.tracking_number}</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground">
                            Update box dimensions, weight, or shelf location within the hub.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdatePhysicals} className="space-y-6 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="weight" className="text-xs font-semibold text-muted-foreground ml-1">Weight (kg)</Label>
                                <Input
                                    id="weight"
                                    type="number"
                                    step="0.01"
                                    className="h-10 rounded-lg border border-brand-sand bg-brand-warm/5 px-3 font-medium text-sm focus-visible:ring-2 focus-visible:ring-brand-secondary/20"
                                    value={physicalsForm.data.weight}
                                    onChange={e => physicalsForm.setData('weight', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="actual_cbm" className="text-xs font-semibold text-muted-foreground ml-1">Actual CBM (m³)</Label>
                                <Input
                                    id="actual_cbm"
                                    type="number"
                                    step="0.0001"
                                    className="h-10 rounded-lg border border-brand-sand bg-brand-warm/5 px-3 font-medium text-sm focus-visible:ring-2 focus-visible:ring-brand-secondary/20"
                                    value={physicalsForm.data.actual_cbm}
                                    onChange={e => physicalsForm.setData('actual_cbm', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="loc" className="text-xs font-semibold text-muted-foreground ml-1">Shelf / Bin Location</Label>
                            <div className="relative group">
                                <Anchor className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-brand-text/30 group-focus-within:text-brand-secondary transition-colors" />
                                <Input
                                    id="loc"
                                    placeholder="e.g. Bin-12, Row-A"
                                    className="h-10 rounded-lg border border-brand-sand bg-brand-warm/5 pl-9 pr-4 font-medium text-sm focus:border-brand-secondary focus:ring-4 focus:ring-brand-secondary/5 transition-all"
                                    value={physicalsForm.data.warehouse_location}
                                    onChange={e => physicalsForm.setData('warehouse_location', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setShowPhysicalsModal(false)} className="rounded-lg px-5 h-10 text-xs font-medium">Cancel</Button>
                            <Button type="submit" disabled={physicalsForm.processing} variant="brand-secondary" className="rounded-lg px-8 h-10 text-xs font-medium transition-all active:scale-95">Update Logistics</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal for Payment Override */}
            <Dialog open={showPaymentOverrideModal} onOpenChange={setShowPaymentOverrideModal}>
                <DialogContent className="rounded-xl p-6 border border-brand-sand bg-white shadow-xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-xl font-medium text-brand-text">Payment Unconfirmed</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground">
                            {paymentOverrideData?.message}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setShowPaymentOverrideModal(false)} className="rounded-lg px-5 h-10 text-xs font-medium">Cancel</Button>
                        <Button
                            type="button"
                            onClick={() => {
                                const overrideTracking = paymentOverrideData?.tracking_number || receiveForm.data.tracking_number;
                                setShowPaymentOverrideModal(false);
                                setPaymentOverrideData(null);
                                
                                router.post('/warehouse/receive', {
                                    tracking_number: overrideTracking,
                                    tracking_step_key: receiveForm.data.tracking_step_key,
                                    force_receive: true
                                }, {
                                    onSuccess: () => {
                                        triggerFeedback('success', `Received ${overrideTracking}`);
                                        addRecentScan(overrideTracking, 'receive');
                                        receiveForm.reset('tracking_number', 'force_receive');
                                        inputRef.current?.focus();
                                    },
                                    onError: (errors) => {
                                        const msg = (errors.tracking_number || Object.values(errors)[0] || 'Receipt failed') as string;
                                        triggerFeedback('error', msg);
                                        setScanError(msg);
                                        receiveForm.reset('force_receive');
                                    }
                                });
                            }}
                            variant="brand-secondary"
                            className="rounded-lg px-8 h-10 text-xs font-medium transition-all active:scale-95"
                        >
                            Override & Receive
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Modal for Batch Details */}
            <Dialog open={showBatchDetailsModal} onOpenChange={setShowBatchDetailsModal}>
                <DialogContent className="rounded-xl p-0 border border-brand-sand bg-white shadow-xl max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                    <DialogHeader className="px-6 py-5 border-b border-brand-sand bg-brand-warm/30 shrink-0">
                        <DialogTitle className="font-serif text-xl font-medium text-brand-text flex items-center gap-2">
                            <Truck className="size-5 text-brand-rust" />
                            Batch Details: {batchDetails?.batch_number}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground flex gap-4 mt-2">
                            <span className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-brand-sand/50 shadow-sm">
                                <Box className="size-3.5" />
                                {batchDetails?.boxes?.length || 0} / {batchDetails?.capacity_boxes || 0} Boxes
                            </span>
                            <span className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-brand-sand/50 shadow-sm">
                                <Ruler className="size-3.5" />
                                {batchDetails?.current_cbm || 0} / {batchDetails?.capacity_cbm || 0} CBM
                            </span>
                            <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                                batchDetails?.status === 'loading' ? 'bg-amber-100 text-amber-700' : 'bg-brand-warm text-brand-text/60'
                            }`}>
                                {humanize(batchDetails?.status || '')}
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="overflow-y-auto flex-1 p-0">
                        {isLoadingBatchDetails ? (
                            <div className="flex flex-col items-center justify-center h-48 gap-3">
                                <Loader2 className="size-6 animate-spin text-brand-rust" />
                                <span className="text-sm font-medium text-muted-foreground">Loading contents...</span>
                            </div>
                        ) : batchDetails?.boxes && batchDetails.boxes.length > 0 ? (
                            <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 bg-white shadow-sm border-b border-brand-sand">
                                    <tr>
                                        <th className="px-6 py-3 text-xs font-semibold text-muted-foreground">Tracking Number</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-muted-foreground">Type</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-muted-foreground">Booking Ref</th>
                                        <th className="px-6 py-3 text-xs font-semibold text-muted-foreground">Destination</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-brand-sand/30">
                                    {batchDetails.boxes.map((box: any) => (
                                        <tr key={box.id} className="hover:bg-brand-warm/10">
                                            <td className="px-6 py-3 font-mono font-medium text-brand-text">{box.tracking_number}</td>
                                            <td className="px-6 py-3 text-brand-text text-xs">{box.box_type?.name || 'Custom'}</td>
                                            <td className="px-6 py-3 font-mono text-muted-foreground text-xs">{box.booking?.reference_number}</td>
                                            <td className="px-6 py-3 text-xs text-brand-text">
                                                {box.recipient?.city}, {box.recipient?.province}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm font-medium">
                                <Truck className="size-8 text-brand-sand mb-2" />
                                No boxes loaded in this batch.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

        </AppLayout>
    );
}
