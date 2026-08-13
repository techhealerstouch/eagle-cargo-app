import { Form, Head, Link, usePage } from '@inertiajs/react';
import TextLink from '@/components/common/text-link';
import { Button } from '@/components/ui/button';
import AppLogoIcon from '@/components/layout/app-logo-icon';
import BrandLogoImage from '@/components/layout/brand-logo-image';
import type { SharedData } from '@/types';
import { logout } from '@/routes';
import { send } from '@/routes/verification';

export default function VerifyEmail({ status }: { status?: string }) {
    const { settings } = usePage<SharedData>().props;

    return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-50/50 p-6 font-sans md:p-10">
            <Head title="Email verification" />
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="mb-8 flex flex-col items-center gap-4">
                    <Link
                        href="/"
                        className="group flex flex-col items-center gap-3"
                    >
                        <div className="flex h-16 w-auto items-center justify-center transition-all group-hover:scale-105">
                            <BrandLogoImage
                                src={settings?.appLogo}
                                alt={settings?.appName || 'Logo'}
                                className="h-full w-auto max-w-full object-contain"
                                fallback={
                                    <div className="flex h-20 w-20 items-center justify-center rounded-4xl border border-brand-warm/20 bg-brand-warm/10 text-brand-rust shadow-sm">
                                        <AppLogoIcon className="size-10" />
                                    </div>
                                }
                            />
                        </div>
                    </Link>
                    <div className="space-y-1 text-center">
                        <h1 className="text-2xl font-bold tracking-tight text-[#0a2540] sm:text-3xl">
                            Verify your email
                        </h1>
                        <p className="text-sm text-zinc-500">
                            Please verify your email address by clicking on the
                            link we just emailed to you.
                        </p>
                    </div>
                </div>

                {/* Card Container */}
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
                    {status === 'verification-link-sent' && (
                        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-center text-sm font-medium text-green-700">
                            A new verification link has been sent to the email
                            address you provided during registration.
                        </div>
                    )}

                    <Form
                        {...send.form()}
                        className="flex flex-col gap-6 text-center"
                    >
                        {({ processing }) => (
                            <>
                                <Button
                                    type="submit"
                                    disabled={processing}
                                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-[#c1272d] font-sans font-semibold text-white shadow-xs transition-colors hover:bg-[#a01e23] hover:text-white"
                                >
                                    Resend verification email
                                </Button>

                                <TextLink
                                    href={logout()}
                                    className="mx-auto block text-sm font-semibold text-[#c1272d] hover:text-[#a01e23]"
                                >
                                    Log out
                                </TextLink>
                            </>
                        )}
                    </Form>
                </div>
            </div>
        </div>
    );
}
