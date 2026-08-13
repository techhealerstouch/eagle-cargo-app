import { Head } from '@inertiajs/react';
import { Bell, Loader2, Mail, MessageSquare, Smartphone, Check, Sparkles } from 'lucide-react';
import Heading from '@/components/common/heading';
import { Label } from '@/components/ui/label';
import { useNotificationPreferences } from '@/hooks/use-notification-preferences';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem, NotificationChannel } from '@/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Alerts & Messages',
        href: '/settings/notifications',
    },
];

const channelIcons: Record<NotificationChannel, typeof Mail> = {
    email: Mail,
    sms: MessageSquare,
    push: Smartphone,
    in_app: Bell,
};

export default function NotificationSettings() {
    const {
        preferences,
        channels,
        categories,
        isLoading,
        isSaving,
        updatePreference,
    } = useNotificationPreferences();

    const groupedPreferences = Object.entries(preferences).reduce(
        (acc, [eventType, pref]) => {
            const category = pref.category;
            if (!acc[category]) {
                acc[category] = [];
            }
            acc[category].push({ eventType, ...pref });
            return acc;
        },
        {} as Record<string, Array<{ eventType: string; label: string; category: string; channels: Record<NotificationChannel, boolean> }>>
    );

    if (isLoading) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Alerts & Messages" />
                <SettingsLayout eyebrow="Account" title="Alerts & Notification Preferences">
                    <div className="flex items-center justify-center py-20 bg-white rounded-3xl border border-brand-warm/20">
                        <Loader2 className="size-8 animate-spin text-brand-rust" />
                    </div>
                </SettingsLayout>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Alerts & Messages" />

            <SettingsLayout
                eyebrow="Account"
                title="Alerts & Messages"
                description="Select your preferred notification channels (Email, SMS, App) for booking updates, tracking events, and payment receipts."
            >
                <div className="space-y-8">
                    {/* Header Channel Bar */}
                    <div className="bg-white p-6 rounded-3xl border border-brand-warm/20 shadow-xs space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-2xl bg-brand-warm/10 flex items-center justify-center text-brand-rust border border-brand-warm/20">
                                    <Bell className="size-5" />
                                </div>
                                <div>
                                    <h3 className="font-serif text-lg font-bold text-zinc-900">Communication Channels</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Toggle channels per event type below.</p>
                                </div>
                            </div>
                            {isSaving && (
                                <div className="flex items-center gap-2 text-xs font-bold text-brand-rust bg-brand-warm/10 px-3 py-1.5 rounded-full border border-brand-warm/20">
                                    <Loader2 className="size-3.5 animate-spin" />
                                    <span>Saving changes...</span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                            {channels.map(channel => {
                                const Icon = channelIcons[channel.value];
                                return (
                                    <div key={channel.value} className="flex items-center gap-3 p-3 rounded-2xl bg-brand-warm/5 border border-brand-warm/15">
                                        <div className="size-8 rounded-xl bg-white flex items-center justify-center text-brand-rust shadow-xs">
                                            <Icon className="size-4" />
                                        </div>
                                        <span className="text-xs font-bold text-zinc-700">{channel.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Preferences grouped by category */}
                    {Object.entries(categories).map(([categoryKey, categoryLabel]) => (
                        <div key={categoryKey} className="bg-white rounded-3xl border border-brand-warm/20 p-6 md:p-8 shadow-xs space-y-6">
                            <div className="flex items-center gap-3 border-b border-brand-warm/10 pb-4">
                                <div className="h-4 w-1 rounded-full bg-brand-rust"></div>
                                <h3 className="font-serif text-base font-bold text-zinc-900">
                                    {categoryLabel}
                                </h3>
                            </div>

                            <div className="space-y-3">
                                {(groupedPreferences[categoryKey] ?? []).map(pref => (
                                    <div
                                        key={pref.eventType}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-brand-warm/15 bg-brand-warm/5 hover:border-brand-warm/30 transition-all gap-4"
                                    >
                                        <Label className="text-xs font-bold text-zinc-900 flex-1 cursor-pointer">
                                            {pref.label}
                                        </Label>

                                        <div className="flex items-center gap-2 self-end sm:self-auto">
                                            {channels.map(channel => {
                                                const Icon = channelIcons[channel.value];
                                                const isEnabled = pref.channels[channel.value];

                                                return (
                                                    <button
                                                        key={channel.value}
                                                        type="button"
                                                        onClick={() => updatePreference(
                                                            pref.eventType,
                                                            channel.value,
                                                            !isEnabled
                                                        )}
                                                        className={cn(
                                                            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 border",
                                                            isEnabled
                                                                ? "bg-brand-rust text-white border-brand-rust shadow-xs"
                                                                : "bg-white text-zinc-400 border-zinc-200 hover:border-brand-warm/40 hover:text-zinc-600"
                                                        )}
                                                        title={`${isEnabled ? 'Disable' : 'Enable'} ${channel.label}`}
                                                    >
                                                        <Icon className="size-3.5" />
                                                        <span className="hidden md:inline text-[10px] uppercase tracking-wider">{channel.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
