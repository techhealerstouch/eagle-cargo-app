import { useEffect, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    Activity,
    ChevronDown,
    ClipboardList,
    Eye,
    EyeOff,
    FlaskConical,
    Inbox,
    LogOut,
    Maximize2,
    Minimize2,
    Package,
    Shield,
    ShieldAlert,
    Terminal,
    Truck,
    Users,
    Warehouse,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Auth } from '@/types';

interface PagePropsWithAuth {
    auth: Auth;
    [key: string]: unknown;
}

const personas = [
    {
        role: 'sender',
        label: 'Sender',
        subtitle: 'Booking flow, tracking & invoices',
        icon: Package,
    },
    {
        role: 'recipient',
        label: 'Recipient',
        subtitle: 'Track incoming boxes & deliveries',
        icon: Inbox,
    },
    {
        role: 'picker',
        label: 'Picker',
        subtitle: 'Collection runsheets & signatures',
        icon: ClipboardList,
    },
    {
        role: 'warehouse',
        label: 'Warehouse',
        subtitle: 'Intake, damage photos & container batches',
        icon: Warehouse,
    },
    {
        role: 'courier',
        label: 'Courier / Driver',
        subtitle: 'Delivery runsheets & proof of delivery',
        icon: Truck,
    },
    {
        role: 'admin',
        label: 'Admin',
        subtitle: 'Operations & dispatch control',
        icon: Shield,
    },
    {
        role: 'super_admin',
        label: 'Super Admin',
        subtitle: 'Full administrative & financial access',
        icon: ShieldAlert,
    },
];

export function DeveloperDock() {
    const { auth } = usePage<PagePropsWithAuth>().props;
    const isDeveloperMode = Boolean(auth?.can?.developerMode);
    const isImpersonating = Boolean(auth?.impersonator_id);
    const previewActive = auth?.can?.developerPreview !== false;

    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('dev_dock_collapsed');
        if (stored !== null) {
            setIsCollapsed(stored === 'true');
        }
    }, []);

    const toggleCollapsed = () => {
        setIsCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem('dev_dock_collapsed', String(next));
            return next;
        });
    };

    if (!isDeveloperMode && !isImpersonating) {
        return null;
    }

    const currentRole = auth.user?.role;
    const currentPersona = personas.find((p) => p.role === currentRole);

    const switchPersona = (role: string) => {
        router.visit(`/developer/persona/${role}`);
    };

    const togglePreview = () => {
        router.post('/developer/toggle-preview', {}, { preserveScroll: true });
    };

    // Compact floating pill when collapsed
    if (isCollapsed) {
        return (
            <aside
                aria-label="Developer mode controls"
                className="fixed top-3.5 right-14 z-50 flex items-center gap-2 rounded-full border border-amber-500/40 bg-zinc-950/90 px-3 py-1.5 text-xs text-zinc-100 shadow-xl backdrop-blur-md transition-all hover:border-amber-400"
            >
                <span className="flex size-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-mono text-[11px] font-bold tracking-wider text-amber-400 uppercase">Dev</span>
                {isImpersonating ? (
                    <span className="max-w-[120px] truncate rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                        {currentPersona?.label ?? currentRole}
                    </span>
                ) : (
                    <span className="text-[11px] text-zinc-400">Developer</span>
                )}
                <button
                    type="button"
                    onClick={toggleCollapsed}
                    className="ml-1 rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    title="Expand Developer Dock"
                >
                    <Maximize2 className="size-3" />
                </button>
            </aside>
        );
    }

    return (
        <header
            aria-label="Developer dock"
            className="relative z-40 border-b border-amber-600/40 bg-zinc-950 px-4 py-2 text-xs text-zinc-200 shadow-sm md:px-6"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Left side: Environment & Current Persona State */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold tracking-wider text-amber-400 uppercase">
                        <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span>Dev Mode</span>
                    </div>

                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-400 uppercase">
                        Local
                    </span>

                    {isImpersonating ? (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/40 px-2.5 py-1 text-zinc-200">
                            <span className="text-[11px] text-zinc-400">Viewing as:</span>
                            <span className="font-semibold text-amber-300">
                                {currentPersona?.label ?? currentRole}
                            </span>
                            <span className="text-zinc-500">({auth.user?.name})</span>
                            <a
                                href="/stop-impersonating"
                                className="ml-1.5 inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/30 transition-colors uppercase"
                            >
                                <LogOut className="size-3" />
                                <span>Exit</span>
                            </a>
                        </div>
                    ) : (
                        <span className="text-[11px] text-zinc-400">
                            Logged in as: <strong className="text-zinc-200">{auth.user?.name}</strong> (Developer)
                        </span>
                    )}
                </div>

                {/* Center / Right Controls: Persona Switcher, Preview Toggle, Links & Collapse */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Persona Switcher Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1.5 border-zinc-700 bg-zinc-900 px-2.5 text-xs text-zinc-200 hover:border-amber-500/50 hover:bg-zinc-800 hover:text-amber-300"
                            >
                                <Users className="size-3.5 text-amber-400" />
                                <span>Switch Persona</span>
                                <ChevronDown className="size-3 opacity-60" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 border-zinc-800 bg-zinc-950 p-1.5 text-zinc-200 shadow-2xl">
                            <DropdownMenuLabel className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                Operational Personas
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-zinc-800/80" />
                            {personas.map((persona) => {
                                const IconComponent = persona.icon;
                                const isCurrent = currentRole === persona.role;
                                return (
                                    <DropdownMenuItem
                                        key={persona.role}
                                        onClick={() => switchPersona(persona.role)}
                                        className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
                                            isCurrent
                                                ? 'bg-amber-500/15 text-amber-300 font-semibold'
                                                : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                                        }`}
                                    >
                                        <div className="flex size-6 items-center justify-center rounded bg-zinc-900 text-amber-400">
                                            <IconComponent className="size-3.5" />
                                        </div>
                                        <div className="flex flex-col flex-1 leading-tight">
                                            <span className="flex items-center justify-between">
                                                <span>{persona.label}</span>
                                                {isCurrent && <span className="text-[9px] uppercase tracking-wider text-amber-400">Active</span>}
                                            </span>
                                            <span className="text-[10px] text-zinc-400">{persona.subtitle}</span>
                                        </div>
                                    </DropdownMenuItem>
                                );
                            })}
                            {isImpersonating && (
                                <>
                                    <DropdownMenuSeparator className="bg-zinc-800/80" />
                                    <DropdownMenuItem asChild className="cursor-pointer text-amber-300 focus:bg-amber-500/20">
                                        <a href="/stop-impersonating" className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold">
                                            <LogOut className="size-3.5" />
                                            <span>Restore Developer Account</span>
                                        </a>
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Developer Feature Preview Toggle */}
                    <button
                        type="button"
                        onClick={togglePreview}
                        title={
                            previewActive
                                ? 'Previewing unreleased features. Click to mask hidden features and test baseline customer experience.'
                                : 'Previewing baseline customer experience. Click to enable unreleased feature preview.'
                        }
                        className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-all ${
                            previewActive
                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300'
                        }`}
                    >
                        {previewActive ? (
                            <>
                                <Eye className="size-3.5 text-emerald-400" />
                                <span>Preview: ON</span>
                            </>
                        ) : (
                            <>
                                <EyeOff className="size-3.5 text-zinc-400" />
                                <span>Preview: MASKED</span>
                            </>
                        )}
                    </button>

                    {/* Quick Dev Links */}
                    <div className="hidden items-center gap-1 border-l border-zinc-800 pl-2 sm:flex">
                        <Link
                            href="/developer/features"
                            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-amber-400 transition-colors"
                        >
                            <FlaskConical className="size-3.5" />
                            <span>Features</span>
                        </Link>
                        <a
                            href="/pulse"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-amber-400 transition-colors"
                            title="Open Laravel Pulse in new tab"
                        >
                            <Activity className="size-3.5" />
                            <span>Pulse</span>
                        </a>
                        <a
                            href="/telescope"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-zinc-300 hover:bg-zinc-900 hover:text-amber-400 transition-colors"
                            title="Open Laravel Telescope in new tab"
                        >
                            <Terminal className="size-3.5" />
                            <span>Telescope</span>
                        </a>
                    </div>

                    {/* Minimize / Collapse Dock */}
                    <button
                        type="button"
                        onClick={toggleCollapsed}
                        className="ml-1 inline-flex size-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
                        title="Minimize Developer Dock"
                    >
                        <Minimize2 className="size-3.5" />
                    </button>
                </div>
            </div>
        </header>
    );
}
