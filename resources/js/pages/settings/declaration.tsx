import { Head, useForm } from '@inertiajs/react';
import { Save, FileCheck, Info } from 'lucide-react';
import type { FormEventHandler } from 'react';
import { toast } from 'sonner';
import UnsavedChangesBar from '@/components/settings/UnsavedChangesBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';

import type { BreadcrumbItem } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Declaration Form',
        href: '/settings/declaration',
    },
];

interface Setting {
    key: string;
    display_name: string;
    value: string | boolean;
}

export default function DeclarationSettings({
    settingsList,
    logo,
}: {
    settingsList: Setting[];
    logo?: string | null;
}) {
    const { data, setData, post, processing, recentlySuccessful, isDirty, reset } = useForm({
        settings: settingsList.map((s) => ({
            key: s.key,
            value:
                s.key === 'declaration_require_signature'
                    ? s.value === '1' || s.value === true
                    : s.value,
        })),
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/settings/declaration', {
            preserveScroll: true,
            onSuccess: () => {
                toast.success('Declaration form settings saved successfully');
            },
        });
    };

    const getFieldIndex = (key: string) =>
        data.settings.findIndex((s: any) => s.key === key);

    const getValue = (key: string) => {
        const index = getFieldIndex(key);

        return index !== -1 ? data.settings[index].value : '';
    };

    const setValue = (key: string, value: string | boolean) => {
        const index = getFieldIndex(key);

        if (index !== -1) {
            const newSettings = [...data.settings];
            newSettings[index].value = value;
            setData('settings', newSettings);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Declaration Form Settings" />

            <SettingsLayout
                eyebrow="Company"
                title="Customs Declaration Form"
                description="Live interactive canvas editor to customize header title, packing rules, legal notices, and signature requirements."
                actions={
                    <Button
                        onClick={submit}
                        disabled={processing}
                        className="bg-brand-rust text-white hover:opacity-95 px-8 h-12 rounded-xl text-xs font-bold shadow-xl shadow-brand-rust/20 transition-all flex items-center gap-2"
                    >
                        <Save className="size-4" />
                        {processing ? 'Saving...' : 'Save Changes'}
                    </Button>
                }
            >
                <form onSubmit={submit} className="relative pb-24">
                    <div className="mx-auto mb-6 max-w-[21cm]">
                        <div className="rounded-2xl border border-brand-warm/20 bg-brand-warm/5 p-4 flex items-center gap-3">
                            <div className="size-8 rounded-xl bg-brand-rust/10 flex items-center justify-center text-brand-rust shrink-0">
                                <FileCheck className="size-4" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-zinc-900">Interactive WYSIWYG Live Canvas</p>
                                <p className="text-[11px] text-muted-foreground">
                                    Click any dashed border input on the declaration document below to edit heading text, subtext, or rules in real time.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="declaration-page relative mx-auto max-w-[21cm] overflow-hidden border-[3px] border-black bg-white p-10 shadow-2xl rounded-sm">
                        {/* Header Section */}
                        <div className="mb-10 flex items-start justify-between border-b-4 border-black pb-8">
                            <div className="flex flex-1 items-start gap-6">
                                <div className="shrink-0 items-start justify-start p-1">
                                    {logo ? (
                                        <div className="flex h-24 w-24 items-center justify-center">
                                            <img
                                                src={logo}
                                                alt="Logo"
                                                className="max-h-full max-w-full object-contain"
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-0.5">
                                            <div className="text-2xl leading-none font-black tracking-tighter text-[#1e3a8a]">
                                                love{' '}
                                                <span className="text-[#dc2626]">
                                                    balikbayan
                                                </span>
                                            </div>
                                            <div className="text-[7px] font-bold tracking-[0.2em] text-zinc-400 uppercase">
                                                Door to Door Sea Cargo
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 space-y-2 pr-8">
                                    <Input
                                        className="h-12 w-full rounded-none border-2 border-dashed border-zinc-300 text-4xl leading-none font-black tracking-tighter uppercase focus-visible:ring-black"
                                        value={
                                            getValue(
                                                'declaration_header_text',
                                            ) as string
                                        }
                                        onChange={(e) =>
                                            setValue(
                                                'declaration_header_text',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="HEADER TEXT"
                                    />
                                    <Input
                                        className="h-8 w-full rounded-none border-2 border-dashed border-zinc-300 text-xs font-bold tracking-[0.3em] text-zinc-500 uppercase focus-visible:ring-black"
                                        value={
                                            getValue(
                                                'declaration_subtitle',
                                            ) as string
                                        }
                                        onChange={(e) =>
                                            setValue(
                                                'declaration_subtitle',
                                                e.target.value,
                                            )
                                        }
                                        placeholder="SUBTITLE"
                                    />
                                    <div className="mt-4 space-y-1">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-800">
                                            <span>Drop Off/ Pickup Date:</span>
                                            <div className="h-4 min-w-30 flex-1 border-b border-black px-2 text-[10px]">
                                                {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-800">
                                            <span>How Many Boxes:</span>
                                            <div className="h-4 min-w-20 flex-1 border-b border-black px-2 text-[10px]">
                                                1
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-800">
                                            <span>Month and Batch #:</span>
                                            <div className="h-4 min-w-25 flex-1 border-b border-black px-2 text-[10px]">
                                                {new Date().toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).replace(' ', '-').toUpperCase()}-001
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex h-full w-48 shrink-0 flex-col items-end justify-end pt-16 text-right">
                                <p className="mb-1 text-[10px] font-black tracking-widest text-zinc-400 uppercase">
                                    Booking Reference
                                </p>
                                <p className="text-sx leading-none font-black tracking-tighter text-zinc-300">
                                    _____-_____
                                </p>
                                <Input
                                    className="mt-2 h-6 rounded-none border-2 border-dashed border-zinc-300 text-right text-[9px] font-bold text-zinc-400 uppercase focus-visible:ring-black"
                                    value={
                                        getValue(
                                            'declaration_form_info',
                                        ) as string
                                    }
                                    onChange={(e) =>
                                        setValue(
                                            'declaration_form_info',
                                            e.target.value,
                                        )
                                    }
                                />
                            </div>
                        </div>

                        {/* Dummy Sections to mimic the form */}
                        <div className="pointer-events-none mb-10 grid grid-cols-2 gap-10 opacity-60 grayscale">
                            <div className="relative min-h-32 border-2 border-black p-5">
                                <h2 className="absolute -top-3 left-4 bg-black px-4 py-1 text-[10px] font-black tracking-widest text-white uppercase ring-4 ring-white">
                                    1. Sender (Exporter)
                                </h2>
                                <div className="mt-4 text-center text-xs font-bold tracking-widest text-zinc-400 uppercase">
                                    Sender details will appear here
                                </div>
                            </div>
                            <div className="relative min-h-32 border-2 border-black p-5">
                                <h2 className="absolute -top-3 left-4 bg-black px-4 py-1 text-[10px] font-black tracking-widest text-white uppercase ring-4 ring-white">
                                    2. Recipient (Consignee)
                                </h2>
                                <div className="mt-4 text-center text-xs font-bold tracking-widest text-zinc-400 uppercase">
                                    Recipient details will appear here
                                </div>
                            </div>
                        </div>

                        <div className="pointer-events-none mb-10 opacity-60 grayscale">
                            <h2 className="mb-6 inline-block bg-black px-5 py-2 text-xs font-black tracking-[0.2em] text-white uppercase">
                                3. Detailed Packing List
                            </h2>
                            <div className="flex min-h-24 items-center justify-center border-2 border-black">
                                <span className="text-xs font-bold tracking-widest text-zinc-400 uppercase">
                                    Item table will appear here
                                </span>
                            </div>
                        </div>

                        {/* Certification & Signatures */}
                        <div className="relative mb-10 overflow-hidden border-2 border-black bg-zinc-50/50 p-8">
                            <div className="pointer-events-none absolute top-0 right-0 -mt-16 -mr-16 h-32 w-32 rotate-45 bg-zinc-100 opacity-50" />

                            <Textarea
                                className="relative z-10 mb-8 min-h-20 w-full rounded-none border-2 border-l-4 border-dashed border-zinc-300 bg-white pl-4 text-xs leading-relaxed text-zinc-600 italic focus-visible:ring-black"
                                value={
                                    getValue(
                                        'declaration_footer_text',
                                    ) as string
                                }
                                onChange={(e) =>
                                    setValue(
                                        'declaration_footer_text',
                                        e.target.value,
                                    )
                                }
                            />

                            <div className="relative z-10 grid grid-cols-2 gap-16">
                                <div className="space-y-8">
                                    <div className="grid grid-cols-2 gap-6 opacity-60">
                                        <div>
                                            <p className="mb-2 text-[9px] font-black text-zinc-400 uppercase">
                                                Date Signed
                                            </p>
                                            <p className="min-h-6 border-b-2 border-black pb-1"></p>
                                        </div>
                                        <div>
                                            <p className="mb-2 text-[9px] font-black text-zinc-400 uppercase">
                                                Printed Name
                                            </p>
                                            <p className="min-h-6 border-b-2 border-black pb-1"></p>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute top-0 right-0 -mt-6 flex items-center gap-2 rounded-md border border-zinc-200 bg-white p-1 shadow-sm">
                                            <span className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
                                                Enable
                                            </span>
                                            <Switch
                                                checked={
                                                    getValue(
                                                        'declaration_require_signature',
                                                    ) as boolean
                                                }
                                                onCheckedChange={(c) =>
                                                    setValue(
                                                        'declaration_require_signature',
                                                        c,
                                                    )
                                                }
                                            />
                                        </div>
                                        <p className="mb-2 text-[9px] font-black text-zinc-400 uppercase">
                                            Sender's Signature
                                        </p>
                                        <div
                                            className={`flex min-h-25 w-full items-center justify-center border-b-2 border-black bg-white ${!(getValue('declaration_require_signature') as boolean) ? 'opacity-30' : ''}`}
                                        >
                                            <span className="text-[10px] font-black tracking-widest text-zinc-200 uppercase italic">
                                                Physical Signature Required
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-8 opacity-60">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <p className="mb-2 text-[9px] font-black text-zinc-400 uppercase">
                                                Date Verified
                                            </p>
                                            <p className="min-h-6 border-b-2 border-black pb-1"></p>
                                        </div>
                                        <div>
                                            <p className="mb-2 text-[9px] font-black text-zinc-400 uppercase">
                                                Officer Name
                                            </p>
                                            <p className="min-h-6 border-b-2 border-black pb-1"></p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="mb-2 text-[9px] font-black text-zinc-400 uppercase">
                                            Authorized Personnel Signature
                                        </p>
                                        <div className="relative min-h-25 w-full border-b-2 border-black bg-white">
                                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-5">
                                                <p className="-rotate-12 border-4 border-black px-4 text-3xl font-black uppercase">
                                                    Approved
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-end justify-between border-t border-zinc-100 pt-6">
                            <div className="flex items-center gap-4 opacity-60">
                                <div className="font-mono text-[8px] leading-tight text-zinc-400 uppercase">
                                    <p>
                                        Digital Signature ID: ________________
                                    </p>
                                    <p>Compliance Level: SECURE-A1</p>
                                </div>
                            </div>
                            <div className="w-1/2 space-y-1 text-right">
                                <Input
                                    className="h-6 rounded-none border-2 border-dashed border-zinc-300 text-right text-[10px] leading-none font-black tracking-widest text-zinc-900 uppercase focus-visible:ring-black"
                                    value={
                                        getValue(
                                            'declaration_brand_name',
                                        ) as string
                                    }
                                    onChange={(e) =>
                                        setValue(
                                            'declaration_brand_name',
                                            e.target.value,
                                        )
                                    }
                                />
                                <div className="flex items-center justify-end gap-1">
                                    <span className="text-[8px] font-bold tracking-tighter whitespace-nowrap text-zinc-400 uppercase">
                                        Printed: [DATE] —{' '}
                                    </span>
                                    <Input
                                        className="h-5 w-32 rounded-none border-2 border-dashed border-zinc-300 px-1 text-right text-[8px] font-bold tracking-tighter text-zinc-400 uppercase focus-visible:ring-black"
                                        value={
                                            getValue(
                                                'declaration_origin_location',
                                            ) as string
                                        }
                                        onChange={(e) =>
                                            setValue(
                                                'declaration_origin_location',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mx-auto mt-8 max-w-[21cm] space-y-2 px-4 text-[10px] leading-normal text-zinc-400">
                        <Input
                            className="h-6 w-64 rounded-none border-2 border-dashed border-zinc-300 bg-transparent px-1 font-black tracking-widest text-zinc-500 uppercase focus-visible:ring-black"
                            value={
                                getValue(
                                    'declaration_prohibited_title',
                                ) as string
                            }
                            onChange={(e) =>
                                setValue(
                                    'declaration_prohibited_title',
                                    e.target.value,
                                )
                            }
                        />
                        <Textarea
                            className="min-h-15 rounded-none border-2 border-dashed border-zinc-300 bg-transparent italic focus-visible:ring-black"
                            value={
                                getValue(
                                    'declaration_prohibited_notice',
                                ) as string
                            }
                            onChange={(e) =>
                                setValue(
                                    'declaration_prohibited_notice',
                                    e.target.value,
                                )
                            }
                        />
                    </div>

                    <UnsavedChangesBar
                        isDirty={isDirty}
                        processing={processing}
                        onReset={reset}
                    />
                </form>
            </SettingsLayout>
        </AppLayout>
    );
}
