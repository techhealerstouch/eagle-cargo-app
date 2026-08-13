import { Head, Link } from '@inertiajs/react';
import {
    Package,
    Truck,
    HeartHandshake,
    ShieldCheck,
    ArrowRight,
    ArrowRightCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

export default function Home() {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Home', href: '/dashboard' },
        { title: 'Welcome', href: '/home' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
<Head title="Home | Box Tracker" />

            {/* Hero Section */}
            <section className="relative flex min-h-[85vh] w-full items-center justify-center overflow-hidden border-b border-brand-sand bg-brand-cream">
                {/* Decorative Background Items */}
                <div className="absolute top-20 -left-64 h-96 w-96 animate-float rounded-full bg-brand-primary/10 blur-3xl" />
                <div
                    className="absolute -right-48 bottom-20 h-96 w-96 animate-float rounded-full bg-brand-secondary/10 blur-3xl animation-delay-1s"
                />

                <div className="container-default section-padding relative z-10 grid grid-cols-1 items-center gap-16 lg:grid-cols-2 lg:gap-8">
                    <div className="mx-auto max-w-xl animate-fade-in text-center lg:mx-0 lg:text-left">
                        <span className="eyebrow mb-6 inline-block">
Box Tracker
                        </span>
                        <h1 className="text-display-md lg:text-display-lg mb-8 leading-tight lg:-ml-1">
                            Delivering love inside every box.
                        </h1>
                        <p className="mx-auto mb-10 max-w-md font-sans text-lg leading-relaxed text-brand-text-mid lg:mx-0 lg:text-xl">
                            The most reliable, heartfelt cargo service
                            connecting Filipinos across the oceans. We treat
                            every package like it's our own.
                        </p>

                        <div className="flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
                            <Button asChild variant="brand" size="lg" className="h-12 px-8">
                                <Link href="/book" prefetch>Book a Box</Link>
                            </Button>
                            <Button asChild variant="brand-outline" size="lg" className="h-12 px-8">
                                <Link href="/track" prefetch>Track your Box</Link>
                            </Button>
                        </div>
                    </div>

                    <div className="relative flex animate-fade-up justify-center lg:justify-end">
                        <div className="relative flex aspect-4/5 w-full max-w-md items-center justify-center overflow-hidden rounded-hero border border-brand-sand bg-brand-warm p-6 shadow-card-lg">
                            <div className="absolute inset-0 bg-linear-to-tr from-brand-sand/30 to-transparent" />
                            {/* Graphic simulation since we don't have images */}
                            <div className="relative space-y-4 text-center">
                                <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-2 border-brand-primary/20 bg-brand-primary/10">
                                    <Package className="size-14 text-brand-primary" />
                                </div>
                                <div className="font-serif text-2xl font-semibold text-brand-text italic">
                                    Handle with care
                                </div>
                                <div className="mx-auto h-1 w-16 bg-brand-secondary" />
                            </div>

                            {/* Floating tracker widget simulation */}
                            <div className="absolute right-6 bottom-6 left-6 rounded-xl border border-white bg-white/90 p-4 shadow-xl backdrop-blur-md">
                                <form
                                    className="flex gap-2"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                    }}
                                >
                                    <input
                                        type="text"
                                        placeholder="Enter Tracking No."
                                        className="form-input py-2 shadow-inner"
                                    />
                                    <button
                                        className="rounded-lg bg-brand-navy p-2 text-white transition hover:bg-brand-navy-light"
                                        type="submit"
                                        title="Submit tracking search"
                                    >
                                        <ArrowRight className="size-5" />
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Why Choose Us */}
            <section className="section-padding relative bg-white">
                <div className="container-default mb-16 text-center">
                    <span className="eyebrow mb-4 inline-block">
                        Our Service Promise
                    </span>
                    <h2 className="text-display-sm">Why families trust us</h2>
                    <p className="mx-auto mt-4 max-w-xl text-brand-text-mid">
                        We understand the effort and love packed into every box.
                        That's why we ensure it reaches its destination safely.
                    </p>
                </div>

                <div className="container-default grid grid-cols-1 gap-8 md:grid-cols-3">
                    <div className="card group text-center">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-warm transition-transform duration-300 group-hover:scale-110">
                            <ShieldCheck className="size-8 text-brand-rust" />
                        </div>
                        <h3 className="mb-3 text-xl">Safe & Secure</h3>
                        <p className="text-sm leading-relaxed text-brand-text-mid">
                            Insured shipments with strict handling protocols.
                            Your items remain intact and protected from
                            collection to delivery.
                        </p>
                    </div>
                    <div className="card group text-center">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-warm transition-transform duration-300 group-hover:scale-110">
                            <Truck className="size-8 text-brand-rust" />
                        </div>
                        <h3 className="mb-3 text-xl">Real-time Tracking</h3>
                        <p className="text-sm leading-relaxed text-brand-text-mid">
                            Know exactly where your box is, with instant QR code
                            scanning updates by our drivers right to your phone.
                        </p>
                    </div>
                    <div className="card group text-center">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-warm transition-transform duration-300 group-hover:scale-110">
                            <HeartHandshake className="size-8 text-brand-rust" />
                        </div>
                        <h3 className="mb-3 text-xl">Heartfelt Care</h3>
                        <p className="text-sm leading-relaxed text-brand-text-mid">
                            It's not just cargo, it's a connection to home. Our
                            Filipino-led team treats every package with utmost
                            respect.
                        </p>
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="section-padding relative overflow-hidden border-t-4 border-brand-primary bg-brand-navy">
                <div className="absolute top-0 right-0 h-full w-1/2 -skew-x-12 transform bg-brand-navy-light/40" />
                <div className="container-default relative z-10 flex flex-col items-center justify-between text-white md:flex-row">
                    <div className="mb-8 max-w-2xl text-center md:mb-0 md:text-left">
                        <h2 className="text-display-sm mb-4 text-white">
                            Ready to send joy?
                        </h2>
                        <p className="text-lg text-zinc-300">
                            Schedule a pickup today and we'll handle the rest.
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-4 sm:flex-row">
                        <Link
                            href="/book"
                            className="btn-primary max-w-xs shadow-primary"
                            prefetch
                        >
                            Book Pickup Now
                        </Link>
                        <Link
                            href="/contact"
                            className="flex items-center gap-2 font-semibold text-zinc-300 transition hover:text-white"
                            prefetch
                        >
                            Contact Us <ArrowRightCircle className="size-5" />
                        </Link>
                    </div>
                </div>
            </section>
        </AppLayout>
    );
}





