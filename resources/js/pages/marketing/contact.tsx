import type { PageProps } from '@inertiajs/core';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/layouts/app-layout';
import PhoneInput from '@/components/ui/PhoneInput';
import MarketingLayout from '@/layouts/marketing-layout';
import type { Auth, BreadcrumbItem } from '@/types';

export default function Contact() {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Home', href: '/dashboard' },
        { title: 'Contact Us', href: '/contact' },
    ];

    const { data, setData, post, processing, errors, reset, wasSuccessful } =
        useForm({
            name: '',
            email: '',
            mobile: '',
            message: '',
        });

    const submitForm = (e: React.FormEvent) => {
        e.preventDefault();
        post('/contact', {
            preserveScroll: true,
            onSuccess: () => {
                toast.success("Message sent! We'll get back to you soon.");
                reset();
            },
            onError: () => {
                toast.error('Oops! Please check your form fields.');
            },
        });
    };

    const { auth } = usePage<PageProps & { auth: Auth }>().props;
    const Layout = !auth.user ? MarketingLayout : AppLayout;

    return (
        <Layout breadcrumbs={breadcrumbs}>
            <Head title="Contact Us | Box Tracker" />
            <div className="section-padding container-default mx-auto max-w-6xl">
                <div className="mb-16 text-center">
                    <span className="eyebrow mb-4 inline-block">Support</span>
                    <h1 className="text-display-md mb-8">Get in Touch</h1>
                    <p className="mx-auto max-w-2xl text-lg text-brand-text-mid">
                        We're here to answer any questions about sending your
                        love home. Drop us a message, email us, or call us.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
                    <div className="card order-2 flex h-fit flex-col gap-6 lg:order-1">
                        <h3 className="font-serif text-2xl font-bold text-brand-text">
                            Contact Information
                        </h3>
                        <div className="flex items-center gap-4 py-3 text-brand-text-mid">
                            <div className="rounded-full bg-brand-warm p-3 text-brand-rust">
                                <Phone className="size-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-brand-text">
                                    Phone
                                </h4>
                                <p>(+63) 123 456 7890</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 border-t border-brand-sand py-3 text-brand-text-mid">
                            <div className="rounded-full bg-brand-warm p-3 text-brand-rust">
                                <Mail className="size-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-brand-text">
                                    Email
                                </h4>
                                <p>hello@lovebbcargo.com</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 border-t border-brand-sand py-3 text-brand-text-mid">
                            <div className="rounded-full bg-brand-warm p-3 text-brand-rust">
                                <MapPin className="size-5" />
                            </div>
                            <div>
                                <h4 className="font-semibold text-brand-text">
                                    Warehouse
                                </h4>
                                <p>
                                    123 Global Shipping Lane, Logistics Park, TX
                                    75001
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card order-1 lg:order-2 lg:row-span-2">
                        <h3 className="mb-6 font-serif text-2xl font-bold text-brand-text">
                            Send a Message
                        </h3>

                        {wasSuccessful ? (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-800">
                                <h4 className="mb-2 text-lg font-bold">
                                    Thank you!
                                </h4>
                                <p>
                                    Your message has been received. Our support
                                    team will respond shortly.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => reset()}
                                    className="font-sm mt-4 font-medium text-emerald-600 underline"
                                >
                                    Send another message
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={submitForm} className="space-y-6">
                                <div>
                                    <label
                                        className="form-label"
                                        htmlFor="name"
                                    >
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        id="name"
                                        value={data.name}
                                        onChange={(e) =>
                                            setData('name', e.target.value)
                                        }
                                        className="form-input"
                                        placeholder="Juan Dela Cruz"
                                    />
                                    {errors.name && (
                                        <p className="form-error">
                                            {errors.name}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label
                                        className="form-label"
                                        htmlFor="email"
                                    >
                                        Email Address *
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        value={data.email}
                                        onChange={(e) =>
                                            setData('email', e.target.value)
                                        }
                                        className="form-input"
                                        placeholder="juan@example.com"
                                    />
                                    {errors.email && (
                                        <p className="form-error">
                                            {errors.email}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label
                                        className="form-label"
                                        htmlFor="mobile"
                                    >
                                        Phone Number
                                    </label>
                                    <PhoneInput
                                        value={data.mobile || ''}
                                        onChange={(val) => setData('mobile', val)}
                                        defaultCountryCode="AU"
                                    />
                                    {errors.mobile && (
                                        <p className="form-error">
                                            {errors.mobile}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label
                                        className="form-label"
                                        htmlFor="message"
                                    >
                                        Your Message *
                                    </label>
                                    <textarea
                                        id="message"
                                        rows={5}
                                        value={data.message}
                                        onChange={(e) =>
                                            setData('message', e.target.value)
                                        }
                                        className="form-input"
                                        placeholder="How can we help you?"
                                    />
                                    {errors.message && (
                                        <p className="form-error">
                                            {errors.message}
                                        </p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="btn-primary w-full disabled:opacity-50"
                                >
                                    {processing ? 'Sending...' : 'Send Message'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}





