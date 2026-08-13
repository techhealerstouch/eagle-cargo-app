import { Transition } from '@headlessui/react';
import { Form, Head, Link, usePage } from '@inertiajs/react';
import { AlertCircle, Mail, MapPin, Phone, ShieldCheck, Save } from 'lucide-react';
import * as React from 'react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import InputError from '@/components/common/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LocationPickerMap from '@/components/ui/LocationPickerMap';
import PhoneInput from '@/components/ui/PhoneInput';
import { COUNTRIES } from '@/lib/countries';
import { SuburbSelect } from '@/components/ui/SuburbSelect';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit } from '@/routes/profile';
import { send } from '@/routes/verification';
import type { BreadcrumbItem, User } from '@/types';

interface Sender {
    id: number;
    user_id: number;
    country: string;
    mobile: string;
    address: string;
    suburb: string;
    state: string;
    postcode: string;
    latitude?: number | null;
    longitude?: number | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Settings',
        href: edit(),
    },
    {
        title: 'Personal Info',
        href: edit(),
    },
];

type SuburbOption = { name: string; postcode: string };

export default function Profile({
    mustVerifyEmail,
    sender,
    registeredSuburbs,
}: {
    mustVerifyEmail: boolean;
    status?: string;
    sender?: Sender | null;
    registeredSuburbs?: SuburbOption[];
}) {
    const { auth } = usePage().props as { auth: { user: User } };
    const [selectedCountry, setSelectedCountry] = React.useState(
        sender?.country || 'Australia',
    );
    const [selectedState, setSelectedState] = React.useState(
        sender?.state || '',
    );
    const [latitude, setLatitude] = React.useState<number | null>(
        sender?.latitude != null ? Number(sender.latitude) : null,
    );
    const [longitude, setLongitude] = React.useState<number | null>(
        sender?.longitude != null ? Number(sender.longitude) : null,
    );
    const [address, setAddress] = React.useState(sender?.address || '');
    const [suburb, setSuburb] = React.useState(sender?.suburb || '');
    const [postcode, setPostcode] = React.useState(sender?.postcode || '');
    const [mobile, setMobile] = React.useState(sender?.mobile || '');
    const [gpsAutoFilled, setGpsAutoFilled] = React.useState(false);

    const detectedCountryCode = COUNTRIES.find(c => c.name === selectedCountry)?.code || 'AU';

    const AU_STATES = [
        { label: 'ACT', value: 'ACT' },
        { label: 'NSW', value: 'NSW' },
        { label: 'NT', value: 'NT' },
        { label: 'QLD', value: 'QLD' },
        { label: 'SA', value: 'SA' },
        { label: 'TAS', value: 'TAS' },
        { label: 'VIC', value: 'VIC' },
        { label: 'WA', value: 'WA' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Personal Info" />

            <SettingsLayout
                eyebrow="Account"
                title="Personal Info"
                description="Update your contact details and default address location."
            >
                <div className="max-w-3xl">
                    <Form
                        {...ProfileController.update.form()}
                        options={{
                            preserveScroll: true,
                        }}
                        className="space-y-6"
                    >
                        {({ processing, recentlySuccessful, errors }) => (
                            <>
                                {/* Personal Info */}
                                <div className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-4 shadow-2xs">
                                    <div className="border-b border-zinc-100 pb-3">
                                        <h3 className="text-sm font-semibold text-zinc-900">
                                            Account Contact Details
                                        </h3>
                                        <p className="text-xs text-zinc-500">
                                            Your primary profile information.
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="name" className="text-xs font-semibold text-zinc-700">
                                                Full Name
                                            </Label>
                                            <Input
                                                id="name"
                                                className="h-10 rounded-lg border-zinc-200 bg-white text-xs font-medium focus-visible:ring-brand-rust"
                                                defaultValue={auth.user.name}
                                                name="name"
                                                required
                                                autoComplete="name"
                                                placeholder="Full name"
                                            />
                                            <InputError message={errors.name} />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="email" className="text-xs font-semibold text-zinc-700">
                                                Email Address
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    className="h-10 rounded-lg border-zinc-200 bg-white pr-9 text-xs font-medium focus-visible:ring-brand-rust"
                                                    defaultValue={auth.user.email}
                                                    name="email"
                                                    required
                                                    autoComplete="username"
                                                    placeholder="Email address"
                                                />
                                                <div className="absolute top-1/2 right-3 -translate-y-1/2">
                                                    <Mail className="size-3.5 text-zinc-400" />
                                                </div>
                                            </div>
                                            <InputError message={errors.email} />
                                        </div>
                                    </div>
                                </div>

                                {/* Address Information */}
                                <div className="rounded-xl border border-zinc-200/80 bg-white p-5 space-y-4 shadow-2xs">
                                    <div className="border-b border-zinc-100 pb-3">
                                        <h3 className="text-sm font-semibold text-zinc-900">
                                            Default Pickup & Home Address
                                        </h3>
                                        <p className="text-xs text-zinc-500">
                                            Set your address or pick your location on the map.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold text-zinc-700">
                                                Pin Location on Map
                                            </Label>
                                            <LocationPickerMap
                                                initialCenter={
                                                    latitude && longitude
                                                        ? [latitude, longitude]
                                                        : undefined
                                                }
                                                onLocationSelect={(lat, lng, addr) => {
                                                    setLatitude(lat);
                                                    setLongitude(lng);

                                                    if (addr) {
                                                        setAddress(addr.address || '');
                                                        setSuburb(addr.suburb || addr.city || '');
                                                        setPostcode(addr.postcode || '');

                                                        const countryMap: Record<string, string> = {
                                                            Australia: 'Australia',
                                                            Philippines: 'Philippines',
                                                            'New Zealand': 'New Zealand',
                                                            Singapore: 'Singapore',
                                                        };
                                                        const detectedCountry = countryMap[addr.country] || selectedCountry;

                                                        if (detectedCountry !== selectedCountry) {
                                                            setSelectedCountry(detectedCountry);
                                                        }

                                                        if (detectedCountry === 'Australia') {
                                                            setSelectedState(addr.state || '');
                                                        } else {
                                                            setSelectedState(addr.province || addr.state || '');
                                                        }

                                                        setGpsAutoFilled(true);
                                                        setTimeout(() => setGpsAutoFilled(false), 3000);
                                                    }
                                                }}
                                                className="relative z-0 h-56 w-full rounded-lg border border-zinc-200"
                                            />
                                            <input type="hidden" name="latitude" value={latitude ?? ''} />
                                            <input type="hidden" name="longitude" value={longitude ?? ''} />

                                            {gpsAutoFilled && (
                                                <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5">
                                                    <MapPin className="size-3.5 text-emerald-600 shrink-0" />
                                                    <p className="text-xs font-semibold text-emerald-700">
                                                        Address fields filled in from the map.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="country" className="text-xs font-semibold text-zinc-700">
                                                    Country
                                                </Label>
                                                <Select
                                                    defaultValue={selectedCountry}
                                                    onValueChange={setSelectedCountry}
                                                    name="country"
                                                >
                                                    <SelectTrigger className="h-10 rounded-lg border-zinc-200 bg-white text-xs font-medium">
                                                        <SelectValue placeholder="Select Country" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-lg border-zinc-200 bg-white text-xs">
                                                        <SelectItem value="Australia">Australia</SelectItem>
                                                        <SelectItem value="Philippines">Philippines</SelectItem>
                                                        <SelectItem value="New Zealand">New Zealand</SelectItem>
                                                        <SelectItem value="Singapore">Singapore</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <input type="hidden" name="country" value={selectedCountry} />
                                                <InputError message={errors.country} />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="mobile" className="text-xs font-semibold text-zinc-700">
                                                    Mobile Number
                                                </Label>
                                                <PhoneInput
                                                    name="mobile"
                                                    value={mobile}
                                                    onChange={setMobile}
                                                    defaultCountryCode={detectedCountryCode}
                                                />
                                                <InputError message={errors.mobile} />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="address" className="text-xs font-semibold text-zinc-700">
                                                Street Address
                                            </Label>
                                            <Input
                                                id="address"
                                                className="h-10 rounded-lg border-zinc-200 bg-white text-xs font-medium focus-visible:ring-brand-rust"
                                                value={address}
                                                onChange={(e) => setAddress(e.target.value)}
                                                name="address"
                                                placeholder="Unit/House No, Street Name"
                                            />
                                            <InputError message={errors.address} />
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="suburb" className="text-xs font-semibold text-zinc-700">
                                                    {selectedCountry === 'Philippines' ? 'City/Municipality' : 'Suburb'}
                                                </Label>
                                                {selectedCountry === 'Australia' ? (
                                                    <SuburbSelect
                                                        id="suburb"
                                                        name="suburb"
                                                        value={suburb}
                                                        suburbs={registeredSuburbs}
                                                        onChange={(selectedName, pc) => {
                                                            setSuburb(selectedName);
                                                            if (pc) {
                                                                setPostcode(pc);
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <Input
                                                        id="suburb"
                                                        className="h-10 rounded-lg border-zinc-200 bg-white text-xs font-medium focus-visible:ring-brand-rust"
                                                        value={suburb}
                                                        onChange={(e) => setSuburb(e.target.value)}
                                                        name="suburb"
                                                        placeholder={selectedCountry === 'Philippines' ? 'City' : 'Suburb'}
                                                    />
                                                )}
                                                <InputError message={errors.suburb} />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="state" className="text-xs font-semibold text-zinc-700">
                                                    {selectedCountry === 'Philippines' ? 'Province' : 'State'}
                                                </Label>
                                                {selectedCountry === 'Australia' ? (
                                                    <>
                                                        <Select
                                                            value={selectedState}
                                                            onValueChange={setSelectedState}
                                                            name="state"
                                                        >
                                                            <SelectTrigger className="h-10 rounded-lg border-zinc-200 bg-white text-xs font-medium">
                                                                <SelectValue placeholder="Select State" />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-lg border-zinc-200 bg-white text-xs">
                                                                {AU_STATES.map((s) => (
                                                                    <SelectItem key={s.value} value={s.value}>
                                                                        {s.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <input type="hidden" name="state" value={selectedState} />
                                                    </>
                                                ) : (
                                                    <Input
                                                        id="state"
                                                        className="h-10 rounded-lg border-zinc-200 bg-white text-xs font-medium focus-visible:ring-brand-rust"
                                                        value={selectedState}
                                                        onChange={(e) => setSelectedState(e.target.value)}
                                                        name="state"
                                                        placeholder={selectedCountry === 'Philippines' ? 'Province' : 'State'}
                                                    />
                                                )}
                                                <InputError message={errors.state} />
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label htmlFor="postcode" className="text-xs font-semibold text-zinc-700">
                                                    {selectedCountry === 'Philippines' ? 'Zip Code' : 'Postcode'}
                                                </Label>
                                                <Input
                                                    id="postcode"
                                                    className="h-10 rounded-lg border-zinc-200 bg-white text-xs font-medium focus-visible:ring-brand-rust"
                                                    value={postcode}
                                                    onChange={(e) => setPostcode(e.target.value)}
                                                    name="postcode"
                                                    placeholder="0000"
                                                />
                                                <InputError message={errors.postcode} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <Button
                                        type="submit"
                                        disabled={processing}
                                        className="h-9 px-6 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-black flex items-center gap-2"
                                    >
                                        <Save className="size-3.5" />
                                        {processing ? 'Saving...' : 'Save Profile'}
                                    </Button>

                                    {recentlySuccessful && (
                                        <span className="text-xs font-semibold text-emerald-600">
                                            Profile saved successfully!
                                        </span>
                                    )}
                                </div>
                            </>
                        )}
                    </Form>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
