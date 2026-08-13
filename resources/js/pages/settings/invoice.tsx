import { Head, useForm } from '@inertiajs/react';
import {
    Settings2,
    Upload,
    FileText,
    Landmark,
    Phone,
    MapPin,
    Building2,
    Trash2,
    Percent,
    Save,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { ChangeEvent, FormEventHandler } from 'react';
import { toast } from 'sonner';
import ImageCropper from '@/components/common/image-cropper';
import UnsavedChangesBar from '@/components/settings/UnsavedChangesBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Billing Details',
        href: '/settings/invoice',
    },
];

interface Setting {
    id: number;
    key: string;
    display_name: string;
    value: string | null;
    group: string;
}

export default function InvoiceSettings({
    settingsList,
}: {
    settingsList: Setting[];
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(
        settingsList.find((s) => s.key === 'invoice_logo')?.value || null,
    );
    const [croppingImage, setCroppingImage] = useState<string | null>(null);
    const [originalFileName, setOriginalFileName] = useState<string | null>(
        null,
    );

    const { data, setData, post, processing, isDirty, reset } = useForm({
        settings: settingsList.map((s) => ({ key: s.key, value: s.value })),
        invoice_logo: null as File | null,
        _method: 'POST',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/settings/invoice', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Billing & invoice settings saved successfully');
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
        const fileName = originalFileName || 'cropped-image.png';
        const croppedFile = new File([croppedBlob], fileName, {
            type: 'image/png',
        });

        setData('invoice_logo', croppedFile);

        const previewUrl = URL.createObjectURL(croppedBlob);
        setLogoPreview(previewUrl);
        setCroppingImage(null);
    };

    const removeLogo = () => {
        setData('invoice_logo', null);
        setLogoPreview(null);
        const logoIndex = data.settings.findIndex(
            (s) => s.key === 'invoice_logo',
        );

        if (logoIndex !== -1) {
            const newSettings = [...data.settings];
            newSettings[logoIndex].value = null;
            setData('settings', newSettings);
        }
    };

    const getIcon = (key: string) => {
        if (key.includes('company')) return Building2;
        if (key.includes('address')) return MapPin;
        if (key.includes('phone') || key.includes('contact')) return Phone;
        if (key.includes('bank')) return Landmark;
        if (key.includes('tax')) return Percent;
        if (key.includes('terms') || key.includes('footer')) return FileText;
        return Settings2;
    };

    const getAutoComplete = (key: string) => {
        if (key.includes('email')) return 'email';
        if (key.includes('phone') || key.includes('mobile') || key.includes('contact')) return 'tel';
        if (key.includes('address') || key.includes('suburb') || key.includes('state')) return 'street-address';
        if (key.includes('company') || key.includes('business')) return 'organization';
        return 'off';
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Billing Details" />

            <SettingsLayout
                eyebrow="Company"
                title="Billing Details & Invoice PDF"
                description="Manage your business details, tax registration, and official receipt logo."
                actions={
                    <div className="flex items-center gap-2">
                        <a
                            href="/settings/invoice/preview"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Button
                                type="button"
                                variant="outline"
                                className="h-9 px-4 rounded-lg border-zinc-200 text-xs font-medium hover:bg-zinc-50"
                            >
                                Preview PDF
                            </Button>
                        </a>
                        <Button
                            onClick={submit}
                            disabled={processing}
                            className="h-9 px-5 rounded-lg bg-brand-rust text-white text-xs font-medium hover:bg-brand-rust/90 flex items-center gap-2"
                        >
                            <Save className="size-3.5" />
                            {processing ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
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
                                <h3 className="text-sm font-semibold text-zinc-900">Official Invoice Logo</h3>
                                <p className="text-xs text-zinc-500">Logo printed at the top of customer receipt PDFs.</p>
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
                                        Upload official logo to print on PDFs. Transparent PNG recommended.
                                    </p>
                                    <input
                                        id="invoice_logo_upload"
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
                                        {logoPreview ? 'Change Logo' : 'Upload Invoice Logo'}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Business Details */}
                        <div className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-4 shadow-2xs">
                            <div className="border-b border-zinc-100 pb-3">
                                <h3 className="text-sm font-semibold text-zinc-900">Business & Payment Details</h3>
                                <p className="text-xs text-zinc-500">Billing name, address, tax registration, and payment terms.</p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {settingsList
                                    .filter(
                                        (s) =>
                                            s.group === 'invoice' &&
                                            s.key !== 'invoice_logo',
                                    )
                                    .map((setting) => {
                                        const index = data.settings.findIndex(
                                            (ds) => ds.key === setting.key,
                                        );

                                        if (index === -1) {
                                            return null;
                                        }

                                        const Icon = getIcon(setting.key);
                                        const isLong =
                                            setting.key === 'invoice_terms' ||
                                            setting.key === 'invoice_address';

                                        return (
                                            <div
                                                key={setting.key}
                                                className={
                                                    isLong
                                                        ? 'space-y-1.5 sm:col-span-2'
                                                        : 'space-y-1.5'
                                                }
                                            >
                                                <Label
                                                    htmlFor={setting.key}
                                                    className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700"
                                                >
                                                    <Icon className="size-3.5 text-zinc-400" />
                                                    {setting.display_name}
                                                </Label>
                                                {isLong ? (
                                                    <textarea
                                                        id={setting.key}
                                                        name={setting.key}
                                                        rows={
                                                            setting.key === 'invoice_terms' ? 3 : 2
                                                        }
                                                        title={setting.display_name}
                                                        placeholder={`Enter ${setting.display_name.toLowerCase()}`}
                                                        className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-xs font-medium transition-all focus:border-brand-rust focus:ring-1 focus:ring-brand-rust focus:outline-none"
                                                        value={data.settings[index].value || ''}
                                                        onChange={(e) => {
                                                            const newSettings = [...data.settings];
                                                            newSettings[index].value = e.target.value;
                                                            setData('settings', newSettings);
                                                        }}
                                                    />
                                                ) : (
                                                    <Input
                                                        id={setting.key}
                                                        name={setting.key}
                                                        title={setting.display_name}
                                                        autoComplete={getAutoComplete(setting.key)}
                                                        className="h-10 rounded-lg border-zinc-200 bg-white text-xs font-medium focus-visible:ring-brand-rust"
                                                        value={data.settings[index].value || ''}
                                                        onChange={(e) => {
                                                            const newSettings = [...data.settings];
                                                            newSettings[index].value = e.target.value;
                                                            setData('settings', newSettings);
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
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
