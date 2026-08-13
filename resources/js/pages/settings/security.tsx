import { Transition } from '@headlessui/react';
import { Form, Head } from '@inertiajs/react';
import { ShieldCheck, Lock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useRef, useState } from 'react';
import SecurityController from '@/actions/App/Http/Controllers/Settings/SecurityController';
import TwoFactorRecoveryCodes from '@/components/auth/two-factor-recovery-codes';
import TwoFactorSetupModal from '@/components/auth/two-factor-setup-modal';
import Heading from '@/components/common/heading';
import InputError from '@/components/common/input-error';
import PasswordInput from '@/components/common/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTwoFactorAuth } from '@/hooks/use-two-factor-auth';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit } from '@/routes/security';
import { disable, enable } from '@/routes/two-factor';
import type { BreadcrumbItem } from '@/types';

type Props = {
    canManageTwoFactor?: boolean;
    requiresConfirmation?: boolean;
    twoFactorEnabled?: boolean;
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Settings',
        href: edit(),
    },
    {
        title: 'Login & Security',
        href: edit(),
    },
];

export default function Security({
    canManageTwoFactor = false,
    requiresConfirmation = false,
    twoFactorEnabled = false,
}: Props) {
    const passwordInput = useRef<HTMLInputElement>(null);
    const currentPasswordInput = useRef<HTMLInputElement>(null);

    const {
        qrCodeSvg,
        hasSetupData,
        manualSetupKey,
        clearSetupData,
        fetchSetupData,
        recoveryCodesList,
        fetchRecoveryCodes,
        errors,
    } = useTwoFactorAuth();
    const [showSetupModal, setShowSetupModal] = useState<boolean>(false);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Login & Security" />

            <SettingsLayout
                eyebrow="Settings"
                title="Login & Security"
                description="Manage your password and keep your account safe."
            >
                <div className="space-y-16">
                    {/* Password Section */}
                    <div className="space-y-10">
                        <Form
                            {...SecurityController.update.form()}
                            options={{
                                preserveScroll: true,
                            }}
                            resetOnError={[
                                'password',
                                'password_confirmation',
                                'current_password',
                            ]}
                            resetOnSuccess
                            onError={(errors) => {
                                if (errors.password) {
                                    passwordInput.current?.focus();
                                }

                                if (errors.current_password) {
                                    currentPasswordInput.current?.focus();
                                }
                            }}
                            className="max-w-2xl space-y-8"
                        >
                            {({ errors, processing, recentlySuccessful }) => (
                                <>
                                    <div className="space-y-3">
                                        <Label
                                            htmlFor="current_password"
                                            className="ml-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400"
                                        >
                                            Current Password
                                        </Label>
                                        <PasswordInput
                                            id="current_password"
                                            ref={currentPasswordInput}
                                            name="current_password"
                                            className="h-14 rounded-2xl border-2 border-zinc-100 bg-zinc-50/50 px-5 text-sm font-medium text-zinc-900 transition-all focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100 dark:focus:border-zinc-700 dark:focus:ring-zinc-950"
                                            autoComplete="current-password"
                                            placeholder="Current password"
                                        />
                                        <InputError
                                            message={errors.current_password}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                                        <div className="space-y-3">
                                            <Label
                                                htmlFor="password"
                                                className="ml-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400"
                                            >
                                                New Password
                                            </Label>
                                            <PasswordInput
                                                id="password"
                                                ref={passwordInput}
                                                name="password"
                                                className="dark:focus:ring-zinc-900 h-14 rounded-2xl border-2 border-zinc-100 bg-zinc-50/50 px-5 text-sm font-medium text-zinc-900 transition-all focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100 dark:focus:border-zinc-700"
                                                autoComplete="new-password"
                                                placeholder="New password"
                                            />
                                            <InputError
                                                message={errors.password}
                                            />
                                        </div>

                                        <div className="space-y-3">
                                            <Label
                                                htmlFor="password_confirmation"
                                                className="ml-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400"
                                            >
                                                Repeat New Password
                                            </Label>
                                            <PasswordInput
                                                id="password_confirmation"
                                                name="password_confirmation"
                                                className="dark:focus:ring-zinc-900 h-14 rounded-2xl border-2 border-zinc-100 bg-zinc-50/50 px-5 text-sm font-medium text-zinc-900 transition-all focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-100 dark:focus:border-zinc-700"
                                                autoComplete="new-password"
                                                placeholder="Confirm password"
                                            />
                                            <InputError
                                                message={
                                                    errors.password_confirmation
                                                }
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6 pt-4">
                                        <Button
                                            disabled={processing}
                                            className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-zinc-900 px-10 text-xs font-medium text-white shadow-xl shadow-zinc-200 transition-all hover:scale-[1.02] active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-none"
                                        >
                                            Update password{' '}
                                            <Lock className="size-4" />
                                        </Button>

                                        <Transition
                                            show={recentlySuccessful}
                                            enter="transition ease-in-out duration-500"
                                            enterFrom="opacity-0 translate-x-4"
                                            leave="transition ease-in-out duration-500"
                                            leaveTo="opacity-0 -translate-x-4"
                                        >
                                            <p className="text-xs font-semibold text-emerald-500">
                                                Password updated
                                            </p>
                                        </Transition>
                                    </div>

                                    <div className="mt-8 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">What happens next?</p>
                                        <p className="mt-1 text-sm text-zinc-500">
                                            Updating your password will log you out of all other devices.
                                        </p>
                                    </div>
                                </>
                            )}
                        </Form>
                    </div>

                    {/* 2FA Section */}
                    {canManageTwoFactor && (
                        <div className="space-y-10 border-t border-zinc-100 pt-16 dark:border-zinc-800">
                            <Heading
                                title="Extra Login Security (2FA)"
                                description="Keep your account extra safe by requiring a code when you log in."
                            />

                            {twoFactorEnabled ? (
                                <div className="space-y-8">
                                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">2FA is active</p>
                                        <p className="mt-1 text-sm text-zinc-500">
                                            Your account is protected. You'll need a code from your authenticator app to log in.
                                        </p>
                                    </div>

                                    <div className="dark:bg-emerald-950/20 flex flex-col items-center justify-between gap-8 rounded-xl border border-emerald-100 bg-emerald-50 p-8 md:flex-row dark:border-emerald-900/30">
                                        <div className="flex items-center gap-5">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-100 bg-white text-emerald-500 shadow-sm dark:border-emerald-800/50 dark:bg-zinc-900 dark:text-emerald-400">
                                                <CheckCircle2 className="size-6" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                                                    Extra security is on
                                                </h4>
                                                <p className="mt-1 text-xs text-emerald-700/60 dark:text-emerald-400/80">
                                                    You're protected with an
                                                    extra layer of security.
                                                </p>
                                            </div>
                                        </div>

                                        <Form {...disable.form()}>
                                            {({ processing }) => (
                                                <Button
                                                    variant="ghost"
                                                    type="submit"
                                                    disabled={processing}
                                                    className="dark:hover:bg-red-950/30 h-14 rounded-2xl border-2 border-red-100 px-8 text-sm font-medium text-red-500 transition-all hover:bg-red-50 hover:text-red-600 dark:border-red-900/30 dark:text-red-400 dark:hover:text-red-300"
                                                >
                                                    Turn Off Extra Security
                                                </Button>
                                            )}
                                        </Form>
                                    </div>

                                    <div className="space-y-6 rounded-xl border border-zinc-100 bg-white p-8 shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
                                        <h4 className="text-sm font-medium text-zinc-400">
                                            Emergency Recovery Keys
                                        </h4>
                                        <TwoFactorRecoveryCodes
                                            recoveryCodesList={
                                                recoveryCodesList
                                            }
                                            fetchRecoveryCodes={
                                                fetchRecoveryCodes
                                            }
                                            errors={errors}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    <div className="space-y-8 rounded-[40px] border border-zinc-100 bg-zinc-50 p-10 dark:border-zinc-800 dark:bg-zinc-900/50">
                                        <div className="flex items-start gap-6">
                                            <div className="dark:text-zinc-550 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900">
                                                <ShieldAlert className="size-6" />
                                            </div>
                                            <div className="space-y-4">
                                                <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                                                    Make your account more
                                                    secure by requiring a code
                                                    from an app on your phone
                                                    (like Google Authenticator
                                                    or Authy) whenever you log
                                                    in.
                                                </p>
                                            </div>
                                        </div>

                                        <div>
                                            {hasSetupData ? (
                                                <Button
                                                    onClick={() =>
                                                        setShowSetupModal(true)
                                                    }
                                                    className="flex h-16 items-center justify-center gap-3 rounded-2xl bg-zinc-900 px-12 text-sm font-medium text-white shadow-xl shadow-zinc-200 transition-all hover:scale-[1.02] active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-none"
                                                >
                                                    Finish Setup{' '}
                                                    <ShieldCheck className="size-4" />
                                                </Button>
                                            ) : (
                                                <Form
                                                    {...enable.form()}
                                                    onSuccess={() =>
                                                        setShowSetupModal(true)
                                                    }
                                                >
                                                    {({ processing }) => (
                                                        <Button
                                                            type="submit"
                                                            disabled={
                                                                processing
                                                            }
                                                            className="flex h-16 items-center justify-center gap-3 rounded-2xl bg-zinc-900 px-12 text-sm font-medium text-white shadow-xl shadow-zinc-200 transition-all hover:scale-[1.02] active:scale-95 dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-none"
                                                        >
                                                            Enable Extra
                                                            Security{' '}
                                                            <ShieldCheck className="size-4" />
                                                        </Button>
                                                    )}
                                                </Form>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <TwoFactorSetupModal
                                isOpen={showSetupModal}
                                onClose={() => setShowSetupModal(false)}
                                requiresConfirmation={requiresConfirmation}
                                twoFactorEnabled={twoFactorEnabled}
                                qrCodeSvg={qrCodeSvg}
                                manualSetupKey={manualSetupKey}
                                clearSetupData={clearSetupData}
                                fetchSetupData={fetchSetupData}
                                errors={errors}
                            />
                        </div>
                    )}
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
