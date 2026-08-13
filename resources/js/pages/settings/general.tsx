import { Head, useForm } from '@inertiajs/react';
import {
    Globe,
    Info,
    Phone,
    Mail,
    Clock,
    Calendar,
    Coins,
    Building2,
    Upload,
    Trash2,
    DollarSign,
    Save,
} from 'lucide-react';
import type { FormEventHandler, ChangeEvent } from 'react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import ImageCropper from '@/components/common/image-cropper';
import UnsavedChangesBar from '@/components/settings/UnsavedChangesBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';

import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Brand & Contact',
        href: '/settings/general',
    },
];

interface Setting {
    key: string;
    display_name: string;
    value: string;
}

const fieldIcons: Record<string, any> = {
    app_name: Building2,
    app_subtitle: Building2,
    app_support_email: Mail,
    app_contact_phone: Phone,
    app_default_currency: Coins,
    app_currency_symbol: DollarSign,
    app_timezone: Clock,
    app_date_format: Calendar,
};

const timezoneOptions = [
    { label: '(UTC+08:00) Manila, Philippines', value: 'Asia/Manila' },
    { label: '(UTC+10:00) Sydney, Australia', value: 'Australia/Sydney' },
    { label: '(UTC+00:00) London, United Kingdom', value: 'Europe/London' },
    { label: '(UTC-05:00) New York, USA', value: 'America/New_York' },
    { label: '(UTC-08:00) Los Angeles, USA', value: 'America/Los_Angeles' },
    { label: 'UTC', value: 'UTC' },
];

const currencyOptions = [
    { label: 'Philippine Peso (PHP)', value: 'PHP' },
    { label: 'US Dollar (USD)', value: 'USD' },
    { label: 'Australian Dollar (AUD)', value: 'AUD' },
    { label: 'Euro (EUR)', value: 'EUR' },
    { label: 'British Pound (GBP)', value: 'GBP' },
];

const dateFormatOptions = [
    { label: 'May 11, 2026 (Month DD, YYYY)', value: 'F j, Y' },
    { label: '11/05/2026 (DD/MM/YYYY)', value: 'd/m/Y' },
    { label: '05/11/2026 (MM/DD/YYYY)', value: 'm/d/Y' },
    { label: '2026-05-11 (YYYY-MM-DD)', value: 'Y-m-d' },
    { label: '11th May 2026 (jS M Y)', value: 'jS M Y' },
];

export default function GeneralSettings({
    settingsList,
}: {
    settingsList: Setting[];
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(
        settingsList.find((s) => s.key === 'app_logo')?.value || null,
    );
    const [croppingImage, setCroppingImage] = useState<string | null>(null);
    const [originalFileName, setOriginalFileName] = useState<string | null>(
        null,
    );

    const { data, setData, post, processing, recentlySuccessful, isDirty, reset } = useForm({
        settings: settingsList.map((s) => ({ key: s.key, value: s.value })),
        app_logo: null as File | null,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/settings/general', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Brand & contact settings saved successfully');
            },
        });
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        if (file) {
            setOriginalFileName(file.name);
            const reader = new FileReader();
            reader.onloadend = () => {
                setCroppingImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const onCropComplete = (croppedBlob: Blob) => {
        const fileName = originalFileName || 'brand-logo.png';
        const croppedFile = new File([croppedBlob], fileName, {
            type: 'image/png',
        });

        setData('app_logo', croppedFile);

        const previewUrl = URL.createObjectURL(croppedBlob);
        setLogoPreview(previewUrl);
        setCroppingImage(null);
    };

    const removeLogo = () => {
        setData('app_logo', null);
        setLogoPreview(null);
        const logoIndex = data.settings.findIndex((s) => s.key === 'app_logo');

        if (logoIndex !== -1) {
            const newSettings = [...data.settings];
            newSettings[logoIndex].value = '';
            setData('settings', newSettings);
        }
    };

    const getFieldIndex = (key: string) =>
        settingsList.findIndex((s) => s.key === key);

    const renderField = (key: string) => {
        const index = getFieldIndex(key);

        if (index === -1) {
            return null;
        }

        const setting = settingsList[index];
        const Icon = fieldIcons[key] || Info;

        return (
            <div key={setting.key} className="space-y-1.5">
                <Label
                    htmlFor={setting.key}
                    className="text-xs font-semibold text-zinc-700"
                >
                    {setting.display_name}
                </Label>
                <div className="relative">
                    <div className="absolute top-1/2 left-3 -translate-y-1/2">
                        <Icon className="size-3.5 text-zinc-400" />
                    </div>
                    <Input
                        id={setting.key}
                        className="h-10 rounded-lg border-zinc-200 bg-white pl-9 text-xs font-medium focus-visible:ring-brand-rust"
                        value={data.settings[index].value || ''}
                        onChange={(e) => {
                            const newSettings = [...data.settings];
                            newSettings[index].value = e.target.value;
                            setData('settings', newSettings);
                        }}
                    />
                </div>
            </div>
        );
    };

    const renderSelectField = (
        key: string,
        options: { label: string; value: string }[],
    ) => {
        const index = getFieldIndex(key);

        if (index === -1) {
            return null;
        }

        const setting = settingsList[index];
        const Icon = fieldIcons[key] || Info;
        const currentValue = data.settings[index].value || '';

        return (
            <div key={setting.key} className="space-y-1.5">
                <Label
                    htmlFor={setting.key}
                    className="text-xs font-semibold text-zinc-700"
                >
                    {setting.display_name}
                </Label>
                <div className="relative">
                    <div className="absolute top-1/2 left-3 z-10 -translate-y-1/2">
                        <Icon className="size-3.5 text-zinc-400" />
                    </div>
                    <Select
                        value={currentValue}
                        onValueChange={(value) => {
                            const newSettings = [...data.settings];
                            newSettings[index].value = value;
                            setData('settings', newSettings);
                        }}
                    >
                        <SelectTrigger className="h-10 w-full rounded-lg border-zinc-200 bg-white pl-9 text-xs font-medium shadow-none focus:ring-brand-rust">
                            <SelectValue
                                placeholder={`Select ${setting.display_name}`}
                            />
                        </SelectTrigger>
                        <SelectContent className="rounded-lg border-zinc-200 shadow-lg">
                            {options.map((opt) => (
                                <SelectItem
                                    key={opt.value}
                                    value={opt.value}
                                    className="rounded-md text-xs py-2 focus:bg-zinc-100"
                                >
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Brand & Contact" />

            <SettingsLayout
                eyebrow="Company"
                title="Brand & Contact Details"
                description="Manage your business identity, logo, and communication defaults."
                actions={
                    <Button
                        onClick={submit}
                        disabled={processing}
                        className="h-9 px-5 rounded-lg bg-brand-rust text-white text-xs font-medium hover:bg-brand-rust/90 flex items-center gap-2"
                    >
                        <Save className="size-3.5" />
                        {processing ? 'Saving...' : 'Save Changes'}
                    </Button>
                }
            >
                <div className="max-w-3xl">
                    {croppingImage && (
                        <ImageCropper
                            image={croppingImage}
                            open={!!croppingImage}
                            onClose={() => setCroppingImage(null)}
                            onCropComplete={onCropComplete}
                            aspectRatio={1}
                        />
                    )}

                    <form onSubmit={submit} className="space-y-6">
                        {/* Logo Section */}
                        <div className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-4 shadow-2xs">
                            <div className="border-b border-zinc-100 pb-3">
                                <h3 className="text-sm font-semibold text-zinc-900">
                                    Brand Identity & Logo
                                </h3>
                                <p className="text-xs text-zinc-500">
                                    Primary logo displayed on tracking portals, notifications, and navigation headers.
                                </p>
                            </div>

                            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
                                <div className="group relative shrink-0">
                                    <div className="flex size-24 items-center justify-center overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50">
                                        {logoPreview ? (
                                            <img
                                                src={logoPreview}
                                                alt="Logo Preview"
                                                className="max-h-full max-w-full object-contain p-2"
                                            />
                                        ) : (
                                            <div className="space-y-1 p-2 text-center">
                                                <Upload className="mx-auto size-5 text-zinc-400" />
                                                <p className="text-[10px] font-medium text-zinc-400">
                                                    No Logo
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    {logoPreview && (
                                        <button
                                            type="button"
                                            onClick={removeLogo}
                                            className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-red-500 text-white shadow-xs hover:bg-red-600"
                                        >
                                            <Trash2 className="size-3" />
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <p className="text-xs text-zinc-500 leading-relaxed">
                                        Recommended format: Square SVG or transparent PNG under 2MB.
                                    </p>

                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        className="hidden"
                                        accept="image/*"
                                    />

                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="h-9 rounded-lg border-zinc-200 px-4 text-xs font-medium hover:bg-zinc-50"
                                    >
                                        {logoPreview ? 'Change Brand Logo' : 'Upload Brand Logo'}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Communication Details */}
                        <div className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-4 shadow-2xs">
                            <div className="border-b border-zinc-100 pb-3">
                                <h3 className="text-sm font-semibold text-zinc-900">
                                    Communication Details
                                </h3>
                                <p className="text-xs text-zinc-500">
                                    Public business contact info shown to customers.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {renderField('app_name')}
                                {renderField('app_subtitle')}
                                {renderField('app_support_email')}
                                {renderField('app_contact_phone')}
                            </div>
                        </div>

                        {/* Regional Defaults */}
                        <div className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-4 shadow-2xs">
                            <div className="border-b border-zinc-100 pb-3">
                                <h3 className="text-sm font-semibold text-zinc-900">
                                    Localization & Regional Defaults
                                </h3>
                                <p className="text-xs text-zinc-500">
                                    Default timezone, currency, and date formats.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {renderSelectField('app_default_currency', currencyOptions)}
                                {renderField('app_currency_symbol')}
                                {renderSelectField('app_timezone', timezoneOptions)}
                                {renderSelectField('app_date_format', dateFormatOptions)}
                            </div>
                        </div>

                        <UnsavedChangesBar
                            isDirty={isDirty}
                            processing={processing}
                            onReset={reset}
                        />
                    </form>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
