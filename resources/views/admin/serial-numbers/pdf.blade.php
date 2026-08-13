<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Serial Numbers Report</title>
    <style>
        @page {
            margin: 40px 40px 60px 40px;
        }
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            font-size: 10px;
            color: #334155;
            line-height: 1.5;
            margin: 0;
            padding: 0;
        }

        /* Typography & Colors */
        .text-navy { color: #002D5B; }
        .text-rust { color: #8b2500; }
        .text-muted { color: #64748b; }
        .font-bold { font-weight: bold; }
        .uppercase { text-transform: uppercase; }

        /* Header */
        .header {
            width: 100%;
            margin-bottom: 25px;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 15px;
        }
        .report-title {
            font-size: 22px;
            font-weight: bold;
            color: #002D5B;
            margin: 0 0 5px 0;
            letter-spacing: -0.5px;
        }
        .report-subtitle {
            font-size: 11px;
            color: #64748b;
            margin: 0;
        }
        .brand-name {
            font-weight: 800;
            font-size: 18px;
            color: #002D5B;
            line-height: 1;
            letter-spacing: -0.5px;
            margin-bottom: 2px;
        }
        .brand-sub {
            font-weight: 800;
            font-size: 11px;
            color: #8b2500;
            letter-spacing: 1.5px;
        }

        /* Stats Cards */
        .stats-grid {
            width: 100%;
            border-collapse: separate;
            border-spacing: 8px 0;
            margin: 0 -8px 25px -8px;
        }
        .stat-card {
            background: #f8fafc;
            padding: 15px 12px;
            text-align: center;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
        }
        .stat-card-total { border-top: 3px solid #002D5B; }
        .stat-card-available { border-top: 3px solid #16a34a; }
        .stat-card-allocated { border-top: 3px solid #2563eb; }
        .stat-card-assigned { border-top: 3px solid #9333ea; }
        .stat-card-void { border-top: 3px solid #dc2626; }

        .stat-value {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 4px;
        }
        .stat-label {
            font-size: 9px;
            font-weight: bold;
            text-transform: uppercase;
            color: #64748b;
            letter-spacing: 0.5px;
        }

        /* Tables */
        table.data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        table.data-table th {
            background-color: #f1f5f9;
            color: #475569;
            font-weight: bold;
            text-align: left;
            padding: 10px 12px;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.5px;
            border-top: 1px solid #cbd5e1;
            border-bottom: 2px solid #cbd5e1;
        }
        table.data-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: middle;
        }
        table.data-table tr:nth-child(even) { background-color: #f8fafc; }

        .font-mono {
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            font-weight: bold;
            color: #0f172a;
        }

        /* Footer */
        .footer {
            position: fixed;
            bottom: -40px;
            left: 0;
            right: 0;
            height: 30px;
            font-size: 9px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 10px;
        }
        .footer table {
            width: 100%;
            border: none;
        }
        .footer td {
            padding: 0;
            border: none;
        }
        .page-number:before {
            content: "Page " counter(page);
        }

        /* Badges */
        .status-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .status-available { background-color: #dcfce7; color: #16a34a; border: 1px solid #bbf7d0; }
        .status-allocated { background-color: #dbeafe; color: #2563eb; border: 1px solid #bfdbfe; }
        .status-assigned { background-color: #f3e8ff; color: #9333ea; border: 1px solid #e9d5ff; }
        .status-void { background-color: #fee2e2; color: #dc2626; border: 1px solid #fecaca; }

        /* Info Box */
        .info-box {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-left: 4px solid #22c55e;
            padding: 10px 15px;
            font-size: 10px;
            color: #166534;
            margin-bottom: 20px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="footer">
        <table style="width: 100%;">
            <tr>
                <td style="text-align: left; width: 33%;">Love Balikbayan Logistics</td>
                <td style="text-align: center; width: 33%;">Serial Numbers Registry</td>
                <td style="text-align: right; width: 33%;"><span class="page-number"></span></td>
            </tr>
        </table>
    </div>

    <div class="header">
        <table style="width: 100%; border: none; border-spacing: 0;">
            <tr>
                <td style="border: none; padding: 0; vertical-align: middle; width: 50%;">
                    <div class="brand-name">Love Balikbayan Box</div>
                    <div class="brand-sub">SEA CARGO</div>
                </td>
                <td style="border: none; padding: 0; text-align: right; vertical-align: middle; width: 50%;">
                    <h1 class="report-title">Serial Numbers Registry</h1>
                    <div class="report-subtitle">Generated: {{ now()->format('F d, Y h:i A') }}</div>
                </td>
            </tr>
        </table>
    </div>

    @if($isTruncated ?? false)
        <div class="info-box">
            <strong>Notice:</strong> This report has been limited to the first 250 records (out of {{ number_format($totalCount) }} total matching entries) to ensure fast PDF generation. Please use the dashboard filters for more specific reporting.
        </div>
    @endif

    <!-- Summary stats cards -->
    <table class="stats-grid" style="border: none;">
        <tr>
            <td style="width: 20%; border: none; padding: 0 4px;">
                <div class="stat-card stat-card-total">
                    <div class="stat-value" style="color: #002D5B;">{{ number_format($stats['total'] ?? 0) }}</div>
                    <div class="stat-label">Total Pool</div>
                </div>
            </td>
            <td style="width: 20%; border: none; padding: 0 4px;">
                <div class="stat-card stat-card-available">
                    <div class="stat-value" style="color: #16a34a;">{{ number_format($stats['available'] ?? 0) }}</div>
                    <div class="stat-label">Available</div>
                </div>
            </td>
            <td style="width: 20%; border: none; padding: 0 4px;">
                <div class="stat-card stat-card-allocated">
                    <div class="stat-value" style="color: #2563eb;">{{ number_format($stats['allocated'] ?? 0) }}</div>
                    <div class="stat-label">Allocated</div>
                </div>
            </td>
            <td style="width: 20%; border: none; padding: 0 4px;">
                <div class="stat-card stat-card-assigned">
                    <div class="stat-value" style="color: #9333ea;">{{ number_format($stats['assigned'] ?? 0) }}</div>
                    <div class="stat-label">Assigned</div>
                </div>
            </td>
            <td style="width: 20%; border: none; padding: 0 4px;">
                <div class="stat-card stat-card-void">
                    <div class="stat-value" style="color: #dc2626;">{{ number_format($stats['void'] ?? 0) }}</div>
                    <div class="stat-label">Voided</div>
                </div>
            </td>
        </tr>
    </table>

    <!-- Data Tables -->
    @forelse($serialNumbers->chunk(45) as $chunkIndex => $chunk)
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 18%;">Serial Number</th>
                    <th style="width: 14%;">Status</th>
                    <th style="width: 20%;">Assigned Box</th>
                    <th style="width: 20%;">Sender Name</th>
                    <th style="width: 16%;">Allocated At</th>
                    <th style="width: 12%;">Assigned By</th>
                </tr>
            </thead>
            <tbody>
                @foreach($chunk as $sn)
                    <tr>
                        <td class="font-mono">{{ $sn->serial_number }}</td>
                        <td>
                            @if($sn->status->value === 'Available')
                                <span class="status-badge status-available">Available</span>
                            @elseif($sn->status->value === 'Allocated')
                                <span class="status-badge status-allocated">Allocated</span>
                            @elseif($sn->status->value === 'Assigned')
                                <span class="status-badge status-assigned">Assigned</span>
                            @else
                                <span class="status-badge status-void">Void</span>
                            @endif
                        </td>
                        <td style="color: #475569; font-weight: 500;">{{ $sn->box ? $sn->box->tracking_number : '-' }}</td>
                        <td style="color: #0f172a;">{{ $sn->box && $sn->box->booking && $sn->box->booking->sender ? $sn->box->booking->sender->first_name . ' ' . $sn->box->booking->sender->last_name : '-' }}</td>
                        <td style="color: #475569;">{{ $sn->allocated_at ? \Carbon\Carbon::parse($sn->allocated_at)->format('M d, Y') : '-' }}<br><span style="font-size: 8px; color: #94a3b8;">{{ $sn->allocated_at ? \Carbon\Carbon::parse($sn->allocated_at)->format('H:i') : '' }}</span></td>
                        <td style="color: #475569;">{{ $sn->assignedByUser ? $sn->assignedByUser->name : '-' }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
        
        @if(!$loop->last)
            <div style="page-break-after: always;"></div>
        @endif
    @empty
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 18%;">Serial Number</th>
                    <th style="width: 14%;">Status</th>
                    <th style="width: 20%;">Assigned Box</th>
                    <th style="width: 20%;">Sender Name</th>
                    <th style="width: 16%;">Allocated At</th>
                    <th style="width: 12%;">Assigned By</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px 20px; color: #64748b;">No serial numbers found for this report.</td>
                </tr>
            </tbody>
        </table>
    @endforelse
</body>
</html>
