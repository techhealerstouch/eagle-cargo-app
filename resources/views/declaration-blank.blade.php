<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Customs Declaration Form - Balikbayan Box</title>
    <style>
        @page {
            margin: 0.75cm 0.9cm;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #1c1917;
            font-family: Helvetica, Arial, sans-serif;
            font-size: 9px;
            line-height: 1.25;
        }

        .page {
            position: relative;
            width: 100%;
            min-height: 100%;
            page-break-inside: avoid;
        }

        .page-break {
            page-break-after: always;
        }

        .layout-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .layout-table td {
            border: 0;
            margin: 0;
            padding: 0;
            vertical-align: top;
        }

        .masthead {
            width: 100%;
            border-collapse: collapse;
            border-bottom: 3px solid #1c1917;
            margin-bottom: 10px;
            table-layout: fixed;
        }

        .masthead td {
            border: 0;
            vertical-align: top;
        }

        .logo {
            width: auto;
            height: 58px;
        }

        .brand-lockup {
            width: 100%;
            border-collapse: collapse;
        }

        .brand-lockup td {
            border: 0;
            padding: 0;
            vertical-align: middle;
        }

        .brand-lockup .logo-cell {
            width: 62px;
            padding-right: 8px;
        }

        .brand-name {
            color: #1c1917;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0;
            line-height: 1.15;
            text-transform: uppercase;
        }

        .brand-text {
            color: #1e3a8a;
            font-size: 20px;
            font-weight: 900;
            line-height: 1;
        }

        .brand-text span {
            color: #dc2626;
        }

        .tagline {
            margin-top: 3px;
            color: #78716c;
            font-size: 7px;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }

        .document-title {
            text-align: center;
        }

        .document-title h1 {
            margin: 0;
            color: #1c1917;
            font-size: 20px;
            font-weight: 900;
            letter-spacing: 0;
            line-height: 1.05;
            text-transform: uppercase;
        }

        .document-title p {
            margin: 4px 0 0;
            color: #57524e;
            font-size: 8px;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-transform: uppercase;
        }

        .form-meta {
            color: #57524e;
            font-size: 7.5px;
            font-weight: 800;
            letter-spacing: 0.08em;
            line-height: 1.45;
            text-align: right;
            text-transform: uppercase;
        }

        .shipment-block {
            border: 1.5px solid #1c1917;
            margin-bottom: 10px;
        }

        .block-title {
            background: #1c1917;
            color: #ffffff;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: 0.1em;
            padding: 4px 6px;
            text-transform: uppercase;
        }

        .metadata-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .metadata-table td {
            border-right: 1px solid #d6d3d1;
            border-bottom: 1px solid #d6d3d1;
            padding: 4px 6px;
            vertical-align: top;
        }

        .metadata-table tr:last-child td {
            border-bottom: 0;
        }

        .metadata-table td:last-child {
            border-right: 0;
        }

        .field-label {
            display: block;
            margin-bottom: 2px;
            color: #78716c;
            font-size: 7px;
            font-weight: 900;
            letter-spacing: 0.06em;
            text-transform: uppercase;
        }

        .field-line {
            min-height: 15px;
            border-bottom: 1px solid #a8a29e;
            color: #1c1917;
            font-size: 10px;
            font-weight: 700;
            line-height: 1.25;
        }

        .field-line.tall {
            min-height: 30px;
        }

        .field-line.compact {
            min-height: 13px;
            font-size: 9px;
        }

        .party-box {
            border: 1.5px solid #1c1917;
            min-height: 128px;
        }

        .party-box .block-title {
            border-bottom: 1.5px solid #1c1917;
        }

        .party-content {
            padding: 6px;
        }

        .field {
            margin-bottom: 5px;
        }

        .section-heading {
            margin: 10px 0 6px;
            border-bottom: 2px solid #1c1917;
            color: #1c1917;
            font-size: 9.5px;
            font-weight: 900;
            letter-spacing: 0.08em;
            padding-bottom: 3px;
            text-transform: uppercase;
        }

        .box-strip {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6px;
            table-layout: fixed;
        }

        .box-strip td {
            border: 0;
            vertical-align: middle;
        }

        .box-strip .line {
            border-bottom: 1px solid #d6d3d1;
            height: 1px;
        }

        .box-strip .box-copy {
            color: #1c1917;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: 0.07em;
            padding: 0 8px;
            text-align: center;
            text-transform: uppercase;
        }

        .items-table {
            width: 100%;
            border: 2px solid #1c1917;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .items-table th {
            background: #f5f5f4;
            border-right: 1px solid #1c1917;
            border-bottom: 2px solid #1c1917;
            color: #1c1917;
            font-size: 7.5px;
            font-weight: 900;
            padding: 3px 4px;
            text-align: center;
            text-transform: uppercase;
        }

        .items-table th:last-child {
            border-right: 0;
        }

        .items-table td {
            border-right: 1px solid #d6d3d1;
            border-bottom: 1px solid #d6d3d1;
            color: #1c1917;
            font-size: 8px;
            height: 17px;
            padding: 2px 4px;
            text-align: center;
            vertical-align: middle;
        }

        .items-table.compact td {
            height: 15px;
        }

        .items-table td:last-child {
            border-right: 0;
        }

        .items-table .left {
            text-align: left;
        }

        .continuation-note {
            margin: 5px 0 0;
            color: #57524e;
            font-size: 7.5px;
            font-style: italic;
            font-weight: 700;
            text-align: center;
        }

        .legal-panel {
            border: 1.5px solid #1c1917;
            margin-top: 8px;
        }

        .legal-panel .legal-content {
            padding: 6px;
        }

        .notice-box {
            background: #fef3c7;
            border: 1px solid #d97706;
            color: #44403c;
            font-size: 7.5px;
            font-weight: 700;
            line-height: 1.35;
            margin-bottom: 5px;
            padding: 5px 6px;
            text-align: justify;
        }

        .notice-box strong {
            color: #1c1917;
            font-weight: 900;
            text-transform: uppercase;
        }

        .cert-copy {
            color: #44403c;
            font-size: 7.8px;
            line-height: 1.35;
            margin: 0 0 5px;
            text-align: justify;
        }

        .signature-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .signature-table td {
            border: 0;
            padding: 0;
            vertical-align: top;
        }

        .signature-box {
            border: 1px solid #1c1917;
            height: 38px;
            position: relative;
            text-align: center;
        }

        .signature-box .placeholder {
            color: #a8a29e;
            display: block;
            font-size: 7px;
            font-weight: 900;
            letter-spacing: 0.08em;
            line-height: 38px;
            text-transform: uppercase;
        }

        .signature-box img {
            display: block;
            margin: 2px auto;
            max-height: 34px;
        }

        .office-box {
            background: #f5f5f4;
            border: 1.5px solid #78716c;
            margin-top: 7px;
            padding: 6px;
        }

        .office-title {
            color: #44403c;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: 0.1em;
            margin-bottom: 5px;
            text-transform: uppercase;
        }

        .dispatch-check {
            display: inline-block;
            height: 10px;
            width: 10px;
            border: 1.5px solid #1c1917;
            margin-right: 4px;
            vertical-align: middle;
        }

        .terms-copy {
            color: #1c1917;
            font-size: 7.7px;
            line-height: 1.32;
            text-align: justify;
        }

        .terms-columns {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .terms-columns td {
            width: 50%;
            border: 0;
            padding: 0;
            vertical-align: top;
        }

        .terms-columns td:first-child {
            padding-right: 12px;
        }

        .terms-columns td:last-child {
            padding-left: 12px;
        }

        .terms-heading {
            break-inside: avoid;
            color: #1c1917;
            font-size: 8.5px;
            font-weight: 900;
            margin: 7px 0 3px;
            page-break-inside: avoid;
            text-transform: uppercase;
        }

        .terms-heading:first-child {
            margin-top: 0;
        }

        .terms-line {
            break-inside: avoid;
            margin-bottom: 3px;
            page-break-inside: avoid;
        }

        .terms-line.subpoint {
            margin-left: 11px;
        }

        .terms-line strong {
            font-weight: 900;
        }

        .footer {
            border-top: 1px solid #d6d3d1;
            color: #a8a29e;
            font-size: 7px;
            font-weight: 800;
            letter-spacing: 0.05em;
            margin-top: 8px;
            padding-top: 5px;
            text-transform: uppercase;
        }

        .footer table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .footer td {
            border: 0;
            padding: 0;
            vertical-align: bottom;
        }

        .footer .right {
            text-align: right;
        }
    </style>
</head>
<body>
@php
    $declarationSettings = $declarationSettings ?? [];
    $requestedBoxCount = $boxCount ?? (isset($boxes) ? $boxes->count() : 1);
    $boxCount = max(1, min(30, (int) $requestedBoxCount));

    $cleanCopy = function ($value, string $fallback = ''): string {
        $text = trim((string) ($value ?? $fallback));

        return str_replace(
            ["SHIPER'S", 'SHIPER', 'SHIPPERS', 'Shippers', 'shippers'],
            ["SHIPPER'S", 'SHIPPER', "SHIPPER'S", "Shipper's", "shipper's"],
            $text
        );
    };

    $formatDate = function ($value): string {
        if (empty($value)) {
            return '';
        }

        try {
            return \Carbon\Carbon::parse($value)->format('d F Y');
        } catch (\Throwable $e) {
            return (string) $value;
        }
    };

    $highlightTerms = function (string $line): string {
        $patterns = [
            '/A\\$300\\.00/i' => '<strong>A\$300.00</strong>',
            '/five \\(5\\) days/i' => '<strong>five (5) days</strong>',
            '/thirty \\(30\\) days/i' => '<strong>thirty (30) days</strong>',
            '/30-day claim filing limit/i' => '<strong>30-day claim filing limit</strong>',
            '/5-day checking period/i' => '<strong>5-day checking period</strong>',
        ];

        return preg_replace(array_keys($patterns), array_values($patterns), $line);
    };

    $loadTermsData = function (): array {
        $path = resource_path('data/declaration-terms.json');
        if (! file_exists($path)) {
            return ['sections' => []];
        }

        $decoded = json_decode(file_get_contents($path), true);

        return is_array($decoded) ? $decoded : ['sections' => []];
    };

    $formatTerms = function (array $sections) use ($highlightTerms): string {
        $html = '';
        foreach ($sections as $section) {
            $title = trim((string) ($section['title'] ?? ''));
            if ($title !== '') {
                $html .= '<div class="terms-heading">' . e($title) . '</div>';
            }

            foreach (($section['paragraphs'] ?? []) as $paragraph) {
                $html .= '<div class="terms-line">' . $highlightTerms(e($paragraph)) . '</div>';
            }

            foreach (($section['items'] ?? []) as $item) {
                $number = trim((string) ($item['number'] ?? ''));
                foreach (($item['paragraphs'] ?? []) as $index => $paragraph) {
                    $prefix = $index === 0 && $number !== '' ? '<strong>' . e($number) . '. </strong>' : '';
                    $html .= '<div class="terms-line">' . $prefix . $highlightTerms(e($paragraph)) . '</div>';
                }

                foreach (($item['subitems'] ?? []) as $subitem) {
                    $letter = trim((string) ($subitem['letter'] ?? ''));
                    $prefix = $letter !== '' ? '<strong>' . e($letter) . '. </strong>' : '';
                    $html .= '<div class="terms-line subpoint">' . $prefix . $highlightTerms(e($subitem['text'] ?? '')) . '</div>';
                }
            }
        }

        return $html ?: '<div class="terms-line">Terms and conditions will be provided by Love Balikbayan Boxes Cargo.</div>';
    };

    $splitTermsColumns = function (array $termsData) use ($formatTerms): array {
        $leftSections = [];
        $rightSections = [];

        foreach ($termsData['sections'] ?? [] as $section) {
            if (strcasecmp((string) ($section['title'] ?? ''), 'Terms and Conditions') === 0) {
                $leftItems = [];
                $rightItems = [];

                foreach ($section['items'] ?? [] as $item) {
                    if ((int) ($item['number'] ?? 0) <= 8) {
                        $leftItems[] = $item;
                    } else {
                        $rightItems[] = $item;
                    }
                }

                $leftSections[] = [
                    'title' => $section['title'],
                    'items' => $leftItems,
                ];
                $rightSections[] = [
                    'title' => $section['title'] . ' (continued)',
                    'items' => $rightItems,
                ];

                continue;
            }

            $rightSections[] = $section;
        }

        return [$formatTerms($leftSections), $formatTerms($rightSections)];
    };

    $declarationBoxes = [];
    if (isset($booking->declaration_data['boxes']) && is_array($booking->declaration_data['boxes'])) {
        foreach ($booking->declaration_data['boxes'] as $declarationBox) {
            $key = $declarationBox['tracking_number'] ?? ($declarationBox['id'] ?? null);
            if ($key) {
                $declarationBoxes[(string) $key] = $declarationBox;
            }
        }
    }

    $title = $cleanCopy($declarationSettings['headerText'] ?? null, "Shipper's Export Declaration");
    $subtitle = $cleanCopy($declarationSettings['subtitle'] ?? null, "Shipper's Packing List - Balikbayan Box");
    $originLocation = $cleanCopy($declarationSettings['originLocation'] ?? null, 'Victoria, Australia');
    if ($originLocation === 'Sydney, Australia') {
        $originLocation = 'Victoria, Australia';
    }
    $logo = $declarationSettings['logo'] ?? null;
    $appName = $cleanCopy($declarationSettings['appName'] ?? null, 'Love Balikbayan Box');
    $appSubtitle = $cleanCopy($declarationSettings['appSubtitle'] ?? null, 'Door to Door Sea Cargo');
    $termsColumns = $splitTermsColumns($loadTermsData());
    $certification = isset($booking) ? ($booking->declaration_data['certification'] ?? []) : [];
    $signature = $certification['signature'] ?? null;
    $dateSigned = $certification['date_signed'] ?? ($certification['date'] ?? ($certification['signed_at'] ?? null));
    $printedName = $certification['signed_by'] ?? '';
    $firstPageRows = 18;
    $continuationRows = 30;
@endphp

@for ($pageIndex = 0; $pageIndex < $boxCount; $pageIndex++)
    @php
        $box = isset($boxes) ? $boxes->get($pageIndex) : null;
        $savedBox = null;

        if ($box) {
            $savedBox = $declarationBoxes[(string) $box->tracking_number] ?? ($declarationBoxes[(string) $box->id] ?? null);
        }

        $itemsList = is_array($savedBox['items'] ?? null) ? $savedBox['items'] : [];
        $continuationRowCount = max($continuationRows, max(0, count($itemsList) - $firstPageRows));

        $sender = isset($booking) ? $booking->sender : null;
        $recipient = $box?->recipient;
        $savedRecipient = is_array($savedBox['recipient'] ?? null) ? $savedBox['recipient'] : [];

        $bookingReference = isset($booking) ? ($booking->reference_number ?? '') : '';
        $pickupDate = isset($booking) ? $formatDate($booking->preferred_date ?? null) : '';
        $batchNumber = $box?->batch?->batch_number ?? (isset($booking) && ! empty($booking->preferred_date) ? strtoupper(\Carbon\Carbon::parse($booking->preferred_date)->format('F Y')) : '');
        $trackingNumber = $box?->tracking_number ?? ($savedBox['tracking_number'] ?? '');
        $boxTypeName = $box?->boxType?->name ?? ($savedBox['box_type'] ?? '');

        $senderName = $sender ? trim(($sender->first_name ?? '') . ' ' . ($sender->last_name ?? '')) : '';
        $senderAddressLine1 = $sender->address ?? '';
        $senderAddressLine2 = $sender ? trim(($sender->suburb ?? '') . ', ' . ($sender->state ?? '') . ' ' . ($sender->postcode ?? ''), ' ,') : '';
        $senderPhone = $sender->mobile ?? '';
        $senderEmail = $sender->email ?? '';

        $recipientName = $recipient
            ? ($recipient->name ?: trim(($recipient->first_name ?? '') . ' ' . ($recipient->last_name ?? '')))
            : trim(($savedRecipient['first_name'] ?? '') . ' ' . ($savedRecipient['last_name'] ?? ''));
        $recipientAddressLine1 = $recipient->address ?? ($savedRecipient['address'] ?? '');
        $recipientAddressLine2 = $recipient
            ? trim(($recipient->city ?? '') . ', ' . ($recipient->province ?? '') . ' Philippines ' . ($recipient->zip_code ?? ''), ' ,')
            : trim(($savedRecipient['city'] ?? '') . ', ' . ($savedRecipient['province'] ?? '') . ' ' . ($savedRecipient['country'] ?? 'Philippines') . ' ' . ($savedRecipient['postcode'] ?? ''), ' ,');
        $recipientPhone = $recipient->phone_number ?? ($savedRecipient['mobile'] ?? '');
        $recipientEmail = $recipient->email ?? ($savedRecipient['email'] ?? '');
    @endphp

    <div class="page page-break">
        <table class="masthead">
            <tr>
                <td style="width: 23%;">
                    @if($logo && file_exists(public_path(ltrim($logo, '/'))))
                        <table class="brand-lockup">
                            <tr>
                                <td class="logo-cell"><img src="{{ public_path(ltrim($logo, '/')) }}" class="logo"></td>
                                <td>
                                    <div class="brand-name">{{ $appName }}</div>
                                    <div class="tagline">{{ $appSubtitle }}</div>
                                </td>
                            </tr>
                        </table>
                    @else
                        <div class="brand-text">love <span>balikbayan</span></div>
                        <div class="tagline">{{ $appSubtitle }}</div>
                    @endif
                </td>
                <td style="width: 54%;">
                    <div class="document-title">
                        <h1>{{ $title }}</h1>
                        <p>{{ $subtitle }}</p>
                    </div>
                </td>
                <td style="width: 23%;">
                    <div class="form-meta">
                        {{ $declarationSettings['formInfo'] ?? 'Form 291-B Revised 2026' }}<br>
                        Page 1 of 3<br>
                        Box {{ $pageIndex + 1 }} of {{ $boxCount }}
                    </div>
                </td>
            </tr>
        </table>

        <div class="shipment-block">
            <div class="block-title">Shipment Metadata</div>
            <table class="metadata-table">
                <tr>
                    <td style="width: 33%;">
                        <span class="field-label">Booking Reference</span>
                        <div class="field-line">{{ $bookingReference }}</div>
                    </td>
                    <td style="width: 34%;">
                        <span class="field-label">Drop Off / Pickup Date</span>
                        <div class="field-line">{{ $pickupDate }}</div>
                    </td>
                    <td style="width: 33%;">
                        <span class="field-label">Batch Number</span>
                        <div class="field-line">{{ $batchNumber }}</div>
                    </td>
                </tr>
                <tr>
                    <td>
                        <span class="field-label">Box Count</span>
                        <div class="field-line">{{ $boxCount }}</div>
                    </td>
                    <td>
                        <span class="field-label">Box Number</span>
                        <div class="field-line">{{ $pageIndex + 1 }} of {{ $boxCount }}</div>
                    </td>
                    <td>
                        <span class="field-label">Tracking Number / Box Type</span>
                        <div class="field-line">{{ trim($trackingNumber . ' ' . $boxTypeName) }}</div>
                    </td>
                </tr>
            </table>
        </div>

        <table class="layout-table" style="margin-bottom: 9px;">
            <tr>
                <td style="width: 49%; padding-right: 1%;">
                    <div class="party-box">
                        <div class="block-title">1. Sender (Exporter)</div>
                        <div class="party-content">
                            <div class="field">
                                <span class="field-label">Full Name</span>
                                <div class="field-line">{{ $senderName }}</div>
                            </div>
                            <div class="field">
                                <span class="field-label">Address</span>
                                <div class="field-line compact">{{ $senderAddressLine1 }}</div>
                                <div class="field-line compact">{{ $senderAddressLine2 }}</div>
                            </div>
                            <table class="layout-table">
                                <tr>
                                    <td style="width: 48%; padding-right: 2%;">
                                        <span class="field-label">Phone</span>
                                        <div class="field-line compact">{{ $senderPhone }}</div>
                                    </td>
                                    <td style="width: 48%; padding-left: 2%;">
                                        <span class="field-label">Email</span>
                                        <div class="field-line compact">{{ $senderEmail }}</div>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>
                </td>
                <td style="width: 49%; padding-left: 1%;">
                    <div class="party-box">
                        <div class="block-title">2. Recipient (Consignee)</div>
                        <div class="party-content">
                            <div class="field">
                                <span class="field-label">Full Name</span>
                                <div class="field-line">{{ $recipientName }}</div>
                            </div>
                            <div class="field">
                                <span class="field-label">Address</span>
                                <div class="field-line compact">{{ $recipientAddressLine1 }}</div>
                                <div class="field-line compact">{{ $recipientAddressLine2 }}</div>
                            </div>
                            <table class="layout-table">
                                <tr>
                                    <td style="width: 48%; padding-right: 2%;">
                                        <span class="field-label">Phone</span>
                                        <div class="field-line compact">{{ $recipientPhone }}</div>
                                    </td>
                                    <td style="width: 48%; padding-left: 2%;">
                                        <span class="field-label">Email</span>
                                        <div class="field-line compact">{{ $recipientEmail }}</div>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>
                </td>
            </tr>
        </table>

        <div class="section-heading">3. Detailed Packing List</div>
        <table class="box-strip">
            <tr>
                <td class="line" style="width: 28%;"></td>
                <td class="box-copy" style="width: 44%;">
                    Box {{ $pageIndex + 1 }} of {{ $boxCount }}
                    @if($trackingNumber)
                        - {{ $trackingNumber }}
                    @endif
                </td>
                <td class="line" style="width: 28%;"></td>
            </tr>
        </table>

        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 6%;">#</th>
                    <th style="width: 10%;">Qty</th>
                    <th style="width: 54%; text-align: left;">Item Name / Description</th>
                    <th style="width: 30%; text-align: left;">Category</th>
                </tr>
            </thead>
            <tbody>
                @for($i = 0; $i < $firstPageRows; $i++)
                    @php $item = $itemsList[$i] ?? null; @endphp
                    <tr>
                        <td>{{ $i + 1 }}</td>
                        <td>{{ $item['qty'] ?? '' }}</td>
                        <td class="left">{{ $item['name'] ?? '' }}</td>
                        <td class="left">{{ $item['description'] ?? ($item['category'] ?? '') }}</td>
                    </tr>
                @endfor
            </tbody>
        </table>

        <p class="continuation-note">
            Continue the detailed packing list on Page 2. Use one line per item group and keep quantities itemized by box.
        </p>

        <div class="footer">
            <table>
                <tr>
                    <td>Digital Signature ID: {{ isset($booking) && $booking->uuid ? explode('-', $booking->uuid)[0] : '________________' }}</td>
                    <td class="right">{{ $declarationSettings['brandName'] ?? 'Love Balikbayan Logistics System' }} - Printed {{ now()->format('d/m/Y H:i') }}</td>
                </tr>
            </table>
        </div>
    </div>

    <div class="page page-break">
        <table class="masthead">
            <tr>
                <td style="width: 23%;">
                    @if($logo && file_exists(public_path(ltrim($logo, '/'))))
                        <table class="brand-lockup">
                            <tr>
                                <td class="logo-cell"><img src="{{ public_path(ltrim($logo, '/')) }}" class="logo"></td>
                                <td>
                                    <div class="brand-name">{{ $appName }}</div>
                                    <div class="tagline">{{ $appSubtitle }}</div>
                                </td>
                            </tr>
                        </table>
                    @else
                        <div class="brand-text">love <span>balikbayan</span></div>
                        <div class="tagline">{{ $appSubtitle }}</div>
                    @endif
                </td>
                <td style="width: 54%;">
                    <div class="document-title">
                        <h1>Packing List Continuation</h1>
                        <p>Official continuation for Box {{ $pageIndex + 1 }} of {{ $boxCount }}</p>
                    </div>
                </td>
                <td style="width: 23%;">
                    <div class="form-meta">
                        Page 2 of 3<br>
                        {{ $trackingNumber ?: 'Tracking No.' }}
                    </div>
                </td>
            </tr>
        </table>

        <table class="items-table compact">
            <thead>
                <tr>
                    <th style="width: 6%;">#</th>
                    <th style="width: 10%;">Qty</th>
                    <th style="width: 54%; text-align: left;">Item Name / Description</th>
                    <th style="width: 30%; text-align: left;">Category</th>
                </tr>
            </thead>
            <tbody>
                @for($i = 0; $i < $continuationRowCount; $i++)
                    @php
                        $itemIndex = $firstPageRows + $i;
                        $item = $itemsList[$itemIndex] ?? null;
                    @endphp
                    <tr>
                        <td>{{ $itemIndex + 1 }}</td>
                        <td>{{ $item['qty'] ?? '' }}</td>
                        <td class="left">{{ $item['name'] ?? '' }}</td>
                        <td class="left">{{ $item['description'] ?? ($item['category'] ?? '') }}</td>
                    </tr>
                @endfor
            </tbody>
        </table>

        <div class="legal-panel">
            <div class="block-title">4. Legal Declaration and Signatures</div>
            <div class="legal-content">
                <div class="notice-box">
                    <strong>{{ $declarationSettings['prohibitedTitle'] ?? 'Prohibited Items Notice:' }}</strong>
                    {{ $declarationSettings['prohibitedNotice'] ?? 'Firearms, ammunition, illegal drugs, explosives, flammable materials, live animals, counterfeit goods, and other hazardous materials are strictly prohibited. This document is a legally binding declaration under the Customs Modernization and Tariff Act (CMTA) of the Philippines.' }}
                </div>

                <p class="cert-copy">
                    I certify that I am the Consignor/Sender of the above goods and that this detailed packing list is the true and correct description of the goods contained in this box/parcel being sent to the Philippines. I certify that there are no undeclared, restricted, illegal, or banned items, including firearms, ammunition, illegal drugs, or combustible goods, included in this shipment.
                </p>
                <p class="cert-copy">
                    I authorize <strong>LOVE BALIKBAYAN BOXES CARGO SERVICES</strong>, located in <strong>Victoria, Australia</strong>, to clear this shipment through Customs and acknowledge that duties, taxes, charges, penalties, and other expenses due on the shipment or incurred for its release must be paid. By signing, I agree to all Terms & Conditions stated in this declaration.
                </p>

                <table class="signature-table">
                    <tr>
                        <td style="width: 32%; padding-right: 1.5%;">
                            <span class="field-label">Consignor / Sender Printed Name</span>
                            <div class="field-line">{{ $printedName }}</div>
                        </td>
                        <td style="width: 36%; padding: 0 1.5%;">
                            <span class="field-label">Consignor / Sender Signature</span>
                            <div class="signature-box">
                                @if($signature)
                                    <img src="{{ $signature }}">
                                @else
                                    <span class="placeholder">Physical Signature Required</span>
                                @endif
                            </div>
                        </td>
                        <td style="width: 32%; padding-left: 1.5%;">
                            <span class="field-label">Date Signed</span>
                            <div class="field-line">{{ $formatDate($dateSigned) }}</div>
                        </td>
                    </tr>
                </table>

                <div class="office-box">
                    <div class="office-title">For Office Use Only</div>
                    <table class="signature-table">
                        <tr>
                            <td style="width: 36%; padding-right: 1.5%;">
                                <span class="field-label">Authorized Representative Signature</span>
                                <div class="signature-box"></div>
                            </td>
                            <td style="width: 22%; padding: 0 1.5%;">
                                <span class="field-label">Date Verified</span>
                                <div class="field-line"></div>
                            </td>
                            <td style="width: 22%; padding: 0 1.5%;">
                                <span class="field-label">Officer Name</span>
                                <div class="field-line"></div>
                            </td>
                            <td style="width: 20%; padding-left: 1.5%;">
                                <span class="field-label">Dispatch Method</span>
                                <div style="font-size: 8px; font-weight: 800; margin-top: 5px;">
                                    <span class="dispatch-check"></span>Mail
                                    <span style="display: inline-block; width: 8px;"></span>
                                    <span class="dispatch-check"></span>Courier
                                </div>
                            </td>
                        </tr>
                    </table>
                </div>
            </div>
        </div>

        <div class="footer">
            <table>
                <tr>
                    <td>Compliance Level: Secure-A1</td>
                    <td class="right">{{ $originLocation }}</td>
                </tr>
            </table>
        </div>
    </div>

    <div class="page" style="{{ $pageIndex < $boxCount - 1 ? 'page-break-after: always;' : '' }}">
        <table class="masthead">
            <tr>
                <td style="width: 23%;">
                    @if($logo && file_exists(public_path(ltrim($logo, '/'))))
                        <table class="brand-lockup">
                            <tr>
                                <td class="logo-cell"><img src="{{ public_path(ltrim($logo, '/')) }}" class="logo"></td>
                                <td>
                                    <div class="brand-name">{{ $appName }}</div>
                                    <div class="tagline">{{ $appSubtitle }}</div>
                                </td>
                            </tr>
                        </table>
                    @else
                        <div class="brand-text">love <span>balikbayan</span></div>
                        <div class="tagline">{{ $appSubtitle }}</div>
                    @endif
                </td>
                <td style="width: 54%;">
                    <div class="document-title">
                        <h1>Terms & Conditions</h1>
                        <p>Declaration terms, warranties, and liability limits</p>
                    </div>
                </td>
                <td style="width: 23%;">
                    <div class="form-meta">
                        Page 3 of 3<br>
                        Box {{ $pageIndex + 1 }} of {{ $boxCount }}
                    </div>
                </td>
            </tr>
        </table>

        <table class="terms-columns">
            <tr>
                <td>
                    <div class="terms-copy">
                        {!! $termsColumns[0] !!}
                    </div>
                </td>
                <td>
                    <div class="terms-copy">
                        {!! $termsColumns[1] !!}
                    </div>
                </td>
            </tr>
        </table>

        <div class="footer">
            <table>
                <tr>
                    <td>{{ $declarationSettings['brandName'] ?? 'Love Balikbayan Logistics System' }}</td>
                    <td class="right">Printed {{ now()->format('d/m/Y H:i') }}</td>
                </tr>
            </table>
        </div>
    </div>
@endfor
</body>
</html>
