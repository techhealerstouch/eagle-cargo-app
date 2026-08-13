import { Form, Head, Link, usePage } from '@inertiajs/react';
import { LoaderCircle, LogIn } from 'lucide-react';
import InputError from '@/components/common/input-error';
import PasswordInput from '@/components/common/password-input';
import TextLink from '@/components/common/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';
import AppLogoIcon from '@/components/layout/app-logo-icon';
import BrandLogoImage from '@/components/layout/brand-logo-image';
import type { SharedData } from '@/types';

type Props = {
    status?: string;
    canResetPassword: boolean;
    canRegister: boolean;
};

export default function Login({
    status,
    canResetPassword,
    canRegister,
}: Props) {
    const { settings } = usePage<SharedData>().props;

    return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-50/50 p-6 font-sans md:p-10">
            <Head title="Log in" />
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
                            Log in to your account
                        </h1>
                        <p className="text-sm text-zinc-500">
                            Access bookings, tracking, invoices, and delivery
                            updates
                        </p>
                    </div>
                </div>

                {/* Card Container */}
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
                    {status && (
                        <div
                            role="status"
                            className="mb-5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700"
                        >
                            {status}
                        </div>
                    )}

                    <Form
                        {...store.form()}
                        resetOnSuccess={['password']}
                        className="flex flex-col gap-6"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="grid gap-5">
                                    {/* Email */}
                                    <div className="grid gap-2">
                                        <Label
                                            htmlFor="email"
                                            className="font-sans font-semibold text-zinc-900"
                                        >
                                            Email address
                                        </Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            name="email"
                                            required
                                            autoFocus
                                            autoComplete="email"
                                            placeholder="email@example.com"
                                            className="h-11 rounded-lg border-zinc-200 bg-white font-sans text-zinc-900 focus-visible:border-zinc-950 focus-visible:ring-zinc-950/10"
                                        />
                                        <InputError message={errors.email} />
                                    </div>

                                    {/* Password */}
                                    <div className="grid gap-2">
                                        <div className="flex items-center">
                                            <Label
                                                htmlFor="password"
                                                className="font-sans font-semibold text-zinc-900"
                                            >
                                                Password
                                            </Label>
                                            {canResetPassword && (
                                                <TextLink
                                                    href={request()}
                                                    className="ml-auto text-sm font-semibold text-[#c1272d] hover:text-[#a01e23]"
                                                >
                                                    Forgot password?
                                                </TextLink>
                                            )}
                                        </div>
                                        <PasswordInput
                                            id="password"
                                            name="password"
                                            required
                                            autoComplete="current-password"
                                            placeholder="Password"
                                            className="h-11 rounded-lg border-zinc-200 bg-white font-sans text-zinc-900 focus-visible:border-zinc-950 focus-visible:ring-zinc-950/10"
                                        />
                                        <InputError message={errors.password} />
                                    </div>

                                    {/* Remember Me */}
                                    <div className="flex items-center space-x-3">
                                        <Checkbox
                                            id="remember"
                                            name="remember"
                                        />
                                        <Label
                                            htmlFor="remember"
                                            className="cursor-pointer font-sans font-medium text-zinc-700 selection:bg-transparent"
                                        >
                                            Remember me
                                        </Label>
                                    </div>

                                    {/* Submit Button */}
                                    <Button
                                        type="submit"
                                        className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-transparent bg-[#c1272d] font-sans font-semibold text-white shadow-xs transition-colors hover:bg-[#a01e23] hover:text-white"
                                        disabled={processing}
                                        data-test="login-button"
                                    >
                                        {processing ? (
                                            <LoaderCircle
                                                className="size-4 animate-spin"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <LogIn
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                        )}
                                        {processing
                                            ? 'Logging in...'
                                            : 'Log in'}
                                    </Button>
                                </div>

                                {/* Register Footer */}
                                {canRegister && (
                                    <div className="mt-2 text-center font-sans text-sm text-zinc-500">
                                        Don't have an account?{' '}
                                        <TextLink
                                            href={register()}
                                            className="font-semibold text-[#c1272d] hover:text-[#a01e23]"
                                        >
                                            Sign up
                                        </TextLink>
                                    </div>
                                )}
                            </>
                        )}
                    </Form>
                </div>
            </div>
        </div>
    );
}
