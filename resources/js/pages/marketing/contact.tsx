import type { PageProps } from '@inertiajs/core';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    Mail,
    Phone,
    MapPin,
    Clock,
    Send,
    CheckCircle2,
    ArrowRight,
    Loader2,
    ShieldCheck,
    MessageSquare,
} from 'lucide-react';
import React from 'react';
import { toast } from 'sonner';
import PhoneInput from '@/components/ui/PhoneInput';
import AppLayout from '@/layouts/app-layout';
import MarketingLayout from '@/layouts/marketing-layout';
import type { Auth, BreadcrumbItem } from '@/types';

interface ContactProps {
    contactInfo?: {
        phone: string;
        email: string;
        address: string;
        hours?: string;
    };
}

const baseInputClass =
    'h-12 w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-brand-rust focus:outline-none focus:ring-2 focus:ring-brand-rust/20 transition-all';

export default function Contact({ contactInfo }: ContactProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Home', href: '/dashboard' },
        { title: 'Contact Us', href: '/contact' },
    ];

    const { auth, settings } = usePage<
        PageProps & { auth: Auth; settings?: any }
    >().props;

    const Layout = !auth.user ? MarketingLayout : AppLayout;
    const appName = settings?.appName || 'Eagle Cargo';

    const phone =
        contactInfo?.phone || settings?.contactPhone || '+61 406 828 471';
    const email =
        contactInfo?.email || settings?.supportEmail || 'support@eaglecargo.com.au';
    const address =
        contactInfo?.address ||
        settings?.warehouseAddress ||
        '6 Ivan St, Arundel QLD 4214, Australia';
    const hours =
        contactInfo?.hours || 'Monday – Saturday: 8:00 AM – 6:00 PM AEST';

    const telLink = `tel:${phone.replace(/\s+/g, '')}`;
    const mailtoLink = `mailto:${email}`;

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
                toast.success("Message sent! We'll get back to you shortly.");
                reset();
            },
            onError: () => {
                toast.error('Please check the required form fields.');
            },
        });
    };

    return (
        <Layout breadcrumbs={breadcrumbs}>
            <Head title={`Contact Us | ${appName}`} />

            <div className="section-padding container-default mx-auto max-w-6xl px-4 py-12 md:py-16">
                {/* Header */}
                <div className="mx-auto mb-12 max-w-3xl text-center md:mb-16">
                    <span className="eyebrow mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-rust/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-rust">
                        <MessageSquare className="size-3.5" />
                        Support & Inquiries
                    </span>
                    <h1 className="font-serif text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl md:text-5xl">
                        Get in Touch with {appName}
                    </h1>
                    <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 sm:text-lg">
                        Have questions about scheduling a pickup, box sizes, or ocean transit times?
                        Our Australian support team is here to assist you.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                    {/* Left Column: Contact Channels & Quick Booking */}
                    <div className="space-y-6 lg:col-span-5">
                        {/* Contact Information Card */}
                        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
                            <div className="border-b border-zinc-100 pb-5 dark:border-zinc-800">
                                <h2 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                                    Contact Information
                                </h2>
                                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    Reach our team directly via phone, email, or depot
                                </p>
                            </div>

                            <div className="mt-6 space-y-5">
                                {/* Phone */}
                                <div className="flex items-start gap-4 rounded-2xl p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-rust/10 text-brand-rust dark:bg-brand-rust/20">
                                        <Phone className="size-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                            Phone / Support Line
                                        </p>
                                        <a
                                            href={telLink}
                                            className="mt-0.5 block text-base font-bold text-zinc-900 hover:text-brand-rust dark:text-zinc-100 dark:hover:text-brand-rust transition-colors"
                                        >
                                            {phone}
                                        </a>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                            Australian bookings & inquiries
                                        </p>
                                    </div>
                                </div>

                                {/* Email */}
                                <div className="flex items-start gap-4 rounded-2xl p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-rust/10 text-brand-rust dark:bg-brand-rust/20">
                                        <Mail className="size-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                            Email Support
                                        </p>
                                        <a
                                            href={mailtoLink}
                                            className="mt-0.5 block break-all text-base font-bold text-zinc-900 hover:text-brand-rust dark:text-zinc-100 dark:hover:text-brand-rust transition-colors"
                                        >
                                            {email}
                                        </a>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                            Typical response within 2–4 hours
                                        </p>
                                    </div>
                                </div>

                                {/* Warehouse / Depot */}
                                <div className="flex items-start gap-4 rounded-2xl p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-rust/10 text-brand-rust dark:bg-brand-rust/20">
                                        <MapPin className="size-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                            Depot & Warehouse
                                        </p>
                                        <p className="mt-0.5 whitespace-pre-line text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                            {address}
                                        </p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                            Consolidation hub for sea cargo shipments
                                        </p>
                                    </div>
                                </div>

                                {/* Hours */}
                                <div className="flex items-start gap-4 rounded-2xl p-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-rust/10 text-brand-rust dark:bg-brand-rust/20">
                                        <Clock className="size-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                            Operating Hours
                                        </p>
                                        <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                            {hours}
                                        </p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                            Sunday: Closed (Cargo pick-ups by schedule)
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Trust Badge */}
                            <div className="mt-6 flex items-center gap-3 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/40">
                                <ShieldCheck className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                    Trusted door-to-door Balikbayan box cargo service connecting Australia to the Philippines.
                                </p>
                            </div>
                        </div>

                        {/* Quick Booking Callout Card */}
                        <div className="rounded-3xl border border-brand-rust/20 bg-gradient-to-br from-brand-rust/5 to-brand-rust/10 p-6 dark:from-brand-rust/10 dark:to-brand-rust/20 md:p-8">
                            <h3 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100">
                                Ready to Send a Box?
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                                You can schedule a pickup directly online without registering an account.
                                Fast, simple, and transparent pricing.
                            </p>
                            <div className="mt-5">
                                <Link
                                    href="/guest/book"
                                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-rust px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-brand-rust/90 active:scale-[0.99] transition-all"
                                >
                                    Book a Pickup as Guest
                                    <ArrowRight className="size-4" />
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Send a Message Form */}
                    <div className="lg:col-span-7">
                        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 md:p-8">
                            <div className="border-b border-zinc-100 pb-5 dark:border-zinc-800">
                                <h2 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                                    Send a Message
                                </h2>
                                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                    Fill in your details and message below. We will get back to you shortly.
                                </p>
                            </div>

                            {wasSuccessful ? (
                                <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-8 text-center dark:border-emerald-800 dark:bg-emerald-950/30">
                                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                                        <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <h3 className="font-serif text-xl font-bold text-emerald-900 dark:text-emerald-200">
                                        Thank You!
                                    </h3>
                                    <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">
                                        Your message has been received by the {appName} team.
                                        We will review your inquiry and get back to you via email or phone promptly.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => reset()}
                                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-emerald-700 transition-colors"
                                    >
                                        Send Another Message
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={submitForm} className="mt-6 space-y-5">
                                    {/* Full Name */}
                                    <div className="space-y-1.5">
                                        <label
                                            className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                                            htmlFor="name"
                                        >
                                            Full Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            id="name"
                                            value={data.name}
                                            onChange={(e) => setData('name', e.target.value)}
                                            className={baseInputClass}
                                            placeholder="e.g. Juan Dela Cruz"
                                            required
                                        />
                                        {errors.name && (
                                            <p className="text-xs font-semibold text-red-600">
                                                {errors.name}
                                            </p>
                                        )}
                                    </div>

                                    {/* Email */}
                                    <div className="space-y-1.5">
                                        <label
                                            className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                                            htmlFor="email"
                                        >
                                            Email Address <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            id="email"
                                            value={data.email}
                                            onChange={(e) => setData('email', e.target.value)}
                                            className={baseInputClass}
                                            placeholder="e.g. juan@example.com"
                                            required
                                        />
                                        {errors.email && (
                                            <p className="text-xs font-semibold text-red-600">
                                                {errors.email}
                                            </p>
                                        )}
                                    </div>

                                    {/* Mobile */}
                                    <div className="space-y-1.5">
                                        <label
                                            className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                                            htmlFor="mobile"
                                        >
                                            Phone Number <span className="text-zinc-400 font-normal">(Optional)</span>
                                        </label>
                                        <PhoneInput
                                            value={data.mobile || ''}
                                            onChange={(val) => setData('mobile', val)}
                                            defaultCountryCode="AU"
                                        />
                                        {errors.mobile && (
                                            <p className="text-xs font-semibold text-red-600">
                                                {errors.mobile}
                                            </p>
                                        )}
                                    </div>

                                    {/* Message */}
                                    <div className="space-y-1.5">
                                        <label
                                            className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400"
                                            htmlFor="message"
                                        >
                                            Your Message <span className="text-red-500">*</span>
                                        </label>
                                        <textarea
                                            id="message"
                                            rows={6}
                                            value={data.message}
                                            onChange={(e) => setData('message', e.target.value)}
                                            className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-brand-rust focus:outline-none focus:ring-2 focus:ring-brand-rust/20 transition-all resize-y"
                                            placeholder="How can we help? Inquire about pickups, cargo rates, container schedules, or delivery..."
                                            required
                                        />
                                        {errors.message && (
                                            <p className="text-xs font-semibold text-red-600">
                                                {errors.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Submit Button */}
                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={processing}
                                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-rust py-4 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-brand-rust/90 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                                        >
                                            {processing ? (
                                                <>
                                                    <Loader2 className="size-4 animate-spin" />
                                                    Sending Message...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="size-4" />
                                                    Send Message
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
