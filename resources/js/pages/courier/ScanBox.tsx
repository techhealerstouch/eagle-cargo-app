import { Head, router, usePage } from '@inertiajs/react';
import { Html5Qrcode } from 'html5-qrcode';
import { AlertCircle, Camera, CheckCircle2, ChevronDown, History, Loader2, QrCode, ShieldAlert, X, PlayCircle, ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Courier Dashboard', href: '/courier/dashboard' },
    { title: 'Scan Box', href: '/courier/scan' },
];

interface RecentScan {
    trackingNumber: string;
    timeLabel: string;
}

export default function ScanBox() {
    const { errors } = usePage().props as any;
    const [manualTracking, setManualTracking] = useState('');
    const [isScanning, setIsScanning] = useState(true);
    const [scannerCollapsed, setScannerCollapsed] = useState(false);
    const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
    const [selectedCamera, setSelectedCamera] = useState<string>('');
    const [scanError, setScanError] = useState('');
    const [lastScanStatus, setLastScanStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [lastScanMessage, setLastScanMessage] = useState('');
    const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

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
        } catch { /* Silent fail */ }
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
        }, 2000);
    }, [emitFeedbackSignal]);

    const addRecentScan = useCallback((trackingNumber: string) => {
        const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setRecentScans((prev) => [{ trackingNumber, timeLabel }, ...prev].slice(0, 5));
    }, []);

    const submitScan = useCallback((trackingNumber: string) => {
        const normalized = trackingNumber.trim().toUpperCase();

        if (!normalized || isProcessing) {
return;
}

        setIsProcessing(true);
        setScanError('');

        router.post('/courier/scan', { tracking_number: normalized }, {
            preserveScroll: true,
            onSuccess: () => {
                triggerFeedback('success', `Scanned ${normalized}`);
                addRecentScan(normalized);
                setManualTracking('');
                setIsProcessing(false);
            },
            onError: (err) => {
                const msg = err.tracking_number || Object.values(err)[0] || 'Scan failed';
                triggerFeedback('error', msg as string);
                setScanError(msg as string);
                setIsProcessing(false);
                toast.error(msg as string);
                inputRef.current?.focus();
            },
            onFinish: () => setIsProcessing(false)
        });
    }, [isProcessing, triggerFeedback, addRecentScan]);

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

    const startScanInternal = useCallback((cameraId: string) => {
        void queueScannerTask(async () => {
            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode('courier-reader');
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

                    if (now - cameraDecodeLockRef.current < 1500) {
return;
}

                    cameraDecodeLockRef.current = now;
                    submitScan(decodedText);
                },
                () => {}
            );
        }).catch(() => setScanError('Unable to start camera scanner.'));
    }, [queueScannerTask, submitScan]);

    const startScanner = useCallback((cameraId: string) => {
        setScanError('');
        startScanInternal(cameraId);
    }, [startScanInternal]);

    useEffect(() => {
        let cancelled = false;

        if (isScanning && !scannerCollapsed) {
            Html5Qrcode.getCameras().then((devices) => {
                if (cancelled || !devices.length) {
return;
}

                setCameras(devices);
                let camId = selectedCameraRef.current || devices[0].id;
                const backCam = devices.find(d => d.label.toLowerCase().includes('back'));

                if (backCam && !selectedCameraRef.current) {
camId = backCam.id;
}

                setSelectedCamera(camId);
                selectedCameraRef.current = camId;
                startScanner(camId);
            }).catch(() => setScanError('Could not access camera.'));
        } else {
            void stopScanner();
        }

        return () => {
 cancelled = true; void stopScanner(); 
};
    }, [isScanning, scannerCollapsed, startScanner, stopScanner]);

    const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const camId = e.target.value;
        setSelectedCamera(camId);
        selectedCameraRef.current = camId;
        startScanner(camId);
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        submitScan(manualTracking);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Courier Scanner | Command Center" />

            <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-brand-warm/10">
                {/* Left Sidebar: Delivery Vitals */}
                <aside className="hidden lg:flex w-[380px] flex-col bg-white border-r border-brand-sand/40 overflow-y-auto custom-scrollbar shadow-xl z-20">
                    <div className="p-8 space-y-10">
                        {/* Heading */}
                        <div className="space-y-1">
                            <h2 className="font-serif text-2xl font-bold text-brand-text">Command Center</h2>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Logistics • Delivery Hub</p>
                        </div>

                        {/* Recent Scan History */}
                        <div className="space-y-6">
                            <div className="flex items-center gap-2">
                                <History className="size-4 text-brand-text/40" />
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-brand-text">Recent Activity</h3>
                            </div>
                            <div className="space-y-3">
                                {recentScans.map((scan, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-brand-warm/30 border border-brand-sand/40 animate-in fade-in slide-in-from-left-2">
                                        <div className="size-8 rounded-lg flex items-center justify-center bg-brand-secondary/20 text-brand-secondary">
                                            <QrCode className="size-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-mono text-[11px] font-black text-brand-text truncate uppercase">{scan.trackingNumber}</p>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{scan.timeLabel} • Scanned</p>
                                        </div>
                                    </div>
                                ))}
                                {recentScans.length === 0 && (
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest text-center py-4 opacity-50 italic">No activity yet</p>
                                )}
                            </div>
                        </div>

                        {/* Delivery Tips */}
                        <div className="p-6 rounded-[2rem] bg-brand-navy text-white space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/60">Pro Tip</h4>
                            <p className="text-xs font-bold leading-relaxed">
                                Use the <span className="text-brand-secondary">Live Camera</span> for faster processing. Manual entry is a fallback for damaged labels.
                            </p>
                            <div className="pt-2">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[9px] font-black uppercase tracking-widest">
                                    <CheckCircle2 className="size-3" /> 
                                    Real-time Sync
                                </div>
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
                                lastScanStatus === 'success' ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.8)]' : 'bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.8)]'
                            }`} />
                        </div>
                    )}

                    {/* Fixed Toolbar */}
                    <div className="flex items-center justify-between px-10 py-6 bg-white border-b border-brand-sand/40 shadow-sm z-10">
                        <div className="flex flex-col">
                            <h3 className="font-serif text-xl font-bold text-brand-text">Operations Hub</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`size-2 rounded-full ${isScanning ? 'bg-emerald-500 animate-pulse' : 'bg-muted'}`} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    Courier Scanner • {isScanning ? 'Live' : 'Paused'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 space-y-12">
                        <section className="max-w-4xl mx-auto w-full">
                            <div className={`group relative p-8 rounded-[3rem] border-2 transition-all duration-500 bg-white shadow-2xl overflow-hidden ${
                                lastScanStatus === 'success' ? 'border-emerald-500 ring-8 ring-emerald-500/5' : 
                                lastScanStatus === 'error' ? 'border-red-500 ring-8 ring-red-500/5' : 
                                'border-brand-secondary ring-8 ring-brand-secondary/5'
                            }`}>
                                {/* Decorative backdrop */}
                                <div className="absolute -bottom-10 -right-10 text-[180px] font-black text-brand-text/[0.03] italic font-serif pointer-events-none uppercase">
                                    SCAN
                                </div>

                                <div className="relative flex flex-col xl:flex-row gap-10 items-start">
                                    {/* Scanner Portal */}
                                    <div className="w-full xl:w-[320px] shrink-0 space-y-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-brand-text">
                                                <Camera className="size-4 text-brand-secondary" />
                                                Live Viewfinder
                                            </div>
                                            <button 
                                                onClick={() => setScannerCollapsed(!scannerCollapsed)}
                                                className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-brand-text"
                                            >
                                                {scannerCollapsed ? '[ Expand ]' : '[ Collapse ]'}
                                            </button>
                                        </div>

                                        {!scannerCollapsed ? (
                                            <div className="relative aspect-square w-full rounded-[2rem] border-4 border-brand-text bg-black overflow-hidden shadow-2xl shadow-brand-text/20">
                                                <div id="courier-reader" className="w-full h-full [&_video]:object-cover" />
                                                <div className="absolute inset-0 border-[20px] border-black/40 pointer-events-none">
                                                    <div className="w-full h-full border border-white/20 rounded-xl" />
                                                </div>
                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-brand-secondary/50 rounded-2xl animate-pulse" />
                                            </div>
                                        ) : (
                                            <div className="aspect-square w-full rounded-[2rem] bg-brand-warm/50 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-brand-sand italic">
                                                <QrCode className="size-12 mb-3 opacity-20" />
                                                <p className="text-[10px] uppercase font-black tracking-widest opacity-60 text-center px-8">Camera paused. <br/>Manual entry active.</p>
                                            </div>
                                        )}
                                        
                                        {cameras.length > 1 && !scannerCollapsed && (
                                            <select 
                                                className="w-full h-10 rounded-xl border-brand-sand bg-brand-warm/20 text-[10px] font-black uppercase tracking-widest px-4 appearance-none cursor-pointer hover:bg-brand-warm transition-all"
                                                value={selectedCamera}
                                                onChange={handleCameraChange}
                                            >
                                                {cameras.map(c => <option key={c.id} value={c.id}>{c.label || `Camera ${c.id}`}</option>)}
                                            </select>
                                        )}
                                    </div>

                                    {/* Action Form */}
                                    <div className="flex-1 w-full space-y-8">
                                        <div className="space-y-2">
                                            <h4 className="font-serif text-3xl font-bold text-brand-text tracking-tight">
                                                Scan Delivery Box
                                            </h4>
                                            <p className="text-sm font-bold text-muted-foreground">
                                                Scan a box QR code to update its delivery status in real-time.
                                            </p>
                                        </div>

                                        <form onSubmit={handleManualSubmit} className="space-y-6">
                                            {/* Tracking Input */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Box Serial Entry</label>
                                                    {lastScanStatus !== 'idle' && (
                                                        <div className={`flex items-center gap-1 text-[11px] font-black uppercase tracking-widest ${lastScanStatus === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
                                                            {lastScanStatus === 'success' ? <CheckCircle2 className="size-3" /> : <ShieldAlert className="size-3" />}
                                                            {lastScanStatus}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="relative group">
                                                    <input
                                                        ref={inputRef}
                                                        type="text"
                                                        placeholder="LBB-2026-000001"
                                                        value={manualTracking}
                                                        onChange={(e) => setManualTracking(e.target.value.toUpperCase())}
                                                        className={`w-full rounded-[2rem] border-2 p-6 pr-20 text-3xl font-black shadow-inner transition-all focus:ring-8 ${
                                                            lastScanStatus === 'success' ? 'border-emerald-400 bg-emerald-50 text-emerald-900 focus:ring-emerald-500/10' :
                                                            lastScanStatus === 'error' ? 'border-red-400 bg-red-50 text-red-900 focus:ring-red-500/10' :
                                                            'border-brand-sand bg-brand-warm/5 text-brand-text focus:border-brand-secondary focus:ring-brand-secondary/10'
                                                        }`}
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={isProcessing || !manualTracking.trim()}
                                                        className={`absolute right-4 top-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-xl transition-all active:scale-90 disabled:opacity-30 ${
                                                            lastScanStatus === 'success' ? 'bg-emerald-500 text-white' :
                                                            lastScanStatus === 'error' ? 'bg-red-500 text-white' :
                                                            'bg-brand-navy text-white'
                                                        }`}
                                                    >
                                                        {isProcessing ? <Loader2 className="animate-spin" /> : <ArrowRight className="size-8" strokeWidth={3} />}
                                                    </button>
                                                </div>
                                                {lastScanMessage && (
                                                    <p className={`text-center text-[10px] font-black uppercase tracking-widest ${lastScanStatus === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {lastScanMessage}
                                                    </p>
                                                )}
                                            </div>
                                        </form>

                                        {/* Status Info */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-5 rounded-2xl bg-brand-warm/30 border border-brand-sand/40">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Status Sync</p>
                                                <p className="text-sm font-black text-brand-text">Instant Update</p>
                                            </div>
                                            <div className="p-5 rounded-2xl bg-brand-warm/30 border border-brand-sand/40">
                                                <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Validation</p>
                                                <p className="text-sm font-black text-brand-text">Serial / Tracking</p>
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
