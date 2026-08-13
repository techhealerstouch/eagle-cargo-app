import type { PageProps } from '@inertiajs/core';
import { Head, Link, usePage } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import type { Auth, BreadcrumbItem } from '@/types';

export default function CommunityStory() {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Home', href: '/dashboard' },
        { title: 'Community Story', href: '/our-story' },
    ];

    const { auth } = usePage<PageProps & { auth: Auth }>().props;
    const Layout = !auth.user ? MarketingLayout : AppLayout;

    return (
        <Layout {...(auth.user ? { breadcrumbs } : {})}>
            <Head title="Our Community Story | Box Tracker" />

            {/* Split hero */}
            <section className="section-padding border-b border-brand-sand bg-brand-cream">
                <div className="container-default mx-auto max-w-5xl">
                    <div className="mx-auto mb-16 max-w-2xl text-center">
                        <span className="eyebrow mb-4 inline-block">
                            The "Why"
                        </span>
                        <h1 className="text-display-md mb-8 leading-tight">
                            Beyond empty boxes and tape.
                        </h1>
                        <p className="font-sans text-lg leading-relaxed text-brand-text-mid">
                            A cargo shipment isn't simply a collection of goods.
                            It represents the hard work, selflessness, and
                            undying love of Overseas Filipino Workers (OFWs)
                            providing for their families miles away. At Box Tracker
                            Cargo, we honor that sacrifice. Every box we lift,
                            secure, and ship is a bridge between two hearts.
                        </p>
                    </div>
                </div>
            </section>

            {/* Content Segment */}
            <section className="section-padding relative bg-white">
                <div className="container-default mx-auto max-w-3xl space-y-12 text-lg leading-relaxed text-brand-text-mid">
                    <p>
                        <strong className="font-serif text-2xl text-brand-text">
                            When we started in 2026,
                        </strong>{' '}
                        we noticed one recurring issue with logistics: they
                        treated cargo as just objects. But in the Filipino
                        culture, a cargo box is intensely personal. It's
                        the taste of imported chocolates meant to excite the
                        kids; the smell of brand new sneakers for the teenager
                        graduating high school; the relief in providing a blood
                        pressure monitor to an aging parent.
                    </p>
                    <div className="card my-12 rounded-r-xl border-t-0 border-r-0 border-b-0 border-l-4 border-l-brand-primary bg-brand-warm p-8 text-center font-serif text-xl text-brand-rust italic shadow-sm">
                        "They aren't shipping items. They are shipping their
                        love and presence across oceans."
                    </div>
                    <p>
                        We established Box Tracker to provide a trusted layer
                        of protection for these precious sent items. Our
                        couriers are trained to handle each box not as a generic
                        parcel, but with the specific thought that this could be
                        meant for their own family.
                    </p>
                    <p>
                        From deploying realtime tracking via custom-built
                        scanner portals to hand-verifying secure storage at
                        every port—our technology exists specifically to give
                        our senders peace of mind. We don't just bridge the
                        geographic distance; we bridge the anxiety of "Did it
                        arrive safely?".
                    </p>
                </div>
            </section>

            {/* CTA */}
            <section className="relative overflow-hidden bg-brand-rust py-24 text-center text-white">
                <div className="absolute inset-0 translate-x-32 translate-y-24 rounded-t-[100%] bg-brand-navy opacity-50 blur-3xl" />
                <div className="container-default relative z-10 mx-auto max-w-2xl px-6">
                    <h2 className="text-display-sm mb-6 text-white">
                        Send your love. Securely.
                    </h2>
                    <p className="mb-8 text-brand-sand">
                        Join the thousands of families trusting us to carry
                        their care packages back home.
                    </p>
                    <Link
                        href="/book"
                        className="btn-primary w-full bg-brand-secondary text-brand-text shadow-none hover:bg-brand-secondary-light focus:ring-brand-secondary sm:w-auto"
                    >
                        Begin your booking
                    </Link>
                </div>
            </section>
        </Layout>
    );
}





