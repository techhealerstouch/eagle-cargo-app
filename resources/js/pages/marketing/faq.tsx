import type { PageProps } from '@inertiajs/core';
import { Head, usePage } from '@inertiajs/react';
import { Download } from 'lucide-react';
import { useState } from 'react';
import DeclarationDownloadModal from '@/components/common/declaration-download-modal';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import type { Auth, BreadcrumbItem } from '@/types';

export default function FAQ() {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Home', href: '/dashboard' },
        { title: 'FAQ', href: '/faq' },
    ];

    const { auth } = usePage<PageProps & { auth: Auth }>().props;
    const Layout = !auth.user ? MarketingLayout : AppLayout;
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    return (
        <Layout breadcrumbs={breadcrumbs}>
            <Head title="Frequency Asked Questions | Box Tracker" />
            <div className="section-padding container-default mx-auto max-w-4xl">
                <div className="mb-16 text-center">
                    <span className="eyebrow mb-4 inline-block">
                        Help Center
                    </span>
                    <h1 className="text-display-md mb-8">
                        Frequently Asked Questions
                    </h1>
                    <p className="text-lg text-brand-text-mid">
                        Everything you need to know about packing and shipping
                        your cargo box securely.
                    </p>
                </div>

                <div className="space-y-6">
                    <div className="card text-left">
                        <h3 className="mb-2 cursor-pointer font-serif text-2xl font-bold">
                            What items are strictly prohibited?
                        </h3>
                        <p className="mt-2 leading-relaxed text-brand-text-mid">
                            We follow strict customs guidelines. Weapons,
                            illegal drugs, explosive materials, highly flammable
                            items, combustible liquids, pornographic materials,
                            and unauthorized copies of copyrighted items are
                            strictly prohibited. Non-compliance could lead to
                            box confiscation.
                        </p>
                    </div>

                    <div className="card text-left">
                        <h3 className="mb-2 cursor-pointer font-serif text-2xl font-bold">
                            How long will delivery take?
                        </h3>
                        <p className="mt-2 leading-relaxed text-brand-text-mid">
                            Transit lines via ocean freight generally take 4-6
                            weeks to reach Manila via port processing, and
                            another 1-2 weeks depending on whether it needs to
                            be routed to Visayas or Mindanao.
                        </p>
                    </div>

                    <div className="card text-left">
                        <h3 className="mb-2 cursor-pointer font-serif text-2xl font-bold">
                            How should I pack fragile items?
                        </h3>
                        <p className="mt-2 leading-relaxed text-brand-text-mid">
                            Bubble wrap or cushion all glass, electronics, and
                            fragile items generously. Ensure heavy items are
                            placed at the bottom, and fill all gaps securely to
                            prevent shifting during transit. Make sure to
                            declare any fragile items on your packing list.
                        </p>
                    </div>

                    <div className="card text-left">
                        <h3 className="mb-2 cursor-pointer font-serif text-2xl font-bold">
                            Can I get a blank declaration form?
                        </h3>
                        <p className="mt-2 leading-relaxed text-brand-text-mid">
                            Yes! You can download a blank customs declaration form to fill out manually. 
                            This is useful if you prefer to prepare your documentation in advance or need a physical copy.
                        </p>
                        <a
                            href="/declaration-form/blank"
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-all"
                            onClick={(e) => {
                                e.preventDefault();
                                setIsConfirmOpen(true);
                            }}
                        >
                            <Download className="size-4" />
                            Download Blank Declaration Form
                        </a>
                    </div>

                    <div className="card text-center text-left">
                        <p className="font-sans font-medium">
                            Still have questions?
                        </p>
                        <a
                            href="/contact"
                            className="mt-2 inline-block text-brand-primary hover:underline"
                        >
                            Contact our supportive team
                        </a>
                    </div>
                </div>
            </div>
            <DeclarationDownloadModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
            />
        </Layout>
    );
}





