import type { PageProps } from '@inertiajs/core';
import { Link, usePage } from '@inertiajs/react';
import { LogIn, UserPlus } from 'lucide-react';
import AppLogo from '@/components/layout/app-logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Auth } from '@/types';

export default function MarketingLayout({
    children,
    hideLogin = false,
}: {
    children: React.ReactNode;
    hideLogin?: boolean;
    breadcrumbs?: any;
}) {
    const { auth, settings } = usePage<PageProps & { auth?: Auth; settings?: any }>().props;
    const { url } = usePage();
    const isGuest = !auth?.user;
    const appName = settings?.appName || 'Love Balikbayan Box';

    const isLoginPage = url?.startsWith('/login');
    const isRegisterPage = url?.startsWith('/register');
    const isBookActive = url?.startsWith('/guest/book');
    const isTrackActive = url?.startsWith('/track');

    return (
        <div className="flex min-h-screen flex-col bg-background">
            {/* Top Navigation */}
            <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
                    <div className="flex items-center gap-2">
                        <Link href="/" className="flex items-center gap-2">
                            <AppLogo />
                        </Link>
                    </div>

                    {/* Navigation Links */}
                    <nav className="hidden items-center gap-6 md:flex">
                        <Link
                            href="/guest/book"
                            className={cn(
                                'text-xs font-bold uppercase tracking-wider transition-colors',
                                isBookActive
                                    ? 'text-brand-rust'
                                    : 'text-zinc-600 hover:text-brand-rust',
                            )}
                        >
                            Book Pickup
                        </Link>
                        <Link
                            href="/track"
                            className={cn(
                                'text-xs font-bold uppercase tracking-wider transition-colors',
                                isTrackActive
                                    ? 'text-brand-rust'
                                    : 'text-zinc-600 hover:text-brand-rust',
                            )}
                        >
                            Track Box
                        </Link>
                    </nav>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <Button asChild size="sm" className="hidden sm:inline-flex rounded-xl bg-brand-rust font-bold text-white hover:bg-brand-rust/90 shadow-xs text-xs">
                            <Link href="/guest/book">Book as Guest</Link>
                        </Button>
                        {isGuest && (
                            isLoginPage ? (
                                <Button asChild variant="outline" className="rounded-xl border-zinc-200 text-xs font-bold uppercase tracking-wider hover:bg-zinc-50 hover:text-zinc-900 transition-all active:scale-95">
                                    <Link href="/register" className="flex items-center gap-2">
                                        <UserPlus className="size-3.5" />
                                        Register
                                    </Link>
                                </Button>
                            ) : isRegisterPage ? (
                                <Button asChild variant="outline" className="rounded-xl border-zinc-200 text-xs font-bold uppercase tracking-wider hover:bg-zinc-50 hover:text-zinc-900 transition-all active:scale-95">
                                    <Link href="/login" className="flex items-center gap-2">
                                        <LogIn className="size-3.5" />
                                        Log In
                                    </Link>
                                </Button>
                            ) : !hideLogin ? (
                                <Button asChild variant="outline" className="rounded-xl border-zinc-200 text-xs font-bold uppercase tracking-wider hover:bg-zinc-50 hover:text-zinc-900 transition-all active:scale-95">
                                    <Link href="/login" className="flex items-center gap-2">
                                        <LogIn className="size-3.5" />
                                        Log In / Register
                                    </Link>
                                </Button>
                            ) : null
                        )}
                        {!isGuest && (
                            <Button asChild variant="outline" className="rounded-xl border-zinc-200 text-xs font-bold uppercase tracking-widest hover:bg-zinc-50 hover:text-zinc-900 transition-all active:scale-95">
                                <Link href="/dashboard">Dashboard</Link>
                            </Button>
                        )}
                    </div>
                </div>
            </header>

            <main className="relative flex flex-1 flex-col overflow-y-auto noise-texture">
                {/* Dot grid — consistent with app layout */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-0 dot-grid"
                />

                <div className="relative z-10 w-full">
                    {children}
                </div>

                {/* Simple Footer */}
                <footer className="relative z-10 mt-auto border-t border-border bg-white/50 py-8">
                    <div className="container mx-auto max-w-7xl px-4 md:px-8">
                        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                &copy; {new Date().getFullYear()} {appName}. All rights reserved.
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-6">
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest cursor-pointer hover:text-zinc-600 transition-colors">Privacy Policy</span>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest cursor-pointer hover:text-zinc-600 transition-colors">Terms of Service</span>
                            </div>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
