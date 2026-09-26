@php
    $booking->loadMissing(['sender', 'boxes.recipient', 'boxes.boxType', 'invoice']);

    $settingsService = app(\App\Services\SettingsService::class);
    $invoiceSettings = $settingsService->getInvoiceSettings();
    $bankName = $invoiceSettings['bankName'] ?? 'Commonwealth Bank';
    $bankBsb = $invoiceSettings['bankBsb'] ?? '064-449';
    $bankAccount = $invoiceSettings['bankAccount'] ?? '1097 5991';
    $accountName = $invoiceSettings['companyName'] ?? config('app.name');

    $sender = $booking->sender;
    $senderName = trim(($sender->first_name ?? '') . ' ' . ($sender->last_name ?? '')) ?: 'there';
    $reference = $booking->reference_number ?? 'Pending reference';
    $pickupDate = $booking->preferred_date?->format('M d, Y') ?? 'To be scheduled';
    $status = $booking->status instanceof \BackedEnum ? $booking->status->value : $booking->status;
    $paymentStatus = $booking->payment_status instanceof \BackedEnum ? $booking->payment_status->value : $booking->payment_status;
    $paymentMethod = $booking->payment_method ? str($booking->payment_method)->replace('_', ' ')->title() : 'To be confirmed';

    $calculatedAmount = $booking->invoice?->amount !== null 
        ? (float) $booking->invoice->amount 
        : ($booking->boxes->isNotEmpty() ? (float) $booking->boxes->sum('price_charged') : null);
    $amount = $calculatedAmount !== null ? 'AUD ' . number_format($calculatedAmount, 2) : 'To be confirmed';

    $isGuest = empty($sender?->user_id);
    $trackingNumber = $booking->boxes->first()?->tracking_number ?? $booking->reference_number;
    $trackingUrl = route('track', ['tracking_number' => $trackingNumber]);
    $paymentUrl = $isGuest && !empty($booking->guest_token)
        ? route('guest.booking.confirmed', ['token' => $booking->guest_token])
        : route('bookings.pay', $booking);
    $declarationUrl = route('track.declaration.form', array_filter([
        'booking' => $booking->id,
        'token' => $booking->guest_token,
    ]));
    $needsDeclaration = $booking->needsDeclaration();
@endphp

<x-mail::message>
# Booking received, {{ $senderName }}

Thanks for booking with {{ config('app.name') }}. We have received your balikbayan box request and our team will review the pickup details shortly.

<x-mail::panel>
**Booking reference:** {{ $reference }}  
**Pickup date:** {{ $pickupDate }}  
**Booking status:** {{ str($status ?? 'pending')->replace('_', ' ')->title() }}  
@if ($paymentStatus === 'paid')
**Payment:** Paid via {{ $paymentMethod }}  
@else
**Payment:** {{ str($paymentStatus ?? 'pending')->replace('_', ' ')->title() }}  
@endif
**Estimated total:** {{ $amount }}
</x-mail::panel>

@if ($booking->boxes->isNotEmpty())
## Boxes in this booking

<x-mail::table>
| Box | Receiver | Destination | Tracking |
| --- | --- | --- | --- |
@foreach ($booking->boxes as $box)
| {{ $box->boxType?->name ?? 'Box' }} | {{ $box->recipient?->name ?? 'Receiver pending' }} | {{ $box->destination ?? 'Destination pending' }} | {{ $box->tracking_number ?? 'Assigned after confirmation' }} |
@endforeach
</x-mail::table>
@endif

@if ($booking->payment_method === 'bank_transfer' && ($paymentStatus ?? null) !== 'paid')
<x-mail::panel>
### Bank Transfer Payment Instructions
Please transfer your payment using the following bank details:

- **Bank Name:** {{ $bankName }}
- **Account Name:** {{ $accountName }}
- **BSB:** {{ $bankBsb }}
- **Account Number:** {{ $bankAccount }}
- **Payment Reference:** **{{ $reference }}** *(Required)*
- **Amount Due:** {{ $amount }}

**Important:** Please enter your booking reference **{{ $reference }}** in the payment description so our team can immediately credit your transfer.

Once transferred, you can upload your deposit receipt or transfer screenshot online:
<x-mail::button :url="$isGuest && !empty($booking->guest_token) ? route('guest.booking.confirmed', ['token' => $booking->guest_token]) : route('bookings.pay', $booking)">
Upload Payment Receipt
</x-mail::button>
</x-mail::panel>
@endif

@if ($needsDeclaration)
<x-mail::panel>
### Customs Declaration (Packing List) Required
Philippine Customs requires each Balikbayan box to have an itemized declaration list before shipment.

You can declare the items packed in your box online at your convenience on or before pickup:
<x-mail::button :url="$declarationUrl">
Fill Out Customs Declaration
</x-mail::button>
</x-mail::panel>
@endif

@if (($paymentStatus ?? null) !== 'paid')
<x-mail::button :url="$paymentUrl">
Complete Payment
</x-mail::button>
@else
<x-mail::button :url="$trackingUrl">
Track Your Box
</x-mail::button>
@endif

@if (($paymentStatus ?? null) !== 'paid')
You can also track your shipment anytime: [Track Your Box]({{ $trackingUrl }}).
@endif

@if ($isGuest)
You can track your shipment anytime using your booking reference on our tracking page. Create an account anytime to manage all your shipments in one place.
@else
You can also view this booking any time from your account dashboard.
@endif

<x-mail::subcopy>
Need help? Reply to this email or contact our support team with booking reference {{ $reference }}.
</x-mail::subcopy>

Warmly,<br>
{{ config('app.name') }}
</x-mail::message>

