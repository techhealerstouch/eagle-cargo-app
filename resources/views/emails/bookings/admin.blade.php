@php
    $booking->loadMissing(['sender', 'boxes.recipient', 'boxes.boxType', 'invoice']);

    $sender = $booking->sender;
    $senderName = trim(($sender->first_name ?? '') . ' ' . ($sender->last_name ?? '')) ?: 'Unknown sender';
    $senderAddress = collect([$sender->address ?? null, $sender->suburb ?? null, $sender->state ?? null, $sender->postcode ?? null])
        ->filter()
        ->implode(', ');
    $reference = $booking->reference_number ?? 'Pending reference';
    $status = $booking->status instanceof \BackedEnum ? $booking->status->value : $booking->status;
    $paymentStatus = $booking->payment_status instanceof \BackedEnum ? $booking->payment_status->value : $booking->payment_status;
    $amount = $booking->invoice?->amount !== null ? 'AUD ' . number_format((float) $booking->invoice->amount, 2) : 'No invoice yet';
    $adminUrl = route('admin.bookings.show', $booking);
@endphp

<x-mail::message>
# New booking received

A customer has submitted a booking and it is ready for admin review.

<x-mail::panel>
**Reference:** {{ $reference }}  
**Sender:** {{ $senderName }}  
**Mobile:** {{ $sender->mobile ?? 'Not provided' }}  
**Email:** {{ $sender->email ?? 'Not provided' }}  
**Pickup address:** {{ $senderAddress ?: 'Not provided' }}  
**Preferred pickup:** {{ $booking->preferred_date?->format('M d, Y') ?? 'Not selected' }}  
**Status:** {{ str($status ?? 'pending')->replace('_', ' ')->title() }}  
**Payment:** {{ str($paymentStatus ?? 'pending')->replace('_', ' ')->title() }}  
**Invoice total:** {{ $amount }}
</x-mail::panel>

@if ($booking->boxes->isNotEmpty())
## Box summary

<x-mail::table>
| Box | Receiver | Contact | Destination | Tracking |
| --- | --- | --- | --- | --- |
@foreach ($booking->boxes as $box)
| {{ $box->boxType?->name ?? 'Box' }} | {{ $box->recipient?->name ?? 'Receiver pending' }} | {{ $box->recipient?->phone_number ?? $box->recipient?->email ?? 'Not provided' }} | {{ $box->destination ?? 'Destination pending' }} | {{ $box->tracking_number ?? 'Pending' }} |
@endforeach
</x-mail::table>
@endif

<x-mail::button :url="$adminUrl">
Review Booking
</x-mail::button>

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
