<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{{ $reportTitle ?? 'Financial Report' }}</title>
    <style>
        @page { margin: 40px; }
        body {
            font-family: 'DejaVu Sans', 'Helvetica', 'Arial', sans-serif;
            font-size: 11px;
            color: #1e293b;
            line-height: 1.4;
            margin: 0;
            padding: 0;
        }

        /* Typography & Colors */
        .text-navy { color: #002D5B; }
        .text-amber { color: #F5A623; }
        .text-muted { color: #64748b; }
        .font-bold { font-weight: bold; }

        /* Header */
        .header { width: 100%; margin-bottom: 25px; }
        .report-title { font-size: 22px; font-weight: bold; color: #002D5B; margin: 0; }
        .accent-line { height: 3px; background-color: #F5A623; width: 100%; margin-top: 5px; margin-bottom: 20px; }

        /* Stat Cards */
        .stats-grid { width: 100%; border-collapse: separate; border-spacing: 10px 0; margin: 0 -10px 30px -10px; }
        .stat-card {
            background: #ffffff;
            padding: 20px 10px;
            text-align: center;
            border: 1px solid #e2e8f0;
            border-top: 5px solid #002D5B; /* Navy top border */
        }
        .stat-card-alt { border-top: 5px solid #F5A623; } /* Gold top border */

        .stat-value { font-size: 20px; font-weight: bold; color: #002D5B; margin-bottom: 5px; }
        .stat-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #64748b; }
        .stat-sub { font-size: 9px; color: #94a3b8; margin-top: 4px; }

        /* Sections */
        .section-header {
            border-bottom: 2px solid #002D5B;
            padding-bottom: 5px;
            margin-bottom: 15px;
            margin-top: 25px;
        }
        .section-title { font-size: 14px; font-weight: bold; color: #002D5B; text-transform: none; }

        /* Tables */
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th {
            background-color: #002D5B;
            color: #ffffff;
            font-weight: bold;
            text-align: left;
            padding: 10px;
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.5px;
        }
        td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
        tr:nth-child(even) { background-color: #f1f5f9; } /* Zebra striping */

        .table-total { background-color: #002D5B !important; color: #ffffff; font-weight: bold; }
        .table-total td { border: none; }

        .text-right { text-align: right; }
        .font-mono { font-family: 'Courier', monospace; }

        .footer {
            position: fixed;
            bottom: -20px;
            left: 0;
            right: 0;
            height: 20px;
            font-size: 9px;
            color: #94a3b8;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            padding-top: 5px;
        }
        .page-number:before { content: "Page " counter(page); }

        .note-box {
            background: #fefce8;
            border: 1px solid #fde68a;
            border-left: 4px solid #f59e0b;
            padding: 8px 12px;
            font-size: 9px;
            color: #92400e;
            margin-bottom: 15px;
        }
        .info-box {
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-left: 4px solid #0284c7;
            padding: 8px 12px;
            font-size: 9px;
            color: #0c4a6e;
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    @php
        $reportType = $reportType ?? 'full';
        $reportTitle = $reportTitle ?? 'Financial Audit Report';
        $showSection = fn (string $section) => $reportType === 'full' || $reportType === $section;
    @endphp

    <div class="footer">
        Love Balikbayan Logistics - Confidential Audit Report - System Generated and Authorized - <span class="page-number"></span>
    </div>
    <div class="header">
        <table style="width: 100%; border: none; border-spacing: 0;">
            <tr>
                <td style="border: none; padding: 0; vertical-align: middle;">
                    <div style="display: table; width: 100%;">
                        @if($logoDataUri ?? null)
                        <div style="display: table-cell; width: 60px; vertical-align: middle; padding-right: 15px;">
                            <img src="{{ $logoDataUri }}" style="width: 60px; height: auto;">
                        </div>
                        @endif
                        <div style="display: table-cell; vertical-align: middle;">
                            <div style="font-weight: bold; font-size: 18px; color: #002D5B; line-height: 1.1;">Love Balikbayan Box</div>
                            <div style="font-weight: 900; font-size: 14px; color: #de1b09ff; letter-spacing: 1px;">SEA CARGO</div>
                        </div>
                    </div>
                </td>
                <td style="border: none; padding: 0; text-align: right; vertical-align: middle;">
                    <h1 class="report-title">{{ $reportTitle }}</h1>
                    <div style="font-size: 10px; color: #64748b; margin-top: 5px;">
                        Audit Period: <span class="font-bold">{{ $filters['start_date'] }}</span> to <span class="font-bold">{{ $filters['end_date'] }}</span>
                    </div>
                    <div style="font-size: 8px; color: #94a3b8; margin-top: 2px;">System Generated: {{ now()->format('M d, Y H:i') }}</div>
                </td>
            </tr>
        </table>
        <div class="accent-line"></div>
    </div>

    @if($showSection('summary'))
    <div class="section-header">
        <div class="section-title">Executive Summary</div>
    </div>

    <table class="stats-grid" style="border: none;">
        <tr>
            <td style="width: 33.33%; border: none; padding: 0 5px;">
                <div class="stat-card">
                    <div class="stat-value">{{ $currencySymbol }}{{ number_format($stats['total_invoiced'], 2) }}</div>
                    <div class="stat-label">Total Invoiced</div>
                    @php
                        $invoicedTrend = $stats['prev_total_invoiced'] > 0
                            ? (($stats['total_invoiced'] - $stats['prev_total_invoiced']) / $stats['prev_total_invoiced']) * 100
                            : 0;
                    @endphp
                    <div class="stat-sub" style="color: {{ $invoicedTrend >= 0 ? '#16a34a' : '#dc2626' }};">
                        {{ $invoicedTrend >= 0 ? '▲' : '▼' }} {{ number_format(abs($invoicedTrend), 1) }}% vs Prev. Period
                    </div>
                </div>
            </td>
            <td style="width: 33.33%; border: none; padding: 0 5px;">
                <div class="stat-card stat-card-alt">
                    <div class="stat-value" style="color: #9333ea;">{{ $currencySymbol }}{{ number_format($stats['total_commissions'], 2) }}</div>
                    <div class="stat-label">Total Commissions</div>
                    @php
                        $commissionsTrend = $stats['prev_total_commissions'] > 0
                            ? (($stats['total_commissions'] - $stats['prev_total_commissions']) / $stats['prev_total_commissions']) * 100
                            : 0;
                    @endphp
                    <div class="stat-sub" style="color: {{ $commissionsTrend >= 0 ? '#16a34a' : '#dc2626' }};">
                        {{ $commissionsTrend >= 0 ? '▲' : '▼' }} {{ number_format(abs($commissionsTrend), 1) }}% vs Prev. Period
                    </div>
                </div>
            </td>
            <td style="width: 33.33%; border: none; padding: 0 5px;">
                <div class="stat-card">
                    <div class="stat-value" style="color: #2563eb;">{{ $currencySymbol }}{{ number_format($stats['net_revenue'], 2) }}</div>
                    <div class="stat-label">Net Revenue</div>
                    @php
                        $netRevenueTrend = $stats['prev_net_revenue'] > 0
                            ? (($stats['net_revenue'] - $stats['prev_net_revenue']) / $stats['prev_net_revenue']) * 100
                            : 0;
                    @endphp
                    <div class="stat-sub" style="color: {{ $netRevenueTrend >= 0 ? '#16a34a' : '#dc2626' }};">
                        {{ $netRevenueTrend >= 0 ? '▲' : '▼' }} {{ number_format(abs($netRevenueTrend), 1) }}% vs Prev. Period
                    </div>
                </div>
            </td>
        </tr>
        <tr>
            <td style="width: 33.33%; border: none; padding: 0 5px; padding-top: 10px;">
                <div class="stat-card stat-card-alt">
                    <div class="stat-value">{{ $currencySymbol }}{{ number_format($stats['total_collected'], 2) }}</div>
                    <div class="stat-label">Total Collected</div>
                    <div class="stat-sub">Current period cash inflow</div>
                </div>
            </td>
            <td style="width: 33.33%; border: none; padding: 0 5px; padding-top: 10px;">
                <div class="stat-card">
                    <div class="stat-value" style="color: #dc2626;">{{ $currencySymbol }}{{ number_format($stats['outstanding_amount'], 2) }}</div>
                    <div class="stat-label">Total Receivables</div>
                    <div class="stat-sub">Across all periods</div>
                </div>
            </td>
            <td style="width: 33.33%; border: none; padding: 0 5px; padding-top: 10px;">
                <div class="stat-card stat-card-alt">
                    <div class="stat-value">{{ $stats['collection_rate'] }}%</div>
                    <div class="stat-label">Period Efficiency</div>
                    <div class="stat-sub">Paid vs. Invoiced (this period)</div>
                </div>
            </td>
        </tr>
    </table>

    @if($stats['total_collected'] != ($stats['collected_against_period'] ?? $stats['total_collected']))
    <div class="info-box">
        <strong>Note:</strong> Total Collected ({{ $currencySymbol }}{{ number_format($stats['total_collected'], 2) }}) includes
        {{ $currencySymbol }}{{ number_format($stats['total_collected'] - ($stats['collected_against_period'] ?? 0), 2) }}
        in payments applied to invoices from prior periods. The Collection Rate above reflects only payments against this period's invoices.
    </div>
    @endif


    @endif
    @if($showSection('revenue'))
    <div class="section-header">
        <div class="section-title">Revenue & Collection Insights</div>
    </div>

    <div style="width: 100%; margin-bottom: 20px;">
        <table style="width: 100%; border: none;">
            <tr>
                <td style="width: 50%; vertical-align: top; border: none; padding-right: 15px;">
                    <div style="font-size: 11px; font-weight: bold; color: #002D5B; margin-bottom: 8px;">Revenue by Box</div>
                    <table style="font-size: 10px;">
                        <thead>
                            <tr>
                                <th>Box Type</th>
                                <th class="text-right">Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($stats['revenue_by_box_type'] as $box)
                            <tr>
                                <td>{{ $box->name }}</td>
                                <td class="text-right font-bold">{{ $currencySymbol }}{{ number_format($box->total, 2) }}</td>
                            </tr>
                            @endforeach
                            @if(abs($stats['other_revenue_adjustments']) > 0.01)
                            <tr>
                                <td style="color: #64748b; font-style: italic;">Other Fees/Adjustments</td>
                                <td class="text-right font-bold">{{ $currencySymbol }}{{ number_format($stats['other_revenue_adjustments'], 2) }}</td>
                            </tr>
                            @endif
                            <tr class="table-total">
                                <td>TOTAL</td>
                                <td class="text-right">{{ $currencySymbol }}{{ number_format($stats['total_invoiced'], 2) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </td>
                <td style="width: 50%; vertical-align: top; border: none;">
                    <div style="font-size: 11px; font-weight: bold; color: #002D5B; margin-bottom: 8px;">Top Senders</div>
                    <table style="font-size: 10px;">
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th class="text-right">Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach($stats['top_customers'] as $customer)
                            <tr>
                                <td>{{ $customer->name }}</td>
                                <td class="text-right font-bold">{{ $currencySymbol }}{{ number_format($customer->total_revenue, 2) }}</td>
                            </tr>
                            @endforeach
                        </tbody>
                    </table>
                </td>
            </tr>
        </table>
    </div>


    @endif
    @if($showSection('tax'))
    {{-- VAT & Tax Summary — only show detailed cards when VAT data is present --}}
    @php
        $taxLabel = $taxLabel ?? 'GST';
        $hasVatData = ($stats['vat_stats']->vatable_sales ?? 0) > 0
            || ($stats['vat_stats']->vat_amount ?? 0) > 0
            || ($stats['vat_stats']->vat_exempt_sales ?? 0) > 0;
    @endphp

    <div class="section-header">
        <div class="section-title">{{ $taxLabel }} & Tax Summary</div>
    </div>

    @if($hasVatData)
    <table class="stats-grid" style="border: none;">
        <tr>
            <td style="width: 25%; border: none; padding: 0 5px;">
                <div class="stat-card">
                    <div class="stat-value">{{ $currencySymbol }}{{ number_format($stats['vat_stats']->vatable_sales ?? 0, 2) }}</div>
                    <div class="stat-label">{{ $taxLabel }}able Revenue</div>
                </div>
            </td>
            <td style="width: 25%; border: none; padding: 0 5px;">
                <div class="stat-card">
                    <div class="stat-value">{{ $currencySymbol }}{{ number_format($stats['vat_stats']->vat_exempt_sales ?? 0, 2) }}</div>
                    <div class="stat-label">{{ $taxLabel }} Exempt</div>
                </div>
            </td>
            <td style="width: 25%; border: none; padding: 0 5px;">
                <div class="stat-card stat-card-alt">
                    <div class="stat-value" style="color: #16a34a;">{{ $currencySymbol }}{{ number_format($stats['vat_stats']->vat_amount ?? 0, 2) }}</div>
                    <div class="stat-label">Tax Amount</div>
                </div>
            </td>
            <td style="width: 25%; border: none; padding: 0 5px;">
                <div class="stat-card">
                    <div class="stat-value">{{ $currencySymbol }}{{ number_format($stats['vat_stats']->total_sales ?? 0, 2) }}</div>
                    <div class="stat-label">Gross Revenue</div>
                </div>
            </td>
        </tr>
    </table>
    @else
    <div class="info-box">
        <strong>{{ $taxLabel }} Not Applicable.</strong>
        No {{ $taxLabel }}able amounts were recorded for invoices in this period.
        Gross revenue for the period is <strong>{{ $currencySymbol }}{{ number_format($stats['vat_stats']->total_sales ?? 0, 2) }}</strong>.
        If {{ $taxLabel }} should apply, verify that invoices are configured with {{ $taxLabel }}-inclusive pricing.
    </div>
    @endif


    @endif
    @if($showSection('collections'))
    <div class="section-header">
        <div class="section-title">Collections Summary</div>
    </div>

    <div style="font-size: 11px; font-weight: bold; color: #002D5B; margin-bottom: 8px;">Payment Method Summary</div>
    <table>
        <thead>
            <tr>
                <th>Payment Method</th>
                <th class="text-right">Total</th>
                <th class="text-right">% of Collections</th>
            </tr>
        </thead>
        <tbody>
            @foreach($stats['payment_methods'] as $method)
            <tr>
                <td>{{ str_replace('_', ' ', $method->payment_method) }}</td>
                <td class="text-right font-bold">{{ $currencySymbol }}{{ number_format($method->total, 2) }}</td>
                <td class="text-right text-muted">{{ $stats['total_collected'] > 0 ? number_format(($method->total / $stats['total_collected']) * 100, 1) : 0 }}%</td>
            </tr>
            @endforeach
            <tr class="table-total">
                <td>TOTAL COLLECTIONS</td>
                <td class="text-right">{{ $currencySymbol }}{{ number_format($stats['total_collected'], 2) }}</td>
                <td class="text-right">100%</td>
            </tr>
        </tbody>
    </table>

    <div style="font-size: 11px; font-weight: bold; color: #002D5B; margin-bottom: 8px;">Daily Collection Detailed</div>
    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th class="text-right">Txns</th>
                <th class="text-right">Cash</th>
                <th class="text-right">Bank Transfer</th>
                <th class="text-right">Other</th>
                <th class="text-right">Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($stats['daily_collections'] as $col)
            <tr>
                <td>{{ \Carbon\Carbon::parse($col->date)->format('M d, Y') }}</td>
                <td class="text-right">{{ $col->transactions_count }}</td>
                <td class="text-right">{{ $currencySymbol }}{{ number_format($col->cash, 2) }}</td>
                <td class="text-right">{{ $currencySymbol }}{{ number_format($col->bank_transfer, 2) }}</td>
                <td class="text-right">{{ $currencySymbol }}{{ number_format($col->other, 2) }}</td>
                <td class="text-right font-bold">{{ $currencySymbol }}{{ number_format($col->total, 2) }}</td>
            </tr>
            @endforeach
            <tr class="table-total">
                <td>GRAND TOTAL</td>
                <td class="text-right">{{ $stats['daily_collections']->sum('transactions_count') }}</td>
                <td class="text-right">{{ $currencySymbol }}{{ number_format($stats['daily_collections']->sum('cash'), 2) }}</td>
                <td class="text-right">{{ $currencySymbol }}{{ number_format($stats['daily_collections']->sum('bank_transfer'), 2) }}</td>
                <td class="text-right">{{ $currencySymbol }}{{ number_format($stats['daily_collections']->sum('other'), 2) }}</td>
                <td class="text-right">{{ $currencySymbol }}{{ number_format($stats['daily_collections']->sum('total'), 2) }}</td>
            </tr>
        </tbody>
    </table>


    @endif
    @if($showSection('receivables'))
    <div class="section-header">
        <div class="section-title">Outstanding Receivables Analysis</div>
    </div>

    <table style="width: 100%; border: none; margin-bottom: 20px;">
        <tr>
            <td style="width: 60%; border: none; vertical-align: top; padding-right: 20px;">
                <div style="font-size: 11px; font-weight: bold; color: #002D5B; margin-bottom: 8px;">Aging Summary</div>
                <table style="font-size: 10px;">
                    <thead>
                        <tr>
                            <th>Bucket</th>
                            <th class="text-right">Amount</th>
                            <th class="text-right">% of Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        @php
                            $totalAging = array_sum($stats['aging_buckets']);
                        @endphp
                        <tr>
                            <td>Current (Not yet due)</td>
                            <td class="text-right font-bold">{{ $currencySymbol }}{{ number_format($stats['aging_buckets']['current'], 2) }}</td>
                            <td class="text-right text-muted">{{ $totalAging > 0 ? round(($stats['aging_buckets']['current'] / $totalAging) * 100, 1) : 0 }}%</td>
                        </tr>
                        <tr>
                            <td>1-30 Days Overdue</td>
                            <td class="text-right font-bold">{{ $currencySymbol }}{{ number_format($stats['aging_buckets']['overdue_30'], 2) }}</td>
                            <td class="text-right text-muted">{{ $totalAging > 0 ? round(($stats['aging_buckets']['overdue_30'] / $totalAging) * 100, 1) : 0 }}%</td>
                        </tr>
                        <tr>
                            <td>31-60 Days Overdue</td>
                            <td class="text-right font-bold">{{ $currencySymbol }}{{ number_format($stats['aging_buckets']['overdue_60'], 2) }}</td>
                            <td class="text-right text-muted">{{ $totalAging > 0 ? round(($stats['aging_buckets']['overdue_60'] / $totalAging) * 100, 1) : 0 }}%</td>
                        </tr>
                        <tr>
                            <td>61-90 Days Overdue</td>
                            <td class="text-right font-bold">{{ $currencySymbol }}{{ number_format($stats['aging_buckets']['overdue_90'], 2) }}</td>
                            <td class="text-right text-muted">{{ $totalAging > 0 ? round(($stats['aging_buckets']['overdue_90'] / $totalAging) * 100, 1) : 0 }}%</td>
                        </tr>
                        <tr>
                            <td style="color: #dc2626;">Severely Overdue (90+ Days)</td>
                            <td class="text-right font-bold" style="color: #dc2626;">{{ $currencySymbol }}{{ number_format($stats['aging_buckets']['overdue_90_plus'], 2) }}</td>
                            <td class="text-right text-muted">{{ $totalAging > 0 ? round(($stats['aging_buckets']['overdue_90_plus'] / $totalAging) * 100, 1) : 0 }}%</td>
                        </tr>
                        <tr class="table-total">
                            <td>TOTAL RECEIVABLES</td>
                            <td class="text-right">{{ $currencySymbol }}{{ number_format($totalAging, 2) }}</td>
                            <td class="text-right">100%</td>
                        </tr>
                    </tbody>
                </table>
            </td>
            <td style="width: 40%; border: none; vertical-align: middle;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 15px; border-radius: 4px;">
                    <div style="font-size: 10px; font-weight: bold; color: #64748b; margin-bottom: 10px; text-transform: uppercase;">Collection Efficiency</div>
                    <div style="height: 12px; background: #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 8px;">
                        <div style="height: 100%; background: #002D5B; width: {{ $stats['collection_rate'] }}%;"></div>
                    </div>
                    <div style="font-size: 14px; font-weight: bold; color: #002D5B;">{{ $stats['collection_rate'] }}%</div>
                    <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">Of revenue invoiced this period has been collected.</div>
                </div>
            </td>
        </tr>
    </table>

    {{-- Outstanding Receivables List --}}
    @if($stats['outstanding_report']->count() > 0)
    <div style="font-size: 11px; font-weight: bold; color: #002D5B; margin-bottom: 8px;">Detailed Aging Report</div>

    <table>
        <thead>
            <tr>
                <th>Due Date</th>
                <th>Reference</th>
                <th>Customer</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Balance</th>
            </tr>
        </thead>
        <tbody>
            @foreach($stats['outstanding_report'] as $inv)
            @php
                $paid = $inv->payments->sum('amount');
                $balance = $inv->amount - $paid;
            @endphp
            <tr>
                <td>{{ $inv->due_date ? \Carbon\Carbon::parse($inv->due_date)->format('M d, Y') : 'N/A' }}</td>
                <td class="font-mono font-bold">{{ $inv->invoice_number }}</td>
                <td>{{ $inv->booking?->sender?->first_name }} {{ $inv->booking?->sender?->last_name }}</td>
                <td class="text-right">{{ $currencySymbol }}{{ number_format($inv->amount, 2) }}</td>
                <td class="text-right font-bold" style="color: #dc2626;">{{ $currencySymbol }}{{ number_format($balance, 2) }}</td>
            </tr>
            @endforeach
            <tr class="table-total">
                <td colspan="3">TOTAL OUTSTANDING</td>
                <td class="text-right">{{ $currencySymbol }}{{ number_format($stats['outstanding_report']->sum('amount'), 2) }}</td>
                <td class="text-right">{{ $currencySymbol }}{{ number_format($stats['outstanding_amount'], 2) }}</td>
            </tr>
        </tbody>
    </table>
    @else
    <div class="section-header">
        <div class="section-title">Outstanding Receivables</div>
    </div>
    <div class="info-box">
        <strong>No outstanding receivables.</strong> All invoices have been fully settled.
    </div>
    @endif


    @endif
    @if($showSection('tax'))
    {{-- VAT Invoice Log — flows naturally --}}
    <div class="section-header">
        <div class="section-title">Invoice Log{{ $hasVatData ? ' & ' . $taxLabel . ' Compliance' : '' }}</div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Invoice / OR</th>
                <th>Customer</th>
                @if($hasVatData)
                <th class="text-right">{{ $taxLabel }}able</th>
                <th class="text-right">Tax Amount</th>
                @endif
                <th class="text-right">Gross Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($stats['sales_report'] as $inv)
            <tr>
                <td>{{ \Carbon\Carbon::parse($inv->created_at)->format('M d, Y') }}</td>
                <td>
                    <div class="font-mono font-bold">{{ $inv->invoice_number }}</div>
                    <div style="font-size: 8px; color: #94a3b8;">OR: {{ $inv->or_number ?? 'PENDING' }}</div>
                </td>
                <td>{{ $inv->booking?->sender?->first_name }} {{ $inv->booking?->sender?->last_name }}</td>
                @if($hasVatData)
                <td class="text-right">{{ $currencySymbol }}{{ number_format($inv->vatable_revenue, 2) }}</td>
                <td class="text-right">{{ $currencySymbol }}{{ number_format($inv->vat_amount, 2) }}</td>
                @endif
                <td class="text-right font-bold">{{ $currencySymbol }}{{ number_format($inv->amount, 2) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    @endif

</body>
</html>
