import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Html5Qrcode } from 'html5-qrcode';
import { AlertCircle, Anchor, ArrowRight, BarChart3, Box, Boxes, Camera, CheckCircle2, Clock, History, ListFilter, Loader2, QrCode, Ruler, ShieldAlert, Truck, Zap, FileWarning, Wifi, WifiOff, RefreshCw, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
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

    const damageForm = useForm<{
        tracking_number: string;
        notes: string;
        damage_photo: File | null;
    }>({
        tracking_number: '',
        notes: '',
        damage_photo: null,
    });
    const [damagePhotoPreview, setDamagePhotoPreview] = useState<string | null>(null);
    const damageFileInputRef = useRef<HTMLInputElement>(null);

    // Offline Container Buffer (Faraday Cage Resilience)
    const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const [offlineLoadQueue, setOfflineLoadQueue] = useState<Array<{ tracking: string; timestamp: number; batchId: number }>>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem('lb_warehouse_offline_load_queue');
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });
    const [isSyncingOfflineQueue, setIsSyncingOfflineQueue] = useState(false);
    const [showShortcutsModal, setShowShortcutsModal] = useState(false);

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

    // Network listeners & localStorage persistence for offline queue
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            toast.success('Connection restored. You can sync pending container scans.');
        };
        const handleOffline = () => {
            setIsOnline(false);
            toast.warning('Offline mode: Scans will be buffered in container queue.');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Global Keyboard Hotkeys for warehouse floor efficiency
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            const isInputFocused = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

            if (e.key === '?' && !isInputFocused) {
                e.preventDefault();
                setShowShortcutsModal(prev => !prev);
                return;
            }

            if (!isInputFocused && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (e.key === 'r' || e.key === 'R') {
                    setMode('receive');
                    inputRef.current?.focus();
                } else if (e.key === 'l' || e.key === 'L') {
                    setMode('load');
                    inputRef.current?.focus();
                } else if (e.key === 'u' || e.key === 'U') {
                    setMode('unload');
                    inputRef.current?.focus();
                } else if (e.key === ' ' && inputRef.current) {
                    e.preventDefault();
                    inputRef.current.focus();
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem('lb_warehouse_offline_load_queue', JSON.stringify(offlineLoadQueue));
        } catch (e) {
            console.error('Failed to store offline load queue:', e);
        }
    }, [offlineLoadQueue]);

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

        const currentBatchId = Number(loadForm.data.batch_id);

        // Faraday Cage Container Mode: If offline, buffer immediately
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            const isAlreadyQueued = offlineLoadQueue.some(
                item => item.tracking.toLowerCase() === normalizedTracking.toLowerCase() && item.batchId === currentBatchId
            );

            if (isAlreadyQueued) {
                const message = `Already in offline container buffer: ${normalizedTracking}`;
                triggerFeedback('error', message);
                toast.warning(message);
                lastSubmittedScanRef.current = { tracking: '', timestamp: 0 };
                return;
            }

            setOfflineLoadQueue(prev => [
                ...prev,
                { tracking: normalizedTracking, timestamp: Date.now(), batchId: currentBatchId }
            ]);
            triggerFeedback('success', `Buffered ${normalizedTracking} (Offline)`);
            addRecentScan(normalizedTracking, 'load');
            loadForm.reset('tracking_number');
            inputRef.current?.focus();
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
                // If offline mid-flight
                if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    setOfflineLoadQueue(prev => [
                        ...prev,
                        { tracking: normalizedTracking, timestamp: Date.now(), batchId: currentBatchId }
                    ]);
                    triggerFeedback('success', `Buffered ${normalizedTracking} (Offline)`);
                    addRecentScan(normalizedTracking, 'load');
                    loadForm.reset('tracking_number');
                    inputRef.current?.focus();
                    return;
                }

                const msg = (errors.tracking_number || Object.values(errors)[0] || 'Loading failed') as string;

                triggerFeedback('error', msg);
                setScanError(msg);
                toast.error(msg);
                lastSubmittedScanRef.current = { tracking: '', timestamp: 0 };
                inputRef.current?.focus();
            },
        });
    }, [addRecentScan, loadForm, unloadForm, mode, receiveForm, triggerFeedback, offlineLoadQueue]);

    const flushOfflineQueue = useCallback((targetBatchId?: number) => {
        const batchToSync = targetBatchId || Number(loadForm.data.batch_id);
        const itemsToSync = offlineLoadQueue.filter(item => !batchToSync || item.batchId === batchToSync);

        if (itemsToSync.length === 0) {
            toast.info('No pending offline scans for this container.');
            return;
        }

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            toast.error('Cannot sync while offline. Please reconnect to network.');
            return;
        }

        setIsSyncingOfflineQueue(true);
        const trackingNumbers = itemsToSync.map(i => i.tracking);
        const activeTargetBatchId = itemsToSync[0].batchId;

        router.post('/warehouse/load-batch', {
            batch_id: activeTargetBatchId,
            tracking_numbers: trackingNumbers,
            tracking_step_key: loadForm.data.tracking_step_key || 'loading_container',
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setOfflineLoadQueue(prev => prev.filter(item => item.batchId !== activeTargetBatchId));
                emitFeedbackSignal('success');
                toast.success(`Synced ${trackingNumbers.length} offline scans into container!`);
            },
            onError: (errs) => {
                const msg = Object.values(errs)[0] || 'Batch sync failed';
                toast.error(String(msg));
            },
            onFinish: () => {
                setIsSyncingOfflineQueue(false);
            },
        });
    }, [offlineLoadQueue, loadForm.data.batch_id, loadForm.data.tracking_step_key, emitFeedbackSignal]);

    const captureViewfinderSnapshot = () => {
        const video = document.querySelector('#warehouse-reader video') as HTMLVideoElement | null;
        if (!video || !video.videoWidth || !video.videoHeight) {
            toast.error('Scanner camera is not currently active. Please use file upload.');
            return;
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                toast.error('Unable to capture camera frame.');
                return;
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                if (!blob) {
                    toast.error('Failed to convert frame to image.');
                    return;
                }
                const filename = `damage_${selectedBox?.tracking_number || 'box'}_${Date.now()}.jpg`;
                const file = new File([blob], filename, { type: 'image/jpeg' });
                damageForm.setData('damage_photo', file);

                if (damagePhotoPreview) {
                    URL.revokeObjectURL(damagePhotoPreview);
                }
                const url = URL.createObjectURL(blob);
                setDamagePhotoPreview(url);
                emitFeedbackSignal('success');
                toast.success('Captured damage photo from live viewfinder!');
            }, 'image/jpeg', 0.88);
        } catch (err) {
            console.error('Snapshot capture failed:', err);
            toast.error('Failed to capture snapshot from camera.');
        }
    };

    const handleDamageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast.error('Photo exceeds 10MB limit.');
            return;
        }

        damageForm.setData('damage_photo', file);
        if (damagePhotoPreview) {
            URL.revokeObjectURL(damagePhotoPreview);
        }
        const url = URL.createObjectURL(file);
        setDamagePhotoPreview(url);
    };

    const clearDamagePhoto = () => {
        damageForm.setData('damage_photo', null);
        if (damagePhotoPreview) {
            URL.revokeObjectURL(damagePhotoPreview);
        }
        setDamagePhotoPreview(null);
        if (damageFileInputRef.current) {
            damageFileInputRef.current.value = '';
        }
    };

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
            forceFormData: true,
            onSuccess: () => {
                setShowDamageModal(false);
                damageForm.reset();
                clearDamagePhoto();
                toast.success('Box marked as DAMAGED with photo evidence.');
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
            under_24: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
            '24_48': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
            '48_plus': 'bg-orange-500/10 text-orange-400 border-orange-500/30',
            critical: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        }[bucket];
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Warehouse Dashboard | Command Center" />

            <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-background">

                {/* Left Sidebar: Warehouse Vitals */}
                <aside className="hidden lg:flex w-100 flex-col bg-card border-r border-border overflow-y-auto custom-scrollbar shadow-xl z-20">
                    <div className="p-8 space-y-10">
                        {/* Heading */}
                        <div className="space-y-1">
                            <h2 className="font-serif text-2xl font-medium text-brand-text">Warehouse Stats</h2>
                            <p className="text-xs font-medium tracking-[0.3em] text-brand-text-light">Inventory • Warehouse Vitals</p>
                        </div>

                        {/* Mode Selector */}
                        <div className="space-y-4">
                            <Label className="text-xs font-medium text-brand-text-mid ml-1">Operations Mode</Label>
                            <div className="grid grid-cols-3 gap-2 bg-brand-warm/10 p-1.5 rounded-2xl border border-border shadow-2xs">
                                <button
                                    type="button"
                                    onClick={() => setMode('receive')}
                                    className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                        mode === 'receive' ? 'bg-amber-600 text-white shadow-md' : 'text-brand-text-mid hover:bg-brand-warm/20 bg-card border border-border/50'
                                    }`}
                                >
                                    <QrCode className="size-4 shrink-0" />
                                    <span>Receive</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('load')}
                                    className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                        mode === 'load' ? 'bg-brand-rust text-white shadow-md' : 'text-brand-text-mid hover:bg-brand-warm/20 bg-card border border-border/50'
                                    }`}
                                >
                                    <Truck className="size-4 shrink-0" />
                                    <span>Load</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('unload')}
                                    className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                        mode === 'unload' ? 'bg-sky-600 text-white shadow-md' : 'text-brand-text-mid hover:bg-brand-warm/20 bg-card border border-border/50'
                                    }`}
                                >
                                    <Anchor className="size-4 shrink-0" />
                                    <span>Unload</span>
                                </button>
                            </div>
                        </div>

                        {/* Real-time Stats Cards */}
                        <div className="grid grid-cols-1 gap-4">
                            <div className="group p-4 rounded-xl bg-card border border-border shadow-2xs transition-all hover:shadow-md hover:border-amber-500/30">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                                        <Clock className="size-4" />
                                    </div>
                                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Live Status</span>
                                </div>
                                <h4 className="text-xs font-medium text-brand-text-mid">Awaiting Receipt</h4>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-3xl font-serif font-medium text-brand-text">{stats.pendingReceipt}</span>
                                    <span className="text-xs font-medium text-brand-text-light">Boxes</span>
                                </div>
                                <div className="mt-3 pt-3 border-t border-border">
                                    <div className="flex items-center gap-2">
                                        <div className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                                        <p className="text-xs font-medium text-brand-text-light italic">Items currently with pickers</p>
                                    </div>
                                </div>
                            </div>

                            <div className="group p-4 rounded-xl bg-card border border-border shadow-2xs transition-all hover:shadow-md hover:border-emerald-500/30">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                        <ListFilter className="size-4" />
                                    </div>
                                </div>
                                <h4 className="text-xs font-medium text-brand-text-mid">Needs Sorting</h4>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-3xl font-serif font-medium text-emerald-400">{stats.needsSorting}</span>
                                    <span className="text-xs font-medium text-brand-text-light">Boxes</span>
                                </div>
                            </div>

                            <div className="group p-4 rounded-xl bg-card border border-border shadow-2xs transition-all hover:shadow-md hover:border-rose-500/30">
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                                        <AlertCircle className="size-4" />
                                    </div>
                                    <span className="rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-400">
                                        Aging
                                    </span>
                                </div>
                                <h4 className="text-xs font-medium text-brand-text-mid">Warehouse Aging</h4>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-emerald-400">
                                        <p className="text-base font-semibold">{stats.aging.under_24}</p>
                                        <p className="text-[10px] font-medium">Under 24h</p>
                                    </div>
                                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-amber-400">
                                        <p className="text-base font-semibold">{stats.aging['24_48']}</p>
                                        <p className="text-[10px] font-medium">24-48h</p>
                                    </div>
                                    <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-2.5 text-orange-400">
                                        <p className="text-base font-semibold">{stats.aging['48_plus']}</p>
                                        <p className="text-[10px] font-medium">48h+</p>
                                    </div>
                                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2.5 text-rose-400">
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
                                <span className="text-xs font-medium text-brand-text-mid bg-brand-warm/20 border border-border px-2 py-1 rounded-md">
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
                                                isSelected ? 'border-brand-rust bg-brand-warm/20 ring-2 ring-brand-rust/20 shadow-md' : 'border-border bg-card hover:border-brand-rust/30 hover:bg-brand-warm/10'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div>
                                                    <p className="text-xs font-medium text-brand-text-light mb-0.5">Batch {batch.batch_number}</p>
                                                    <h5 className="text-base font-semibold text-brand-text">{batch.batch_number}</h5>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                                    batch.status === 'loading' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-brand-warm/20 text-brand-text-mid border-border'
                                                }`}>
                                                    {humanize(batch.status)}
                                                </span>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-xs font-medium">
                                                        <span className="text-brand-text-light">Box Capacity</span>
                                                        <span className="text-brand-text">{batch.current_box_count} / {batch.capacity_boxes}</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-brand-warm/20 rounded-full overflow-hidden border border-border">
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
                                                        className="text-xs font-semibold text-brand-rust hover:text-brand-rust/80 flex items-center gap-1 transition-colors cursor-pointer"
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
                                <History className="size-4 text-brand-text-light" />
                                <h3 className="text-xs font-medium text-brand-text">Recent Activity</h3>
                            </div>
                            <div className="space-y-3">
                                {recentScans.map((scan, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-brand-warm/10 border border-border">
                                        <div className={`size-8 rounded-lg flex items-center justify-center ${scan.mode === 'receive' ? 'bg-amber-500/20 text-amber-400' : scan.mode === 'unload' ? 'bg-sky-500/20 text-sky-400' : 'bg-brand-rust/20 text-brand-rust'}`}>
                                            {scan.mode === 'receive' ? <QrCode className="size-4" /> : scan.mode === 'unload' ? <Anchor className="size-4" /> : <Truck className="size-4" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-mono text-sm font-medium text-brand-text truncate">{scan.trackingNumber}</p>
                                            <p className="text-xs font-medium text-brand-text-light">{scan.timeLabel} • {scan.mode}</p>
                                        </div>
                                    </div>
                                ))}
                                {recentScans.length === 0 && (
                                    <p className="text-xs text-brand-text-light font-medium text-center py-4 opacity-50 italic">No activity yet</p>
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
                    <div className="flex items-center justify-between px-4 sm:px-6 lg:px-10 py-4 sm:py-6 bg-card border-b border-border shadow-2xs z-10">
                        <div className="flex flex-col">
                            <h3 className="font-serif text-xl font-medium text-brand-text">Operations Hub</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`size-2 rounded-full ${isScanning ? 'bg-emerald-400 animate-pulse' : 'bg-brand-warm/30'}`} />
                                <span className="text-xs font-medium text-brand-text-light">
                                    {mode === 'receive' ? 'Receipt Inbound' : mode === 'unload' ? 'Unload Container' : 'Export Loading'} • {isScanning ? 'Live' : 'Paused'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Faraday Container Buffer Indicator */}
                            {offlineLoadQueue.length > 0 ? (
                                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl shadow-xs animate-in fade-in duration-300">
                                    <span className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                    </span>
                                    <span className="text-xs font-bold text-amber-500">
                                        {offlineLoadQueue.length} buffered {offlineLoadQueue.length === 1 ? 'scan' : 'scans'}
                                    </span>
                                    <Button
                                        size="sm"
                                        onClick={() => flushOfflineQueue()}
                                        disabled={isSyncingOfflineQueue || !isOnline}
                                        className="h-7 px-2.5 text-[11px] font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white cursor-pointer shadow-xs transition-all flex items-center gap-1"
                                        title={isOnline ? "Sync pending offline scans now" : "Connect to network to sync"}
                                    >
                                        {isSyncingOfflineQueue ? (
                                            <Loader2 className="size-3 animate-spin" />
                                        ) : (
                                            <RefreshCw className="size-3" />
                                        )}
                                        Sync Now
                                    </Button>
                                </div>
                            ) : !isOnline ? (
                                <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl text-amber-500 text-xs font-semibold">
                                    <WifiOff className="size-3.5" />
                                    <span>Faraday Offline Active</span>
                                </div>
                            ) : (
                                <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                                    <Wifi className="size-3.5" />
                                    <span>Online</span>
                                </div>
                            )}

                            <div className="hidden sm:flex items-center gap-3 bg-brand-warm/10 px-4 py-2 rounded-xl border border-border">
                                <BarChart3 className="size-4 text-brand-text-light" />
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
                                <Label className="text-xs font-semibold text-brand-text-mid ml-1">Operations Mode</Label>
                                <div className="grid grid-cols-3 gap-2 bg-brand-warm/10 p-1.5 rounded-2xl border border-border shadow-2xs">
                                    <button
                                        type="button"
                                        onClick={() => setMode('receive')}
                                        className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                            mode === 'receive' ? 'bg-amber-600 text-white shadow-md' : 'text-brand-text-mid hover:bg-brand-warm/20 bg-card border border-border/50'
                                        }`}
                                    >
                                        <QrCode className="size-4 shrink-0" />
                                        <span>Receive</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMode('load')}
                                        className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                            mode === 'load' ? 'bg-brand-rust text-white shadow-md' : 'text-brand-text-mid hover:bg-brand-warm/20 bg-card border border-border/50'
                                        }`}
                                    >
                                        <Truck className="size-4 shrink-0" />
                                        <span>Load</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMode('unload')}
                                        className={`flex items-center justify-center gap-1.5 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                            mode === 'unload' ? 'bg-sky-600 text-white shadow-md' : 'text-brand-text-mid hover:bg-brand-warm/20 bg-card border border-border/50'
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
                            <div className={`group relative p-6 rounded-2xl border transition-all duration-500 bg-card shadow-2xs overflow-hidden ${
                                lastScanStatus === 'success' ? 'border-emerald-500 ring-4 ring-emerald-500/10' :
                                lastScanStatus === 'error' ? 'border-rose-500 ring-4 ring-rose-500/10' :
                                mode === 'receive' ? 'border-amber-500 ring-4 ring-amber-500/10' :
                                mode === 'unload' ? 'border-sky-500 ring-4 ring-sky-500/10' : 'border-brand-rust ring-4 ring-brand-rust/10'
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
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowShortcutsModal(true)}
                                                    className="text-[11px] font-bold text-brand-text-light hover:text-brand-text cursor-pointer px-1.5 py-0.5 rounded bg-brand-warm/30 border border-border"
                                                    title="Press ? for shortcuts"
                                                >
                                                    ? Keys
                                                </button>
                                                <button
                                                    onClick={() => setScannerCollapsed(!scannerCollapsed)}
                                                    className="text-xs font-semibold text-brand-text-light hover:text-brand-text cursor-pointer"
                                                >
                                                    {scannerCollapsed ? '[ Expand ]' : '[ Collapse ]'}
                                                </button>
                                            </div>
                                        </div>
                                        {!scannerCollapsed ? (
                                            <div className="relative aspect-square w-full max-w-[320px] mx-auto xl:mx-0 rounded-2xl border-2 border-emerald-500/40 bg-black overflow-hidden shadow-glow-emerald">
                                                <div id="warehouse-reader" className="w-full h-full [&_video]:object-cover" />
                                                
                                                {/* High-Tech HUD Laser Scanline */}
                                                <div className="laser-scanline" />

                                                {/* Reticle Corner Brackets */}
                                                <div className="absolute top-2 left-2 size-5 border-t-2 border-l-2 border-emerald-400 pointer-events-none z-20" />
                                                <div className="absolute top-2 right-2 size-5 border-t-2 border-r-2 border-emerald-400 pointer-events-none z-20" />
                                                <div className="absolute bottom-2 left-2 size-5 border-b-2 border-l-2 border-emerald-400 pointer-events-none z-20" />
                                                <div className="absolute bottom-2 right-2 size-5 border-b-2 border-r-2 border-emerald-400 pointer-events-none z-20" />

                                                {/* Ambient Viewfinder HUD Pill */}
                                                <div className="absolute top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-emerald-500/30 text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-widest pointer-events-none z-20 flex items-center gap-1">
                                                    <span className="size-1.5 rounded-full bg-emerald-400 animate-ping" />
                                                    OPTICAL SCAN ACTIVE
                                                </div>

                                                <div className="absolute inset-0 border-[14px] border-black/30 pointer-events-none z-10" />
                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 border border-emerald-400/40 rounded-xl pointer-events-none z-10 animate-pulse" />
                                            </div>
                                        ) : (
                                            <div className="aspect-square w-full max-w-[320px] mx-auto xl:mx-0 rounded-xl bg-brand-warm/10 flex flex-col items-center justify-center text-brand-text-light border border-dashed border-border italic">
                                                <QrCode className="size-10 mb-2 opacity-20" />
                                                <p className="text-xs font-medium opacity-60 text-center px-4">Camera paused. <br/>Manual entry active.</p>
                                            </div>
                                        )}

                                        {cameras.length > 1 && !scannerCollapsed && (
                                            <select
                                                aria-label="Select camera"
                                                title="Select camera"
                                                className="w-full h-9 rounded-lg border border-border bg-card text-xs font-medium text-brand-text px-3 appearance-none cursor-pointer hover:bg-brand-warm/20 transition-all outline-none"
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
                                            <p className="text-xs font-medium text-brand-text-light">
                                                {mode === 'receive' ? 'Scan items arriving from pickers to update their inventory status.' : mode === 'unload' ? 'Unlink boxes from their currently active shipping container.' : 'Link received boxes to the currently active shipping container.'}
                                            </p>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Tracking Input - THE BIG ONE */}
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold text-brand-text-mid ml-1">Manual / Scanner Entry</Label>
                                                <div className="relative group">
                                                    <input
                                                        ref={inputRef}
                                                        type="text"
                                                        placeholder="Scan tracking number..."
                                                        className={`w-full h-14 rounded-xl border px-5 font-mono text-xl font-medium transition-all shadow-inner ${
                                                            lastScanStatus === 'success' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 ring-4 ring-emerald-500/10' :
                                                            lastScanStatus === 'error' ? 'border-rose-500 bg-rose-500/10 text-rose-300 ring-4 ring-rose-500/10' :
                                                            'border-border bg-card text-brand-text focus:border-brand-rust focus:ring-4 focus:ring-brand-rust/10'
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
                                                        className={`absolute right-2 top-1/2 -translate-y-1/2 size-10 rounded-lg flex items-center justify-center transition-all active:scale-95 shadow-md cursor-pointer ${
                                                            mode === 'receive' ? 'bg-amber-600 text-white hover:bg-amber-500' : mode === 'unload' ? 'bg-sky-600 text-white hover:bg-sky-500' : 'bg-brand-rust text-white hover:bg-brand-rust/90'
                                                        }`}
                                                    >
                                                        {receiveForm.processing || unloadForm.processing || loadForm.processing ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" />}
                                                    </button>
                                                </div>
                                                {lastScanMessage && (
                                                    <div className={`flex items-center gap-2 mt-2 ml-2 text-xs font-semibold ${lastScanStatus === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {lastScanStatus === 'success' ? <CheckCircle2 className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
                                                        {lastScanMessage}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Phase Selection */}
                                            {mode !== 'unload' && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-1.5">
                                                        <Label className="text-xs font-semibold text-brand-text-mid ml-1">Update Milestone</Label>
                                                        <select
                                                            aria-label="Update Milestone"
                                                            className="w-full h-11 rounded-xl border border-border bg-card px-4 text-xs font-medium text-brand-text appearance-none cursor-pointer hover:bg-brand-warm/20 transition-all outline-none"
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
                                                            <Label className="text-xs font-semibold text-brand-text-mid ml-1">Loading Target</Label>
                                                            <div className="relative">
                                                                <select
                                                                    aria-label="Loading Target"
                                                                    className="w-full h-11 rounded-xl border border-brand-rust/30 bg-card px-4 pr-10 text-xs font-semibold text-brand-rust appearance-none cursor-pointer hover:bg-brand-warm/20 transition-all outline-none"
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
                                    <div className="size-10 rounded-xl bg-brand-warm/20 border border-border flex items-center justify-center text-brand-rust">
                                        <Boxes className="size-5" />
                                    </div>
                                    <h3 className="font-serif text-2xl font-medium text-brand-text tracking-tight">Loose Inventory</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                     <div className="hidden sm:flex items-center gap-2 bg-card px-4 py-2 rounded-xl border border-border shadow-2xs">
                                        <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                                        <span className="text-xs font-medium text-brand-text-mid">{readyToLoad.length} Ready to Process</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xs md:grid-cols-[1.2fr_1fr_1fr_1fr_auto_auto]">
                                <Input
                                    placeholder="Filter shelf/bin location"
                                    value={localFilters.warehouse_location}
                                    onChange={(event) => setLocalFilters({ ...localFilters, warehouse_location: event.target.value })}
                                    onKeyDown={(event) => event.key === 'Enter' && applyFilters()}
                                    className="h-10 rounded-xl border border-border bg-card text-xs font-medium text-brand-text focus-visible:ring-2 focus-visible:ring-ring"
                                />
                                <select
                                    value={localFilters.status}
                                    onChange={(event) => setLocalFilters({ ...localFilters, status: event.target.value })}
                                    aria-label="Filter by status"
                                    className="h-10 rounded-xl border border-border bg-card px-4 text-xs font-medium text-brand-text focus-visible:ring-2 focus-visible:ring-ring outline-none"
                                >
                                    <option value="">All statuses</option>
                                    <option value="received_by_branch">At Warehouse</option>
                                    <option value="arrived">Arrived</option>
                                </select>
                                <select
                                    value={localFilters.batch_assignment}
                                    onChange={(event) => setLocalFilters({ ...localFilters, batch_assignment: event.target.value })}
                                    aria-label="Filter by batch state"
                                    className="h-10 rounded-xl border border-border bg-card px-4 text-xs font-medium text-brand-text focus-visible:ring-2 focus-visible:ring-ring outline-none"
                                >
                                    <option value="all">All batch states</option>
                                    <option value="unbatched">Unbatched</option>
                                    <option value="batched">Batched</option>
                                </select>
                                <select
                                    value={localFilters.aging_bucket}
                                    onChange={(event) => setLocalFilters({ ...localFilters, aging_bucket: event.target.value })}
                                    aria-label="Filter by aging bucket"
                                    className="h-10 rounded-xl border border-border bg-card px-4 text-xs font-medium text-brand-text focus-visible:ring-2 focus-visible:ring-ring outline-none"
                                >
                                    <option value="all">All ages</option>
                                    <option value="under_24">Under 24h</option>
                                    <option value="24_48">24-48h</option>
                                    <option value="48_plus">48h+</option>
                                    <option value="critical">Critical</option>
                                </select>
                                <div className="grid grid-cols-2 gap-2 md:contents">
                                    <Button type="button" onClick={applyFilters} className="h-10 rounded-xl px-6 text-xs font-semibold bg-brand-rust text-white hover:bg-brand-rust/90 w-full cursor-pointer">
                                        Apply
                                    </Button>
                                    <Button type="button" variant="outline" onClick={clearFilters} className="h-10 rounded-xl px-6 text-xs font-semibold border-border bg-card text-brand-text hover:bg-brand-warm/20 w-full cursor-pointer">
                                        Clear
                                    </Button>
                                </div>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-2xs">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-brand-warm/10 dark:bg-brand-warm/20 border-b border-border">
                                            <th className="px-6 py-4 text-xs font-medium text-brand-text-mid">Box Identifier</th>
                                            <th className="px-6 py-4 text-xs font-medium text-brand-text-mid">Phase & Context</th>
                                            <th className="px-6 py-4 text-xs font-medium text-brand-text-mid">Aging</th>
                                            <th className="px-6 py-4 text-xs font-medium text-brand-text-mid">Consolidation</th>
                                            <th className="px-6 py-4 text-xs font-medium text-brand-text-mid text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {readyToLoad.map((box) => (
                                            <tr key={box.id} className="group hover:bg-brand-warm/10 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="size-10 rounded-xl bg-brand-warm/20 border border-border flex items-center justify-center text-brand-text group-hover:bg-amber-500/20 group-hover:text-amber-400 transition-colors">
                                                            <Box className="size-4" />
                                                        </div>
                                                        <div>
                                                            <p className="font-mono text-sm font-medium text-brand-text tracking-tight">{box.tracking_number}</p>
                                                            <p className="text-[11px] font-medium text-brand-text-light mt-0.5">{box.box_type?.name || 'Custom Box'}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1.5">
                                                        <div className="flex items-center gap-2">
                                                            {box.is_domestic ? (
                                                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">Manila Terminal</span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full bg-brand-warm/20 text-brand-text-mid text-[10px] font-bold border border-border">Ocean Transit</span>
                                                            )}
                                                            <span className="text-xs font-semibold text-brand-text-mid truncate max-w-37.5">Dest: {box.recipient?.province || 'N/A'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <Zap className="size-3 text-brand-rust" />
                                                            <span className="text-[11px] font-semibold text-brand-rust/90 italic">Next: {box.next_step}</span>
                                                        </div>
                                                        {box.warehouse_location && (
                                                            <div className="flex items-center gap-1.5">
                                                                <Anchor className="size-3 text-sky-400" />
                                                                <span className="text-[11px] font-semibold text-sky-400">Bin: {box.warehouse_location}</span>
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
                                                            <p className="text-[11px] font-medium text-brand-text-light ml-5 italic">{box.missing_siblings} boxes remaining</p>
                                                            {box.missing_sibling_boxes && box.missing_sibling_boxes.length > 0 && (
                                                                <p className="ml-5 max-w-55 truncate font-mono text-[11px] font-medium text-brand-rust/90">
                                                                    {box.missing_sibling_boxes.map((sibling) => sibling.tracking_number).join(', ')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 text-emerald-400">
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
                                                            className={`size-9 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                                                box.booking?.declaration_form_status === 'missing'
                                                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 cursor-not-allowed opacity-70'
                                                                    : 'bg-brand-rust/10 text-brand-rust border border-brand-rust/20 hover:bg-brand-rust hover:text-white active:scale-90'
                                                            }`}
                                                            title={box.booking?.declaration_form_status === 'missing' ? "Declaration Form Missing - Cannot Load" : "Load into Container"}
                                                        >
                                                            {box.booking?.declaration_form_status === 'missing' ? <FileWarning className="size-4 text-rose-400" /> : <Truck className="size-4" />}
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
                                                            className="size-9 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center hover:bg-sky-500 hover:text-white transition-all active:scale-90 cursor-pointer"
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
                                                            className="size-9 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all active:scale-90 cursor-pointer"
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
                                                            className="size-9 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all active:scale-90 cursor-pointer"
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
                                                    <div className="size-16 rounded-xl bg-brand-warm/20 mx-auto flex items-center justify-center text-brand-text/30 mb-4">
                                                        <Boxes className="size-8" />
                                                    </div>
                                                    <p className="text-sm font-medium tracking-[0.3em] text-brand-text opacity-40">No boxes awaiting processing</p>
                                                    <p className="text-xs font-medium text-brand-text-light mt-2">Scan inbound packages to populate this list.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* Exception Queue */}
                        {exceptionBoxes.length > 0 && (
                            <section className="mt-8 space-y-4 pt-8 border-t border-border">
                                <div className="flex items-center gap-2">
                                    <div className="size-1.5 rounded-full bg-rose-500 animate-pulse" />
                                    <h3 className="font-serif text-xl font-medium text-brand-text tracking-tight flex items-center gap-2">
                                        Exception Queue
                                        <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold">
                                            {exceptionBoxes.length} Issues
                                        </span>
                                    </h3>
                                </div>
                                <div className="overflow-x-auto rounded-2xl border border-rose-500/30 bg-card shadow-2xs">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-rose-500/10 border-b border-rose-500/20">
                                                <th className="px-6 py-4 text-xs font-medium text-rose-300">Box Identifier</th>
                                                <th className="px-6 py-4 text-xs font-medium text-rose-300">Status</th>
                                                <th className="px-6 py-4 text-xs font-medium text-rose-300">Destination</th>
                                                <th className="px-6 py-4 text-xs font-medium text-rose-300">Last Update</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-rose-500/20">
                                            {exceptionBoxes.map((box) => (
                                                <tr key={box.id} className="hover:bg-rose-500/5 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="size-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400">
                                                                <FileWarning className="size-4" />
                                                            </div>
                                                            <div>
                                                                <p className="font-mono text-sm font-medium text-brand-text tracking-tight">{box.tracking_number}</p>
                                                                <p className="text-[11px] font-medium text-brand-text-light mt-0.5">{box.booking?.reference_number}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                                            box.status === 'damaged' 
                                                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' 
                                                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                                        }`}>
                                                            {humanize(box.status)}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="text-xs font-medium text-brand-text">{box.recipient?.city}</p>
                                                        <p className="text-[11px] font-medium text-brand-text-light">{box.recipient?.province}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {box.updates && box.updates.length > 0 ? (
                                                            <div className="text-xs">
                                                                <p className="font-medium text-brand-text max-w-[200px] truncate" title={box.updates[0].notes ?? undefined}>
                                                                    {box.updates[0].notes || 'No notes provided'}
                                                                </p>
                                                                <p className="text-[10px] text-brand-text-light mt-0.5">
                                                                    {new Date(box.updates[0].created_at).toLocaleString()}
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-brand-text-light italic">No details</span>
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
                        <section className="lg:hidden space-y-8 pt-8 border-t border-border">
                            <div className="space-y-1">
                                <h3 className="font-serif text-2xl font-medium text-brand-text">Warehouse Vitals</h3>
                                <p className="text-xs font-medium text-brand-text-light">Real-time statistics & active container batches</p>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {/* Awaiting Receipt */}
                                <div className="group p-4 rounded-xl bg-card border border-border shadow-2xs transition-all hover:shadow-md hover:border-amber-500/30">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                                            <Clock className="size-4" />
                                        </div>
                                        <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">Live Status</span>
                                    </div>
                                    <h4 className="text-xs font-medium text-brand-text-mid">Awaiting Receipt</h4>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-3xl font-serif font-medium text-brand-text">{stats.pendingReceipt}</span>
                                        <span className="text-xs font-medium text-brand-text-light">Boxes</span>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-border">
                                        <div className="flex items-center gap-2">
                                            <div className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                                            <p className="text-xs font-medium text-brand-text-light italic">With pickers</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Needs Sorting */}
                                <div className="group p-4 rounded-xl bg-card border border-border shadow-2xs transition-all hover:shadow-md hover:border-emerald-500/30">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                            <ListFilter className="size-4" />
                                        </div>
                                    </div>
                                    <h4 className="text-xs font-medium text-brand-text-mid">Needs Sorting</h4>
                                    <div className="flex items-baseline gap-2 mt-1">
                                        <span className="text-3xl font-serif font-medium text-emerald-400">{stats.needsSorting}</span>
                                        <span className="text-xs font-medium text-brand-text-light">Boxes</span>
                                    </div>
                                </div>

                                {/* Aging Stats */}
                                <div className="group p-4 rounded-xl bg-card border border-border shadow-2xs transition-all hover:shadow-md hover:border-rose-500/30">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                                            <AlertCircle className="size-4" />
                                        </div>
                                        <span className="rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-xs font-semibold text-rose-400">Aging</span>
                                    </div>
                                    <h4 className="text-xs font-medium text-brand-text-mid">Warehouse Aging</h4>
                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-emerald-400">
                                            <p className="text-sm font-semibold">{stats.aging.under_24}</p>
                                            <p className="text-[9px] font-medium">Under 24h</p>
                                        </div>
                                        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-amber-400">
                                            <p className="text-sm font-semibold">{stats.aging['24_48']}</p>
                                            <p className="text-[9px] font-medium">24-48h</p>
                                        </div>
                                        <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-2 text-orange-400">
                                            <p className="text-sm font-semibold">{stats.aging['48_plus']}</p>
                                            <p className="text-[9px] font-medium">48h+</p>
                                        </div>
                                        <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-2 text-rose-400">
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
                                    <span className="text-xs font-medium text-brand-text-mid bg-brand-warm/20 border border-border px-2 py-1 rounded-md">
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
                                                    isSelected ? 'border-brand-rust bg-brand-warm/20 ring-2 ring-brand-rust/20 shadow-md' : 'border-border bg-card hover:border-brand-rust/30 hover:bg-brand-warm/10'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <p className="text-xs font-medium text-brand-text-light mb-0.5">Batch {batch.batch_number}</p>
                                                        <h5 className="text-base font-semibold text-brand-text">{batch.batch_number}</h5>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                                        batch.status === 'loading' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-brand-warm/20 text-brand-text-mid border-border'
                                                    }`}>
                                                        {humanize(batch.status)}
                                                    </span>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between text-xs font-medium">
                                                            <span className="text-brand-text-light">Box Capacity</span>
                                                            <span className="text-brand-text">{batch.current_box_count} / {batch.capacity_boxes}</span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-brand-warm/20 rounded-full overflow-hidden border border-border">
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
                                                            className="text-xs font-semibold text-brand-rust hover:text-brand-rust/80 flex items-center gap-1 transition-colors cursor-pointer"
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
            <Dialog open={showDamageModal} onOpenChange={(open) => {
                setShowDamageModal(open);
                if (!open) {
                    clearDamagePhoto();
                }
            }}>
                <DialogContent className="rounded-2xl p-6 border border-border bg-card text-brand-text shadow-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-xl font-medium text-brand-text">Report Damage: {selectedBox?.tracking_number}</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-brand-text-light">
                            Log package damage condition and attach photographic evidence for trace audit.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleMarkDamaged} className="space-y-5 mt-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="damage-notes" className="text-xs font-semibold text-brand-text-mid ml-1">Damage Description</Label>
                            <textarea
                                id="damage-notes"
                                className="w-full min-h-20 rounded-xl border border-border bg-card p-4 text-sm font-medium text-brand-text focus:border-brand-rust focus:ring-2 focus:ring-brand-rust/20 transition-all outline-none"
                                placeholder="e.g. Wet bottom, torn tape, crushed corner, punctured carton..."
                                value={damageForm.data.notes}
                                onChange={e => damageForm.setData('notes', e.target.value)}
                                required
                            />
                        </div>

                        {/* Photo Evidence Section */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-brand-text-mid ml-1 flex items-center justify-between">
                                <span>Damage Photo Evidence</span>
                                <span className="text-[10px] text-brand-text-light font-normal">Recommended</span>
                            </Label>

                            {damagePhotoPreview ? (
                                <div className="relative rounded-xl border border-border bg-brand-warm/10 p-2 overflow-hidden flex items-center gap-3">
                                    <img
                                        src={damagePhotoPreview}
                                        alt="Damage Preview"
                                        className="h-16 w-16 object-cover rounded-lg border border-border"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-brand-text truncate">
                                            {damageForm.data.damage_photo?.name || 'damage_snapshot.jpg'}
                                        </p>
                                        <p className="text-[10px] text-brand-text-light mt-0.5">
                                            {damageForm.data.damage_photo ? `${(damageForm.data.damage_photo.size / 1024).toFixed(1)} KB` : 'Ready to upload'}
                                        </p>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={clearDamagePhoto}
                                        className="size-8 p-0 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                                        title="Remove photo"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {/* 1-Click Viewfinder Capture Button */}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={captureViewfinderSnapshot}
                                        className="h-14 rounded-xl border-dashed border-brand-rust/40 bg-brand-rust/5 hover:bg-brand-rust/10 text-brand-rust flex flex-col items-center justify-center gap-1 cursor-pointer transition-all"
                                        title="Snap current frame from active QR scanner camera"
                                    >
                                        <Camera className="size-4" />
                                        <span className="text-[11px] font-bold">Snap Viewfinder</span>
                                    </Button>

                                    {/* File Picker / Native Camera */}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => damageFileInputRef.current?.click()}
                                        className="h-14 rounded-xl border border-border bg-card hover:bg-brand-warm/10 text-brand-text-mid flex flex-col items-center justify-center gap-1 cursor-pointer transition-all"
                                    >
                                        <Upload className="size-4 text-brand-text-light" />
                                        <span className="text-[11px] font-bold">Upload / Camera</span>
                                    </Button>

                                    <input
                                        type="file"
                                        ref={damageFileInputRef}
                                        onChange={handleDamageFileSelect}
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setShowDamageModal(false)} className="rounded-xl px-5 h-10 text-xs font-semibold text-brand-text-mid hover:text-brand-text hover:bg-brand-warm/20 cursor-pointer">Cancel</Button>
                            <Button type="submit" disabled={damageForm.processing} className="rounded-xl px-6 h-10 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer flex items-center gap-1.5">
                                {damageForm.processing && <Loader2 className="size-3.5 animate-spin" />}
                                Confirm Damage
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal for Placing Hold */}
            <Dialog open={showHoldModal} onOpenChange={setShowHoldModal}>
                <DialogContent className="rounded-2xl p-6 border border-border bg-card text-brand-text shadow-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-xl font-medium text-brand-text">Place Hold: {selectedBox?.tracking_number}</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-brand-text-light">
                            Specify the reason for holding this package at the warehouse.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleMarkHeld} className="space-y-6 mt-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="hold-notes" className="text-xs font-semibold text-brand-text-mid ml-1">Hold Reason</Label>
                            <textarea
                                id="hold-notes"
                                className="w-full min-h-[100px] rounded-xl border border-border bg-card p-4 text-sm font-medium text-brand-text focus:border-brand-rust focus:ring-2 focus:ring-brand-rust/20 transition-all outline-none"
                                placeholder="e.g. Waiting for other boxes, Payment pending..."
                                value={holdForm.data.notes}
                                onChange={e => holdForm.setData('notes', e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setShowHoldModal(false)} className="rounded-xl px-5 h-10 text-xs font-semibold text-brand-text-mid hover:text-brand-text hover:bg-brand-warm/20 cursor-pointer">Cancel</Button>
                            <Button type="submit" disabled={holdForm.processing} className="rounded-xl px-6 h-10 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer">Confirm Hold</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal for Physicals Update */}
            <Dialog open={showPhysicalsModal} onOpenChange={setShowPhysicalsModal}>
                <DialogContent className="rounded-2xl p-6 border border-border bg-card text-brand-text shadow-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-xl font-medium text-brand-text">Inventory Logistics: {selectedBox?.tracking_number}</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-brand-text-light">
                            Update box dimensions, weight, or shelf location within the hub.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdatePhysicals} className="space-y-6 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="weight" className="text-xs font-semibold text-brand-text-mid ml-1">Weight (kg)</Label>
                                <Input
                                    id="weight"
                                    type="number"
                                    step="0.01"
                                    className="h-10 rounded-xl border border-border bg-card px-3 font-medium text-sm text-brand-text focus-visible:ring-2 focus-visible:ring-ring"
                                    value={physicalsForm.data.weight}
                                    onChange={e => physicalsForm.setData('weight', e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="actual_cbm" className="text-xs font-semibold text-brand-text-mid ml-1">Actual CBM (m³)</Label>
                                <Input
                                    id="actual_cbm"
                                    type="number"
                                    step="0.0001"
                                    className="h-10 rounded-xl border border-border bg-card px-3 font-medium text-sm text-brand-text focus-visible:ring-2 focus-visible:ring-ring"
                                    value={physicalsForm.data.actual_cbm}
                                    onChange={e => physicalsForm.setData('actual_cbm', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="loc" className="text-xs font-semibold text-brand-text-mid ml-1">Shelf / Bin Location</Label>
                            <div className="relative group">
                                <Anchor className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-brand-text-light group-focus-within:text-brand-rust transition-colors" />
                                <Input
                                    id="loc"
                                    placeholder="e.g. Bin-12, Row-A"
                                    className="h-10 rounded-xl border border-border bg-card pl-9 pr-4 font-medium text-sm text-brand-text focus-visible:ring-2 focus-visible:ring-ring transition-all"
                                    value={physicalsForm.data.warehouse_location}
                                    onChange={e => physicalsForm.setData('warehouse_location', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setShowPhysicalsModal(false)} className="rounded-xl px-5 h-10 text-xs font-semibold text-brand-text-mid hover:text-brand-text hover:bg-brand-warm/20 cursor-pointer">Cancel</Button>
                            <Button type="submit" disabled={physicalsForm.processing} className="rounded-xl px-8 h-10 text-xs font-semibold bg-brand-rust text-white hover:bg-brand-rust/90 transition-all active:scale-95 cursor-pointer">Update Logistics</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal for Payment Override */}
            <Dialog open={showPaymentOverrideModal} onOpenChange={setShowPaymentOverrideModal}>
                <DialogContent className="rounded-2xl p-6 border border-border bg-card text-brand-text shadow-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-xl font-medium text-brand-text">Payment Unconfirmed</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-brand-text-light">
                            {paymentOverrideData?.message}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={() => setShowPaymentOverrideModal(false)} className="rounded-xl px-5 h-10 text-xs font-semibold text-brand-text-mid hover:text-brand-text hover:bg-brand-warm/20 cursor-pointer">Cancel</Button>
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
                            className="rounded-xl px-8 h-10 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all active:scale-95 cursor-pointer"
                        >
                            Override & Receive
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Modal for Batch Details */}
            <Dialog open={showBatchDetailsModal} onOpenChange={setShowBatchDetailsModal}>
                <DialogContent className="rounded-2xl p-0 border border-border bg-card text-brand-text shadow-2xl max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
                    <DialogHeader className="px-6 py-5 border-b border-border bg-brand-warm/10 shrink-0">
                        <DialogTitle className="font-serif text-xl font-medium text-brand-text flex items-center gap-2">
                            <Truck className="size-5 text-brand-rust" />
                            Batch Details: {batchDetails?.batch_number}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-brand-text-light flex gap-4 mt-2">
                            <span className="flex items-center gap-1.5 bg-card px-2.5 py-1 rounded-full border border-border shadow-2xs">
                                <Box className="size-3.5 text-brand-text-mid" />
                                <span className="text-brand-text font-semibold">{batchDetails?.boxes?.length || 0} / {batchDetails?.capacity_boxes || 0}</span> Boxes
                            </span>
                            <span className="flex items-center gap-1.5 bg-card px-2.5 py-1 rounded-full border border-border shadow-2xs">
                                <Ruler className="size-3.5 text-brand-text-mid" />
                                <span className="text-brand-text font-semibold">{batchDetails?.current_cbm || 0} / {batchDetails?.capacity_cbm || 0}</span> CBM
                            </span>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                batchDetails?.status === 'loading' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-brand-warm/20 text-brand-text-mid border-border'
                            }`}>
                                {humanize(batchDetails?.status || '')}
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="overflow-y-auto flex-1 p-0">
                        {isLoadingBatchDetails ? (
                            <div className="flex flex-col items-center justify-center h-48 gap-3">
                                <Loader2 className="size-6 animate-spin text-brand-rust" />
                                <span className="text-sm font-medium text-brand-text-light">Loading contents...</span>
                            </div>
                        ) : batchDetails?.boxes && batchDetails.boxes.length > 0 ? (
                            <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 bg-card shadow-2xs border-b border-border">
                                    <tr>
                                        <th className="px-6 py-3 text-xs font-medium text-brand-text-mid">Tracking Number</th>
                                        <th className="px-6 py-3 text-xs font-medium text-brand-text-mid">Type</th>
                                        <th className="px-6 py-3 text-xs font-medium text-brand-text-mid">Booking Ref</th>
                                        <th className="px-6 py-3 text-xs font-medium text-brand-text-mid">Destination</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {batchDetails.boxes.map((box: any) => (
                                        <tr key={box.id} className="hover:bg-brand-warm/10 transition-colors">
                                            <td className="px-6 py-3 font-mono font-medium text-brand-text">{box.tracking_number}</td>
                                            <td className="px-6 py-3 text-brand-text text-xs">{box.box_type?.name || 'Custom'}</td>
                                            <td className="px-6 py-3 font-mono text-brand-text-light text-xs">{box.booking?.reference_number}</td>
                                            <td className="px-6 py-3 text-xs text-brand-text">
                                                {box.recipient?.city}, {box.recipient?.province}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 text-brand-text-light text-sm font-medium">
                                <Truck className="size-8 text-brand-text-light/40 mb-2" />
                                No boxes loaded in this batch.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal for Keyboard Shortcuts Guide */}
            <Dialog open={showShortcutsModal} onOpenChange={setShowShortcutsModal}>
                <DialogContent className="rounded-2xl p-6 border border-border bg-card text-brand-text shadow-2xl max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-serif text-xl font-medium text-brand-text flex items-center gap-2">
                            <span>⚡ Warehouse Quick Keys</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-brand-text-light">
                            Speed up high-volume floor operations with standard single-key shortcuts.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 mt-4">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-brand-warm/20 border border-border text-xs">
                            <span className="font-medium text-brand-text">Focus Tracking Input</span>
                            <kbd className="px-2 py-1 rounded bg-card border border-border font-mono font-bold text-[11px] shadow-xs">Space</kbd>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-brand-warm/20 border border-border text-xs">
                            <span className="font-medium text-brand-text">Switch to Receive Mode</span>
                            <kbd className="px-2 py-1 rounded bg-card border border-border font-mono font-bold text-[11px] shadow-xs">R</kbd>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-brand-warm/20 border border-border text-xs">
                            <span className="font-medium text-brand-text">Switch to Load Mode</span>
                            <kbd className="px-2 py-1 rounded bg-card border border-border font-mono font-bold text-[11px] shadow-xs">L</kbd>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-brand-warm/20 border border-border text-xs">
                            <span className="font-medium text-brand-text">Switch to Unload Mode</span>
                            <kbd className="px-2 py-1 rounded bg-card border border-border font-mono font-bold text-[11px] shadow-xs">U</kbd>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-brand-warm/20 border border-border text-xs">
                            <span className="font-medium text-brand-text">Open / Close Help</span>
                            <kbd className="px-2 py-1 rounded bg-card border border-border font-mono font-bold text-[11px] shadow-xs">?</kbd>
                        </div>
                    </div>

                    <div className="flex justify-end pt-3">
                        <Button type="button" onClick={() => setShowShortcutsModal(false)} className="rounded-xl px-5 h-9 text-xs font-bold bg-brand-primary text-white cursor-pointer">
                            Got it
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </AppLayout>
    );
}
