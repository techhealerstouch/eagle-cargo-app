@php
    $booking->loadMissing(['sender', 'boxes.recipient', 'boxes.boxType', 'invoice']);

    $sender = $booking->sender;
    $senderName = trim(($sender->first_name ?? '') . ' ' . ($sender->last_name ?? '')) ?: 'there';
    $reference = $booking->reference_number ?? 'Pending reference';
    $pickupDate = $booking->preferred_date?->format('M d, Y') ?? 'To be scheduled';
    $status = $booking->status instanceof \BackedEnum ? $booking->status->value : $booking->status;
    $paymentStatus = $booking->payment_status instanceof \BackedEnum ? $booking->payment_status->value : $booking->payment_status;
    $paymentMethod = $booking->payment_method ? str($booking->payment_method)->replace('_', ' ')->title() : 'To be confirmed';
    $amount = $booking->invoice?->amount !== null ? 'AUD ' . number_format((float) $booking->invoice->amount, 2) : 'To be confirmed';
    $paymentUrl = route('bookings.pay', $booking);
    $trackingUrl = route('track', ['tracking_number' => $booking->boxes->first()?->tracking_number]);
@endphp

<x-mail::message>
# Booking received, {{ $senderName }}

Thanks for booking with {{ config('app.name') }}. We have received your balikbayan box request and our team will review the pickup details shortly.

<x-mail::panel>
**Booking reference:** {{ $reference }}  
**Pickup date:** {{ $pickupDate }}  
**Booking status:** {{ str($status ?? 'pending')->replace('_', ' ')->title() }}  
**Payment:** {{ str($paymentStatus ?? 'pending')->replace('_', ' ')->title() }} via {{ $paymentMethod }}  
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

@if (($paymentStatus ?? null) !== 'paid')
<x-mail::button :url="$paymentUrl">
Complete Payment
</x-mail::button>
@else
<x-mail::button :url="$trackingUrl">
Track Your Box
</x-mail::button>
@endif

You can also view this booking any time from your account dashboard.

<x-mail::subcopy>
Need help? Reply to this email or contact our support team with booking reference {{ $reference }}.
</x-mail::subcopy>

Warmly,<br>
{{ config('app.name') }}
</x-mail::message>
