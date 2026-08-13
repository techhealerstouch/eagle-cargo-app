import { Link, usePage } from '@inertiajs/react';
import { Facebook, Instagram, Twitter } from 'lucide-react';
import AppLogo from '@/components/layout/app-logo';

export function Footer() {
    const { settings } = usePage().props as any;
    const appName = settings?.appName || 'Love Balikbayan Box';

    return (
        <footer className="border-t border-brand-navy-light bg-brand-navy pt-20 pb-10 text-white">
            <div className="container-default px-4 sm:px-6 lg:px-8">
                <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-4">
                    <div className="space-y-6">
                        <Link
                            href="/home"
                            className="group flex inline-block items-center gap-2"
                        >
                            <div className="opacity-90 brightness-0 invert transition group-hover:opacity-100">
                                <AppLogo />
                            </div>
                        </Link>
                        <p className="text-sm leading-relaxed text-zinc-400">
                            Delivering love inside every box. The most reliable
box cargo service connecting families with
                            care since 2026.
                        </p>
                        <div className="flex gap-4">
                            <a
                                href="#"
                                className="rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-zinc-400 transition hover:border-brand-primary hover:text-brand-primary"
                            >
                                <Facebook className="size-4" />
                            </a>
                            <a
                                href="#"
                                className="rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-zinc-400 transition hover:border-brand-primary hover:text-brand-primary"
                            >
                                <Instagram className="size-4" />
                            </a>
                            <a
                                href="#"
                                className="rounded-lg border border-zinc-700 bg-zinc-800 p-2 text-zinc-400 transition hover:border-brand-primary hover:text-brand-primary"
                            >
                                <Twitter className="size-4" />
                            </a>
                        </div>
                    </div>

                    <div>
                        <h4 className="mb-6 font-serif text-lg font-semibold text-brand-secondary">
                            Services
                        </h4>
                        <ul className="space-y-4 text-sm text-zinc-400">
                            <li>
                                <Link
                                    href="/services"
                                    className="transition hover:text-brand-primary"
                                >
Box Tracker
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/book"
                                    className="transition hover:text-brand-primary"
                                >
                                    Schedule a Pickup
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/track"
                                    className="transition hover:text-brand-primary"
                                >
                                    Track your Box
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/faq"
                                    className="transition hover:text-brand-primary"
                                >
                                    Prohibited Items
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="mb-6 font-serif text-lg font-semibold text-brand-secondary">
                            Company
                        </h4>
                        <ul className="space-y-4 text-sm text-zinc-400">
                            <li>
                                <Link
                                    href="/about"
                                    className="transition hover:text-brand-primary"
                                >
                                    About Us
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/our-story"
                                    className="transition hover:text-brand-primary"
                                >
                                    Community Story
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/contact"
                                    className="transition hover:text-brand-primary"
                                >
                                    Contact Support
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="mb-6 font-serif text-lg font-semibold text-brand-secondary">
                            Legal
                        </h4>
                        <ul className="space-y-4 text-sm text-zinc-400">
                            <li>
                                <Link
                                    href="/terms"
                                    className="transition hover:text-brand-primary"
                                >
                                    Terms of Service
                                </Link>
                            </li>
                            <li>
                                <Link
                                    href="/privacy"
                                    className="transition hover:text-brand-primary"
                                >
                                    Privacy Policy
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-between border-t border-brand-navy-light pt-8 text-xs text-zinc-500 md:flex-row">
                    <p>
                        &copy; {new Date().getFullYear()} {appName}. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    );
}





