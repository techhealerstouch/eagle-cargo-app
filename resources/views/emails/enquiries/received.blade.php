@php
    $enquiryName = $enquiry->name ?? 'Website visitor';
    $adminUrl = isset($enquiry) && $enquiry->exists ? route('admin.enquiries.show', $enquiry) : route('admin.enquiries.index');
@endphp

<x-mail::message>
# New website enquiry

Someone sent a message from the contact form.

<x-mail::panel>
**Name:** {{ $enquiryName }}  
**Email:** {{ $enquiry->email ?? 'Not provided' }}  
**Mobile:** {{ $enquiry->mobile ?? 'Not provided' }}
</x-mail::panel>

@if (! empty($enquiry->message))
## Message

{{ $enquiry->message }}
@endif

<x-mail::button :url="$adminUrl">
Open Enquiry
</x-mail::button>

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
