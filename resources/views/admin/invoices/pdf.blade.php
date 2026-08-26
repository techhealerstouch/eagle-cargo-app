<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>INVOICE | {{ $invoice->invoice_number }}</title>
    <style>
        @page {
            margin: 0;
            size: a4;
        }
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            font-size: 11px;
            color: #18181b;
            line-height: 1.4;
            margin: 0;
            padding: 24px 32px;
            background-color: #ffffff;
        }

        /* Helper Classes */
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .text-uppercase { text-transform: uppercase; }
        .font-bold { font-weight: bold; }
        .font-medium { font-weight: 500; }
        .font-black { font-weight: 900; }
        .font-extralight { font-weight: 200; }

        /* Layout Containers */
        .header { width: 100%; margin-bottom: 16px; }
        .header td { vertical-align: top; }

        /* Company Info */
        .logo { height: 50px; width: auto; margin-bottom: 6px; }
        .brand-text { font-size: 24px; font-weight: 900; letter-spacing: -1px; color: #1e3a8a; margin-bottom: 2px; }
        .brand-text span { color: #dc2626; }
        .tagline { font-size: 9px; font-weight: bold; letter-spacing: 2px; color: #a1a1aa; text-transform: uppercase; margin-top: -2px; margin-bottom: 6px; }

        .company-info-block { margin-top: 4px; }
        .company-name { font-size: 13px; font-weight: bold; color: #18181b; line-height: 1.2; }
        .company-details { font-size: 11px; color: #71717a; line-height: 1.4; margin-top: 2px; }

        /* Invoice Info */
        .invoice-title { font-size: 38px; font-weight: 100; color: #2563eb; line-height: 1; margin: 0; }
        .invoice-number-label { font-size: 15px; font-weight: bold; color: #18181b; margin-top: 4px; }

        .balance-due-box { margin-top: 12px; }
        .balance-due-label { font-size: 12px; font-weight: bold; color: #71717a; margin-bottom: 1px; }
        .balance-due-amount { font-size: 22px; font-weight: 900; color: #18181b; letter-spacing: -0.5px; }

        /* Billing Section */
        .billing-section { width: 100%; margin-bottom: 16px; border-bottom: 1px solid #f4f4f5; padding-bottom: 16px; }
        .section-title { font-size: 11px; font-weight: bold; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px; }
        .bill-to-name { font-size: 13px; font-weight: bold; color: #18181b; margin-bottom: 2px; }
        .bill-to-details { font-size: 11px; color: #71717a; line-height: 1.4; }

        .details-table { width: 100%; border-collapse: collapse; }
        .details-table td { padding: 2px 0; font-size: 11px; }
        .details-label { text-align: right; color: #a1a1aa; font-weight: 500; padding-right: 12px; }
        .details-value { text-align: right; color: #18181b; font-weight: bold; }

        /* Subject */
        .subject-section { margin-bottom: 14px; }
        .subject-label { font-size: 11px; font-weight: bold; color: #a1a1aa; margin-bottom: 2px; }
        .subject-text { font-size: 13px; font-weight: 900; color: #1e3a8a; text-transform: uppercase; letter-spacing: -0.5px; }

        /* Items Table */
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        .items-table th { background-color: #1e40af; color: #ffffff; padding: 6px 12px; text-align: left; font-size: 11px; font-weight: bold; }
        .items-table th:first-child { border-top-left-radius: 4px; }
        .items-table th:last-child { border-top-right-radius: 4px; }
        .items-table td { padding: 8px 12px; border-bottom: 1px solid #f4f4f5; vertical-align: top; }

        .item-dest { font-size: 11px; font-weight: 900; color: #18181b; text-transform: uppercase; margin-bottom: 1px; }
        .item-coverage { font-size: 9px; color: #a1a1aa; line-height: 1.2; }
        .qty-val { font-size: 11px; font-weight: bold; color: #18181b; }
        .qty-unit { font-size: 9px; color: #a1a1aa; }
        .price-val { font-size: 11px; color: #18181b; }
        .amount-val { font-size: 11px; font-weight: bold; color: #18181b; }

        /* Totals */
        .totals-container { width: 100%; margin-bottom: 16px; }
        .totals-table { width: 288px; margin-left: auto; border-collapse: collapse; }
        .totals-table td { padding: 4px 0; font-size: 12px; border-bottom: 1px solid #fafafa; }
        .totals-label { text-align: right; color: #71717a; font-weight: 500; padding-right: 12px; }
        .totals-value { text-align: right; color: #18181b; }

        .total-row td { border-top: 1px solid #e4e4e7; padding-top: 8px; font-weight: 900; color: #18181b; }
        .payment-row td { color: #dc2626; font-size: 11px; font-weight: 500; }
        .balance-row { background-color: #f9fafb; }
        .balance-row td { border-top: 2px solid #e4e4e7; padding: 8px 4px; font-weight: 900; font-size: 13px; color: #18181b; }

        /* Footer */
        .notes-section { margin-top: 14px; }
        .notes-title { font-size: 11px; font-weight: bold; color: #18181b; text-transform: uppercase; margin-bottom: 4px; }
        .notes-text { font-size: 10px; color: #52525b; line-height: 1.4; }
        .notes-text.terms { color: #71717a; }
        .link { color: #2563eb; text-decoration: none; }

        .footer-page { position: absolute; bottom: 24px; right: 32px; font-size: 9px; font-weight: bold; color: #d4d4d8; }

        /* Paid Stamp */
        .paid-stamp {
            position: absolute;
            top: 100px;
            right: 32px;
            border: 5px solid rgba(16, 185, 129, 0.2);
            border-radius: 12px;
            padding: 8px 24px;
            transform: rotate(-25deg);
            z-index: 0;
            pointer-events: none;
        }
        .paid-text {
            font-size: 54px;
            font-weight: 900;
            color: rgba(16, 185, 129, 0.2);
            text-transform: uppercase;
            letter-spacing: -3px;
            line-height: 1;
        }
    </style>
</head>
@php
    $invoiceSettings = $invoiceSettings ?? [];
    $senderSnapshot = is_array($senderSnapshot ?? null) ? $senderSnapshot : [];
    $bookingSnapshot = is_array($bookingSnapshot ?? null) ? $bookingSnapshot : [];
    $lineItemsSnapshot = is_array($lineItemsSnapshot ?? null) ? $lineItemsSnapshot : [];
    $adminTeamSnapshot = is_array($adminTeamSnapshot ?? null) ? $adminTeamSnapshot : ['name' => 'Admin'];

    $logo = $invoiceSettings['logo'] ?? null;
    $companyName = $invoiceSettings['companyName'] ?? 'Love Balikbayan Box Sea Cargo';
    $address = $invoiceSettings['address'] ?? '123 Logistics Way, Sydney NSW 2000';
    $abn = $invoiceSettings['abn'] ?? '12 345 678 901';
    $phone = $invoiceSettings['phone'] ?? '';
    $bankName = $invoiceSettings['bankName'] ?? '';
    $bankBsb = $invoiceSettings['bankBsb'] ?? '';
    $bankAccount = $invoiceSettings['bankAccount'] ?? '';
    $terms = $invoiceSettings['terms'] ?? '';
    $currencySymbol = $invoiceSettings['currencySymbol'] ?? '$';

    $logoPath = null;
    if ($logo) {
        $cleanLogo = ltrim($logo, '/');
        if (str_starts_with($cleanLogo, 'uploads/')) {
            $relativePath = preg_replace('#^uploads/#', '', $cleanLogo);
            $possiblePath = storage_path('app/public/' . $relativePath);
            if (file_exists($possiblePath)) {
                $logoPath = $possiblePath;
            }
        }
        if (! $logoPath && file_exists(public_path($cleanLogo))) {
            $logoPath = public_path($cleanLogo);
        }
    }

    $senderFirstName = $senderSnapshot['first_name'] ?? '';
    $senderLastName = $senderSnapshot['last_name'] ?? '';
    $senderName = trim($senderFirstName . ' ' . $senderLastName);

    $senderAddress = $senderSnapshot['address'] ?? '';
    $senderSuburb = $senderSnapshot['suburb'] ?? '';
    $senderState = $senderSnapshot['state'] ?? '';
    $senderPostcode = $senderSnapshot['postcode'] ?? '';

    $bookingTypeLabels = [
        'drop_off' => 'BOX DROP OFF',
        'home_pickup' => 'HOME PICK-UP',
        'other' => 'OTHER',
    ];
    $rawBookingType = $bookingSnapshot['booking_type'] ?? ($invoice->booking?->booking_type instanceof \BackedEnum ? $invoice->booking->booking_type->value : ($invoice->booking?->booking_type ?? 'drop_off'));
    $normalizedType = strtolower(str_replace(['-', '_'], ' ', trim((string) $rawBookingType)));
    if (isset($bookingTypeLabels[$rawBookingType])) {
        $typeLabel = $bookingTypeLabels[$rawBookingType];
    } elseif ($normalizedType === 'drop off' || $normalizedType === 'box drop off' || empty($normalizedType)) {
        $typeLabel = 'BOX DROP OFF';
    } elseif ($normalizedType === 'home pickup' || $normalizedType === 'home pick up' || $normalizedType === 'pickup') {
        $typeLabel = 'HOME PICK-UP';
    } else {
        $typeLabel = strtoupper(str_replace('_', ' ', (string) $rawBookingType));
    }

    $batchNumbers = collect($lineItemsSnapshot)->pluck('batch_number')->filter()->unique();
    $subject = $batchNumbers->count() > 0
        ? $typeLabel . ": BATCH " . $batchNumbers->implode(', ') . " SHIPMENT"
        : $typeLabel;

    $totalAmount = (float)$invoice->amount;
    $settledPayments = $invoice->payments->filter(function ($payment) {
        return !is_null($payment->paid_at) || $payment->stripe_status === 'succeeded';
    });
    $paymentsMade = $settledPayments->sum('amount');
    $balanceDue = $invoice->status === 'paid' ? 0 : max(0, $totalAmount - $paymentsMade);

    $vatRate = (float) ($invoiceSettings['taxRate'] ?? 0);
    $taxLabel = $invoiceSettings['taxLabel'] ?? 'GST';
    $vatableRevenue = (float) ($invoice->vatable_revenue ?? 0);
    $vatAmount = (float) ($invoice->vat_amount ?? 0);
    $vatExemptRevenue = (float) ($invoice->vat_exempt_revenue ?? 0);

    if ($vatableRevenue <= 0 && $vatAmount <= 0 && $vatExemptRevenue <= 0 && $vatRate > 0 && $totalAmount > 0) {
        $vatableRevenue = round($totalAmount / (1 + $vatRate), 2);
        $vatAmount = round($totalAmount - $vatableRevenue, 2);
    }

    if ($vatRate <= 0 && $vatExemptRevenue <= 0 && $totalAmount > 0) {
        $vatExemptRevenue = $totalAmount;
    }

    $effectiveVatRate = $vatableRevenue > 0 ? $vatAmount / $vatableRevenue : 0;

    $formattedDate = $invoice->created_at->format('d M, Y');
@endphp
<body>
    @if($invoice->status === 'paid' || $balanceDue <= 0)
        <div class="paid-stamp">
            <div class="paid-text">PAID</div>
        </div>
    @endif

    <table class="header">
        <tr>
            <td width="50%">
                @if($logoPath)
                    <img src="{{ $logoPath }}" class="logo">
                @else
                    <div class="brand-text">love <span>balikbayan</span></div>
                    <div class="tagline">Door to Door Sea Cargo</div>
                @endif

                <div class="company-info-block">
                    <div class="company-name">{{ $companyName }}</div>
                    <div class="company-details">
                        @if($abn) ABN {{ $abn }}<br> @endif
                        {!! nl2br(e($address)) !!}
                        @if($phone) <br>Ph: {{ $phone }} @endif
                    </div>
                </div>
            </td>
            <td width="50%" class="text-right">
                <h1 class="invoice-title">Invoice</h1>
                <div class="invoice-number-label"># {{ $invoice->invoice_number }}</div>

                <div class="balance-due-box">
                    <div class="balance-due-label">Balance Due</div>
                    <div class="balance-due-amount">{{ $currencySymbol }}{{ number_format($balanceDue, 2) }}</div>
                </div>
            </td>
        </tr>
    </table>

    <table class="billing-section">
        <tr>
            <td width="50%" valign="top">
                <div class="section-title">Bill To</div>
                <div class="bill-to-name">{{ $senderName }}</div>
                <div class="bill-to-details">
                    {{ $senderAddress }}<br>
                    {{ $senderSuburb }} {{ $senderState }} {{ $senderPostcode }}<br>
                    Australia
                </div>
            </td>
            <td width="50%" valign="top">
                <table class="details-table">
                    <tr>
                        <td class="details-label">Invoice Date :</td>
                        <td class="details-value">{{ $formattedDate }}</td>
                    </tr>
                    <tr>
                        <td class="details-label">Terms :</td>
                        <td class="details-value">Due on Receipt</td>
                    </tr>
                    <tr>
                        <td class="details-label">Due Date :</td>
                        <td class="details-value">{{ $formattedDate }}</td>
                    </tr>
                    <tr>
                        <td class="details-label">Admin Team :</td>
                        <td class="details-value">{{ $adminTeamSnapshot['name'] ?? 'Admin' }}</td>
                    </tr>
                    <tr>
                        <td class="details-label">Picker :</td>
                        <td class="details-value">
                            @php
                                $pickerName = 'N/A';
                                if (isset($invoice) && $invoice->booking) {
                                    $pickupRunsheet = $invoice->booking->runsheets()->where('type', 'pickup')->first();
                                    if ($pickupRunsheet && $pickupRunsheet->picker) {
                                        $pickerName = $pickupRunsheet->picker->name;
                                    }
                                }
                            @endphp
                            {{ $pickerName }}
                        </td>
                        </tr>
                    <tr>
                        <td class="details-label">PAYEE :</td>
                        <td class="details-value">{{ $senderName }}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <div class="subject-section">
        <div class="subject-label">Subject :</div>
        <div class="subject-text">{{ $subject }}</div>
    </div>

    <table class="items-table">
        <thead>
            <tr>
                <th width="5%">#</th>
                <th width="50%">Item & Description</th>
                <th width="15%" class="text-right">Qty</th>
                <th width="15%" class="text-right">Rate</th>
                <th width="15%" class="text-right">Amount</th>
            </tr>
        </thead>
        <tbody>
            @php
                $displayItems = is_array($lineItemsSnapshot) ? $lineItemsSnapshot : [];
                $hasEmptyBox = collect($displayItems)->contains(fn($i) => data_get($i, 'is_add_on') || data_get($i, 'item_type') === 'empty_box');
                $emptyBoxCount = (int) data_get($bookingSnapshot, 'empty_box_count', 0);
                $emptyBoxFee = (float) data_get($bookingSnapshot, 'empty_box_fee', 10.00);
                if (!$hasEmptyBox && $emptyBoxCount > 0) {
                    $displayItems[] = [
                        'is_add_on' => true,
                        'item_type' => 'empty_box',
                        'item_name' => 'Empty Box Delivery (' . $emptyBoxCount . ' @ ' . $currencySymbol . number_format($emptyBoxFee, 2) . ')',
                        'price_charged' => round($emptyBoxCount * $emptyBoxFee, 2),
                    ];
                }
            @endphp
            @foreach($displayItems as $index => $item)
            @php
                $isAddOn = data_get($item, 'is_add_on') || data_get($item, 'item_type') === 'empty_box';
            @endphp
            <tr>
                <td>{{ $index + 1 }}</td>
                <td>
                    @if($isAddOn)
                        <div class="item-dest">{{ data_get($item, 'item_name', 'Empty Box Delivery') }}</div>
                        <div class="item-coverage" style="color: #d97706; font-weight: bold;">Empty Box Delivery Service</div>
                    @else
                        <div class="item-dest">{{ data_get($item, 'destination', 'METRO MANILA') }}</div>
                        <div class="item-coverage">
                            Sea Freight Coverage Areas:<br>
                            {{ $bookingSnapshot['destination'] ?? 'NCR' }}
                            @if(data_get($item, 'is_door_to_door'))
                                <br><span style="color: #059669; font-weight: bold;">+ Door-to-Door Delivery Add-On{{ (float)data_get($item, 'door_to_door_fee', 0) > 0 ? ' (+' . $currencySymbol . number_format((float)data_get($item, 'door_to_door_fee', 0), 2) . ')' : '' }}</span>
                            @endif
                        </div>
                    @endif
                </td>
                <td class="text-right">
                    <div class="qty-val">1.00</div>
                    <div class="qty-unit">{{ $isAddOn ? 'Service' : 'Box' }}</div>
                </td>
                <td class="text-right price-val">
                    {{ number_format((float)data_get($item, 'price_charged', 0), 2) }}
                </td>
                <td class="text-right amount-val">
                    {{ number_format((float)data_get($item, 'price_charged', 0), 2) }}
                </td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div class="totals-container">
        <table class="totals-table">
            <tr>
                <td class="totals-label">{{ $taxLabel }}able Revenue</td>
                <td class="totals-value">{{ $currencySymbol }}{{ number_format($vatableRevenue, 2) }}</td>
            </tr>
            @if($vatExemptRevenue > 0)
            <tr>
                <td class="totals-label">{{ $taxLabel }} Exempt</td>
                <td class="totals-value">{{ $currencySymbol }}{{ number_format($vatExemptRevenue, 2) }}</td>
            </tr>
            @endif
            <tr>
                <td class="totals-label">{{ $taxLabel }} ({{ number_format($effectiveVatRate * 100, 2) }}%)</td>
                <td class="totals-value">{{ $currencySymbol }}{{ number_format($vatAmount, 2) }}</td>
            </tr>
            @if((float)($invoice->surcharge_amount ?? 0) > 0)
            <tr>
                <td class="totals-label" style="color: #7e22ce; font-weight: bold;">Afterpay Surcharge (6.3%)</td>
                <td class="totals-value" style="color: #7e22ce; font-weight: bold;">{{ $currencySymbol }}{{ number_format((float)$invoice->surcharge_amount, 2) }}</td>
            </tr>
            @endif
            <tr class="total-row">
                <td class="totals-label" style="color: #18181b;">Total</td>
                <td class="totals-value" style="font-weight: 900;">{{ $currencySymbol }}{{ number_format($totalAmount, 2) }}</td>
            </tr>
            @foreach($settledPayments as $payment)
            <tr class="payment-row">
                <td class="totals-label" style="font-size: 11px;">
                    Payment Made ({{ $payment->paid_at ? $payment->paid_at->format('d M, Y') : '' }})
                </td>
                <td class="totals-value" style="font-size: 11px;">
                    (-) {{ $currencySymbol }}{{ number_format((float)$payment->amount, 2) }}
                </td>
            </tr>
            @endforeach
            <tr class="balance-row">
                <td class="totals-label" style="color: #18181b;">Balance Due</td>
                <td class="totals-value" style="font-weight: 900;">{{ $currencySymbol }}{{ number_format($balanceDue, 2) }}</td>
            </tr>
        </table>
    </div>

    <div class="notes-section">
        @if($bankName || $bankBsb || $bankAccount)
        <div class="notes-title">Payment / Direct Deposit Details</div>
        <div class="notes-text" style="margin-bottom: 10px;">
            @if($bankName) <strong>Bank:</strong> {{ $bankName }} &nbsp;&nbsp;|&nbsp;&nbsp; @endif
            @if($bankBsb) <strong>BSB:</strong> {{ $bankBsb }} &nbsp;&nbsp;|&nbsp;&nbsp; @endif
            @if($bankAccount) <strong>Account:</strong> {{ $bankAccount }} @endif
        </div>
        @endif

        @if($terms)
        <div class="notes-title" style="margin-top: 12px;">Terms & Conditions</div>
        <div class="notes-text terms">
            {!! nl2br(e($terms)) !!}
        </div>
        @endif
    </div>

    <div class="footer-page">1</div>
</body>
</html>
