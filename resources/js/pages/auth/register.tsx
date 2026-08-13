import { Form, Head, Link, usePage } from '@inertiajs/react';
import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import InputError from '@/components/common/input-error';
import PasswordInput from '@/components/common/password-input';
import TextLink from '@/components/common/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LocationPickerMap from '@/components/ui/LocationPickerMap';
import PhoneInput from '@/components/ui/PhoneInput';
import { validatePhone } from '@/lib/countries';
import { SuburbSelect } from '@/components/ui/SuburbSelect';
import { login } from '@/routes';
import { store } from '@/routes/register';
import AppLogoIcon from '@/components/layout/app-logo-icon';
import BrandLogoImage from '@/components/layout/brand-logo-image';
import type { SharedData } from '@/types';

type Role = 'sender' | 'recipient';

type RegisterFormData = {
    role: Role;
    name: string;
    email: string;
    mobile: string;
    password: string;
    password_confirmation: string;
    address: string;
    suburb: string;
    state: string;
    postcode: string;
    latitude: number | null;
    longitude: number | null;
};

type RegisterField = keyof RegisterFormData;

const WIZARD_STEPS = [
    { id: 1, title: 'Role' },
    { id: 2, title: 'Account' },
    { id: 3, title: 'Address' },
    { id: 4, title: 'Review' },
];

const ROLE_LABELS: Record<Role, string> = {
    sender: 'Sender',
    recipient: 'Receiver',
};

const getPasswordStrength = (pw: string) => {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[a-zA-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return score;
};

type SuburbOption = { name: string; postcode: string };

export default function Register() {
    const { settings, registeredSuburbs } = usePage<SharedData & { registeredSuburbs?: SuburbOption[] }>().props;
    const [step, setStep] = React.useState(1);
    const [stepErrors, setStepErrors] = React.useState<
        Partial<Record<RegisterField, string>>
    >({});
    const [formData, setFormData] = React.useState<RegisterFormData>({
        role: 'sender',
        name: '',
        email: '',
        mobile: '',
        password: '',
        password_confirmation: '',
        address: '',
        suburb: '',
        state: '',
        postcode: '',
        latitude: null,
        longitude: null,
    });

    const setField = <K extends RegisterField>(
        key: K,
        value: RegisterFormData[K],
    ) => {
        setFormData((prev) => ({
            ...prev,
            [key]: value,
        }));

        setStepErrors((prev) => {
            const updated = { ...prev };
            delete updated[key];

            if (
                (key === 'password' || key === 'password_confirmation') &&
                formData.password &&
                formData.password_confirmation
            ) {
                delete updated.password_confirmation;
            }

            return updated;
        });
    };

    const validateStep = (currentStep: number) => {
        const nextErrors: Partial<Record<RegisterField, string>> = {};

        if (currentStep === 1) {
            if (!formData.role) {
                nextErrors.role = 'Please select your role.';
            }
        }

        if (currentStep === 2) {
            if (!formData.name.trim()) {
                nextErrors.name = 'Name is required.';
            }

            if (!formData.email.trim()) {
                nextErrors.email = 'Email is required.';
            }

            const phoneError = validatePhone(
                formData.mobile,
                'Mobile number',
                formData.role === 'recipient' ? 'PH' : 'AU',
            );
            if (phoneError) {
                nextErrors.mobile = phoneError;
            }

            if (!formData.password) {
                nextErrors.password = 'Password is required.';
            }

            if (!formData.password_confirmation) {
                nextErrors.password_confirmation =
                    'Password confirmation is required.';
            }

            if (formData.password !== formData.password_confirmation) {
                nextErrors.password_confirmation = 'Passwords do not match.';
            }
        }

        if (currentStep === 3) {
            if (!formData.address.trim()) {
                nextErrors.address = 'Street address is required.';
            }
        }

        setStepErrors(nextErrors);

        return Object.keys(nextErrors).length === 0;
    };

    const handleNext = () => {
        if (!validateStep(step)) {
            return;
        }

        setStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length));
    };

    const handleBack = () => {
        setStep((prev) => Math.max(prev - 1, 1));
    };

    const getStepHeader = () => {
        switch (step) {
            case 1:
                return {
                    eyebrow: 'STEP 1 OF 4',
                    title: 'Choose your role',
                    description:
                        'Select the account type that best matches your workflow.',
                };
            case 2:
                return {
                    eyebrow: 'STEP 2 OF 4',
                    title: 'Account details',
                    description:
                        'Set your account identity and login credentials.',
                };
            case 3:
                return {
                    eyebrow: 'STEP 3 OF 4',
                    title: 'Address details',
                    description:
                        'Enter your primary location for delivery or pickup operations.',
                };
            case 4:
                return {
                    eyebrow: 'STEP 4 OF 4',
                    title: 'Review details',
                    description:
                        'Confirm your details before creating your account.',
                };
            default:
                return { eyebrow: '', title: '', description: '' };
        }
    };

    const stepHeader = getStepHeader();

    return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-50/50 p-6 font-sans md:p-10">
            <Head title="Register" />
            <div className="w-full max-w-2xl">
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
                            Create an account
                        </h1>
                        <p className="text-sm text-zinc-500">
                            Complete each step to finish your registration
                        </p>
                    </div>
                </div>

                {/* Stepper */}
                <div className="my-6 flex w-full items-center justify-center">
                    <div className="flex w-full max-w-2xl items-center justify-between px-4">
                        {WIZARD_STEPS.map((wizardStep, idx) => {
                            const isCompleted = step > wizardStep.id;
                            const isActive = step === wizardStep.id;
                            const isLast = idx === WIZARD_STEPS.length - 1;

                            return (
                                <React.Fragment key={wizardStep.id}>
                                    {/* Step item */}
                                    <div className="flex items-center gap-3">
                                        {/* Circle */}
                                        <div
                                            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-300 ${
                                                isCompleted
                                                    ? 'bg-[#0a2540] text-white'
                                                    : isActive
                                                      ? 'bg-[#c1272d] text-white'
                                                      : 'bg-zinc-200 text-zinc-600'
                                            }`}
                                        >
                                            {isCompleted ? (
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    strokeWidth={3}
                                                    stroke="currentColor"
                                                    className="h-4 w-4"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M4.5 12.75l6 6 9-13.5"
                                                    />
                                                </svg>
                                            ) : (
                                                wizardStep.id
                                            )}
                                        </div>

                                        {/* Labels */}
                                        <div className="hidden flex-col text-left sm:flex">
                                            <span className="text-[10px] leading-none font-medium text-zinc-400">
                                                Step {wizardStep.id}
                                            </span>
                                            <span
                                                className={`text-xs leading-tight font-bold ${
                                                    isCompleted
                                                        ? 'text-[#0a2540]'
                                                        : isActive
                                                          ? 'text-[#c1272d]'
                                                          : 'text-zinc-400'
                                                }`}
                                            >
                                                {wizardStep.title}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Connector line */}
                                    {!isLast && (
                                        <div
                                            className={`mx-2 h-0.5 flex-1 transition-colors duration-300 ${
                                                isCompleted
                                                    ? 'bg-[#0a2540]'
                                                    : isActive
                                                      ? 'bg-[#c1272d]'
                                                      : 'bg-zinc-200'
                                            }`}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>

                {/* Card Container */}
                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-10">
                    <Form
                        {...store.form()}
                        resetOnSuccess={['password', 'password_confirmation']}
                        disableWhileProcessing
                        className="flex flex-col gap-6"
                        onSubmit={(event) => {
                            if (step < WIZARD_STEPS.length) {
                                event.preventDefault();
                                handleNext();
                            }
                        }}
                    >
                        {({ processing, errors }) => {
                            return (
                                <>
                                    {/* Step Header inside card */}
                                    <div className="mb-6">
                                        <span className="text-xs font-bold tracking-widest text-[#c1272d] uppercase">
                                            {stepHeader.eyebrow}
                                        </span>
                                        <h2 className="mt-1 font-sans text-2xl font-bold text-zinc-950">
                                            {stepHeader.title}
                                        </h2>
                                        <p className="mt-1 text-sm text-zinc-500">
                                            {stepHeader.description}
                                        </p>
                                    </div>

                                    <input
                                        type="hidden"
                                        name="role"
                                        value={formData.role}
                                    />
                                    <input
                                        type="hidden"
                                        name="name"
                                        value={formData.name}
                                    />
                                    <input
                                        type="hidden"
                                        name="email"
                                        value={formData.email}
                                    />
                                    <input
                                        type="hidden"
                                        name="mobile"
                                        value={formData.mobile}
                                    />
                                    <input
                                        type="hidden"
                                        name="password"
                                        value={formData.password}
                                    />
                                    <input
                                        type="hidden"
                                        name="password_confirmation"
                                        value={formData.password_confirmation}
                                    />
                                    <input
                                        type="hidden"
                                        name="address"
                                        value={formData.address}
                                    />
                                    <input
                                        type="hidden"
                                        name="suburb"
                                        value={formData.suburb}
                                    />
                                    <input
                                        type="hidden"
                                        name="state"
                                        value={formData.state}
                                    />
                                    <input
                                        type="hidden"
                                        name="postcode"
                                        value={formData.postcode}
                                    />
                                    <input
                                        type="hidden"
                                        name="latitude"
                                        value={formData.latitude ?? ''}
                                    />
                                    <input
                                        type="hidden"
                                        name="longitude"
                                        value={formData.longitude ?? ''}
                                    />

                                    <div className="grid gap-6">
                                        {step === 1 && (
                                            <div className="grid gap-4">
                                                <div className="grid gap-2">
                                                    <Label
                                                        htmlFor="role"
                                                        className="font-sans font-semibold text-zinc-900"
                                                    >
                                                        I am a
                                                    </Label>
                                                    <select
                                                        id="role"
                                                        value={formData.role}
                                                        onChange={(e) =>
                                                            setField(
                                                                'role',
                                                                e.target
                                                                    .value as Role,
                                                            )
                                                        }
                                                        title="Select account role"
                                                        className="flex h-11 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-3 py-1 font-sans text-base font-medium text-zinc-900 shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:ring-destructive/40"
                                                    >
                                                        <option value="sender">
                                                            Sender
                                                        </option>
                                                        <option value="recipient">
                                                            Receiver
                                                        </option>
                                                    </select>
                                                    <InputError
                                                        message={
                                                            stepErrors.role ??
                                                            errors.role
                                                        }
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {step === 2 && (
                                            <div className="grid gap-4">
                                                <div className="grid gap-2">
                                                    <Label
                                                        htmlFor="name"
                                                        className="font-sans font-semibold text-zinc-900"
                                                    >
                                                        Full name
                                                    </Label>
                                                    <Input
                                                        id="name"
                                                        type="text"
                                                        required
                                                        autoFocus
                                                        autoComplete="name"
                                                        value={formData.name}
                                                        onChange={(e) =>
                                                            setField(
                                                                'name',
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="Ryan Sender"
                                                        className="h-11 rounded-lg border-zinc-200 bg-white font-sans text-zinc-900 focus-visible:border-zinc-950 focus-visible:ring-zinc-950/10"
                                                    />
                                                    <InputError
                                                        message={
                                                            stepErrors.name ??
                                                            errors.name
                                                        }
                                                    />
                                                </div>

                                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                                                            required
                                                            autoComplete="email"
                                                            value={
                                                                formData.email
                                                            }
                                                            onChange={(e) =>
                                                                setField(
                                                                    'email',
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="mendozaryan640@gmail.com"
                                                            className="h-11 rounded-lg border-zinc-200 bg-white font-sans text-zinc-900 focus-visible:border-zinc-950 focus-visible:ring-zinc-950/10"
                                                        />
                                                        <InputError
                                                            message={
                                                                stepErrors.email ??
                                                                errors.email
                                                            }
                                                        />
                                                    </div>

                                                    <div className="grid gap-2">
                                                        <Label
                                                            htmlFor="mobile"
                                                            className="font-sans font-semibold text-zinc-900"
                                                        >
                                                            Mobile number
                                                        </Label>
                                                        <PhoneInput
                                                            value={
                                                                formData.mobile
                                                            }
                                                            onChange={(value) =>
                                                                setField(
                                                                    'mobile',
                                                                    value,
                                                                )
                                                            }
                                                            defaultCountryCode={
                                                                formData.role ===
                                                                'recipient'
                                                                    ? 'PH'
                                                                    : 'AU'
                                                            }
                                                            className="h-11 rounded-lg border-zinc-200 bg-white font-sans text-zinc-900 focus-within:border-zinc-950 focus-within:ring-zinc-950/10"
                                                        />
                                                        <InputError
                                                            message={
                                                                stepErrors.mobile ??
                                                                errors.mobile
                                                            }
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                    <div className="grid gap-2">
                                                        <Label
                                                            htmlFor="password"
                                                            className="font-sans font-semibold text-zinc-900"
                                                        >
                                                            Password
                                                        </Label>
                                                        <PasswordInput
                                                            id="password"
                                                            required
                                                            autoComplete="new-password"
                                                            value={
                                                                formData.password
                                                            }
                                                            onChange={(e) =>
                                                                setField(
                                                                    'password',
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="Create a password"
                                                            className="h-11 rounded-lg border-zinc-200 bg-white font-sans text-zinc-900 focus-visible:border-zinc-950 focus-visible:ring-zinc-950/10"
                                                        />
                                                        {/* Password Strength Indicator */}
                                                        <div className="mt-2 flex gap-1.5">
                                                            {[1, 2, 3, 4].map(
                                                                (index) => {
                                                                    let bgColor =
                                                                        'bg-zinc-200';
                                                                    const strength =
                                                                        getPasswordStrength(
                                                                            formData.password,
                                                                        );
                                                                    if (
                                                                        index <=
                                                                        strength
                                                                    ) {
                                                                        if (
                                                                            strength ===
                                                                            1
                                                                        )
                                                                            bgColor =
                                                                                'bg-red-500';
                                                                        else if (
                                                                            strength ===
                                                                            2
                                                                        )
                                                                            bgColor =
                                                                                'bg-orange-500';
                                                                        else if (
                                                                            strength ===
                                                                            3
                                                                        )
                                                                            bgColor =
                                                                                'bg-amber-400';
                                                                        else if (
                                                                            strength ===
                                                                            4
                                                                        )
                                                                            bgColor =
                                                                                'bg-emerald-500';
                                                                    }
                                                                    return (
                                                                        <div
                                                                            key={
                                                                                index
                                                                            }
                                                                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${bgColor}`}
                                                                        />
                                                                    );
                                                                },
                                                            )}
                                                        </div>
                                                        <InputError
                                                            message={
                                                                stepErrors.password ??
                                                                errors.password
                                                            }
                                                        />
                                                    </div>

                                                    <div className="grid gap-2">
                                                        <Label
                                                            htmlFor="password_confirmation"
                                                            className="font-sans font-semibold text-zinc-900"
                                                        >
                                                            Confirm password
                                                        </Label>
                                                        <PasswordInput
                                                            id="password_confirmation"
                                                            required
                                                            autoComplete="new-password"
                                                            value={
                                                                formData.password_confirmation
                                                            }
                                                            onChange={(e) =>
                                                                setField(
                                                                    'password_confirmation',
                                                                    e.target
                                                                        .value,
                                                                )
                                                            }
                                                            placeholder="Re-enter password"
                                                            className="h-11 rounded-lg border-zinc-200 bg-white font-sans text-zinc-900 focus-visible:border-zinc-950 focus-visible:ring-zinc-950/10"
                                                        />
                                                        <InputError
                                                            message={
                                                                stepErrors.password_confirmation ??
                                                                errors.password_confirmation
                                                            }
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {step === 3 && (
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label className="font-sans font-semibold text-zinc-900">
                                                        Pin Your Location
                                                    </Label>
                                                    <p className="mb-2 font-sans text-[13px] text-zinc-500">
                                                        Drag the pin or click on
                                                        the map to set your
                                                        exact coordinates. This
                                                        helps us ensure accurate
                                                        logistics.
                                                    </p>
                                                    <LocationPickerMap
                                                        initialCenter={
                                                            formData.latitude &&
                                                            formData.longitude
                                                                ? [
                                                                      formData.latitude,
                                                                      formData.longitude,
                                                                  ]
                                                                : undefined
                                                        }
                                                        onLocationSelect={(
                                                            lat,
                                                            lng,
                                                            address,
                                                        ) => {
                                                            setField(
                                                                'latitude',
                                                                lat,
                                                            );
                                                            setField(
                                                                'longitude',
                                                                lng,
                                                            );
                                                            if (address) {
                                                                setField(
                                                                    'address',
                                                                    address.address || '',
                                                                );
                                                                setField(
                                                                    'suburb',
                                                                    address.suburb || address.city || '',
                                                                );
                                                                setField(
                                                                    'state',
                                                                    address.province || address.state || '',
                                                                );
                                                                setField(
                                                                    'postcode',
                                                                    address.postcode || '',
                                                                );
                                                            }
                                                        }}
                                                        className="relative z-0 h-64 w-full rounded-xl border border-zinc-200"
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label
                                                        htmlFor="address"
                                                        className="font-sans font-semibold text-zinc-900"
                                                    >
                                                        Street Address
                                                    </Label>
                                                    <Input
                                                        id="address"
                                                        type="text"
                                                        required
                                                        value={formData.address}
                                                        onChange={(e) =>
                                                            setField(
                                                                'address',
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder="123 Example St"
                                                        className="focus-visible:ring-zinc-900/10 h-11 rounded-lg border-zinc-200 bg-white font-sans text-zinc-900 focus-visible:border-zinc-950"
                                                    />
                                                    <InputError
                                                        message={
                                                            stepErrors.address ??
                                                            errors.address
                                                        }
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                    <div className="grid gap-2">
                                                        <Label
                                                            htmlFor="suburb"
                                                            className="font-sans font-semibold text-zinc-900"
                                                        >
                                                            {formData.role ===
                                                            'recipient'
                                                                ? 'City/Municipality'
                                                                : 'Suburb'}
                                                        </Label>
                                                        {formData.role === 'sender' ? (
                                                            <SuburbSelect
                                                                id="suburb"
                                                                value={formData.suburb}
                                                                suburbs={registeredSuburbs}
                                                                onChange={(selectedName, postcode) => {
                                                                    setField('suburb', selectedName);
                                                                    if (postcode) {
                                                                        setField('postcode', postcode);
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <Input
                                                                id="suburb"
                                                                type="text"
                                                                value={formData.suburb}
                                                                onChange={(e) => setField('suburb', e.target.value)}
                                                                placeholder="City"
                                                                className="focus-visible:ring-zinc-900/10 h-11 rounded-lg border-zinc-200 bg-white font-sans text-zinc-900 focus-visible:border-zinc-950"
                                                            />
                                                        )}
                                                        <InputError
                                                            message={
                                                                stepErrors.suburb ??
                                                                errors.suburb
                                                            }
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div className="grid gap-2">
                                                            <Label
                                                                htmlFor="state"
                                                                className="font-sans font-semibold text-zinc-900"
                                                            >
                                                                {formData.role ===
                                                                'recipient'
                                                                    ? 'Province'
                                                                    : 'State'}
                                                            </Label>
                                                            <Input
                                                                id="state"
                                                                type="text"
                                                                value={
                                                                    formData.state
                                                                }
                                                                onChange={(e) =>
                                                                    setField(
                                                                        'state',
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                placeholder={
                                                                    formData.role ===
                                                                    'recipient'
                                                                        ? 'Province'
                                                                        : 'NSW'
                                                                }
                                                                className="focus-visible:ring-zinc-900/10 h-11 rounded-lg border-zinc-200 bg-white font-sans text-zinc-900 focus-visible:border-zinc-950"
                                                            />
                                                            <InputError
                                                                message={
                                                                    stepErrors.state ??
                                                                    errors.state
                                                                }
                                                            />
                                                        </div>
                                                        <div className="grid gap-2">
                                                            <Label
                                                                htmlFor="postcode"
                                                                className="font-sans font-semibold text-zinc-900"
                                                            >
                                                                {formData.role ===
                                                                'recipient'
                                                                    ? 'Zip Code'
                                                                    : 'Postcode'}
                                                            </Label>
                                                            <Input
                                                                id="postcode"
                                                                type="text"
                                                                value={
                                                                    formData.postcode
                                                                }
                                                                onChange={(e) =>
                                                                    setField(
                                                                        'postcode',
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                                placeholder={
                                                                    formData.role ===
                                                                    'recipient'
                                                                        ? '0000'
                                                                        : '2000'
                                                                }
                                                                className="focus-visible:ring-zinc-900/10 h-11 rounded-lg border-zinc-200 bg-white font-sans text-zinc-900 focus-visible:border-zinc-950"
                                                            />
                                                            <InputError
                                                                message={
                                                                    stepErrors.postcode ??
                                                                    errors.postcode
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {step === 4 && (
                                            <div className="space-y-4">
                                                <dl className="grid gap-3 text-sm">
                                                    <div className="grid grid-cols-[140px_1fr] gap-2">
                                                        <dt className="font-sans font-medium text-zinc-500">
                                                            Role
                                                        </dt>
                                                        <dd className="font-sans font-semibold text-zinc-900">
                                                            {
                                                                ROLE_LABELS[
                                                                    formData
                                                                        .role
                                                                ]
                                                            }
                                                        </dd>
                                                    </div>
                                                    <div className="grid grid-cols-[140px_1fr] gap-2">
                                                        <dt className="font-sans font-medium text-zinc-500">
                                                            Full name
                                                        </dt>
                                                        <dd className="font-sans font-semibold text-zinc-900">
                                                            {formData.name ||
                                                                'Not provided'}
                                                        </dd>
                                                    </div>
                                                    <div className="grid grid-cols-[140px_1fr] gap-2">
                                                        <dt className="font-sans font-medium text-zinc-500">
                                                            Email address
                                                        </dt>
                                                        <dd className="font-sans font-semibold text-zinc-900">
                                                            {formData.email ||
                                                                'Not provided'}
                                                        </dd>
                                                    </div>
                                                    <div className="grid grid-cols-[140px_1fr] gap-2">
                                                        <dt className="font-sans font-medium text-zinc-500">
                                                            Mobile number
                                                        </dt>
                                                        <dd className="font-sans font-semibold text-zinc-900">
                                                            {formData.mobile ||
                                                                'Not provided'}
                                                        </dd>
                                                    </div>
                                                    <div className="grid grid-cols-[140px_1fr] gap-2">
                                                        <dt className="font-sans font-medium text-zinc-500">
                                                            Address
                                                        </dt>
                                                        <dd className="font-sans font-semibold text-zinc-900">
                                                            {formData.address ||
                                                                'Not provided'}
                                                        </dd>
                                                    </div>
                                                    <div className="grid grid-cols-[140px_1fr] gap-2">
                                                        <dt className="font-sans font-medium text-zinc-500">
                                                            {formData.role ===
                                                            'recipient'
                                                                ? 'City / Province / Zip Code'
                                                                : 'Suburb / State / Postcode'}
                                                        </dt>
                                                        <dd className="font-sans font-semibold text-zinc-900">
                                                            {[
                                                                formData.suburb,
                                                                formData.state,
                                                                formData.postcode,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' / ') ||
                                                                'Not provided'}
                                                        </dd>
                                                    </div>
                                                </dl>

                                                {Object.keys(errors).length >
                                                    0 && (
                                                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                                                        <p className="font-medium text-destructive">
                                                            Please resolve the
                                                            following:
                                                        </p>
                                                        <ul className="mt-1 list-disc space-y-1 pl-5 text-destructive">
                                                            {Object.entries(
                                                                errors,
                                                            ).map(
                                                                ([
                                                                    field,
                                                                    message,
                                                                ]) => (
                                                                    <li
                                                                        key={
                                                                            field
                                                                        }
                                                                    >
                                                                        {
                                                                            message
                                                                        }
                                                                    </li>
                                                                ),
                                                            )}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Divider */}
                                    <hr className="my-6 border-t border-zinc-200" />

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-between gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleBack}
                                            disabled={step === 1 || processing}
                                            className="flex h-11 items-center gap-2 rounded-lg border-zinc-200 bg-white px-5 font-sans font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900"
                                        >
                                            <ArrowLeft className="size-4" />
                                            Back
                                        </Button>

                                        {step < WIZARD_STEPS.length ? (
                                            <Button
                                                key="continue-button"
                                                type="button"
                                                onClick={handleNext}
                                                disabled={processing}
                                                className="text-zinc-750 flex h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 font-sans font-medium shadow-xs hover:bg-zinc-50 hover:text-zinc-900"
                                            >
                                                Continue
                                                <ArrowRight className="size-4" />
                                            </Button>
                                        ) : (
                                            <Button
                                                key="submit-button"
                                                type="submit"
                                                data-test="register-user-button"
                                                disabled={processing}
                                                className="text-zinc-750 flex h-11 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 font-sans font-medium shadow-xs hover:bg-zinc-50 hover:text-zinc-900"
                                            >
                                                Create account
                                                <ArrowRight className="size-4" />
                                            </Button>
                                        )}
                                    </div>
                                </>
                            );
                        }}
                    </Form>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center font-sans text-sm text-zinc-500">
                    Already have an account?{' '}
                    <TextLink
                        href={login()}
                        className="font-semibold text-[#c1272d] hover:text-[#a01e23]"
                    >
                        Log in
                    </TextLink>
                </div>
            </div>
        </div>
    );
}
