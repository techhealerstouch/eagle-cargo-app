<?php

namespace App\Http\Controllers\Admin;

use App\Services\AuditLogService;

use App\Enums\CommissionStatus;
use App\Enums\InvoiceStatus;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Box;
use App\Models\Commission;
use App\Models\GeneratedReport;
use App\Models\Invoice;
use App\Models\Payment;
use App\Services\SettingsService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class FinancialReportController extends Controller
{
    private const REPORT_TYPES = [
        'full' => 'Full Financial Report',
        'summary' => 'Executive Summary Report',
        'collections' => 'Collections Report',
        'receivables' => 'Receivables Aging Report',
        'revenue' => 'Revenue Analysis Report',
        'tax' => 'Tax & Audit Report',
    ];

    public function index(Request $request, SettingsService $settingsService)
    {
        $startDate = $request->input('start_date') ? Carbon::parse($request->input('start_date'))->startOfDay() : now()->startOfMonth();
        $endDate = $request->input('end_date') ? Carbon::parse($request->input('end_date'))->endOfDay() : now()->endOfMonth();

        $data = $this->getFinancialStats($startDate, $endDate);

        $reportHistory = GeneratedReport::with('user')
            ->where('type', 'financial')
            ->latest()
            ->limit(10)
            ->get();

        return Inertia::render('admin/reports/financial', [
            'stats' => $data['stats'],
            'sales_report' => $data['sales_report_paginated'],
            'outstanding_report' => $data['outstanding_report'],
            'recent_payments' => $data['recent_payments'],
            'report_history' => $reportHistory,
            'filters' => [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
            ],
            'currencySymbol' => $settingsService->getGeneralSettings()['currencySymbol'],
            'taxLabel' => $settingsService->getInvoiceSettings()['taxLabel'],
        ]);
    }

    private function getFinancialStats(CarbonInterface $startDate, CarbonInterface $endDate, array $options = [])
    {
        // Calculate previous period for comparison
        $daysDiff = $startDate->diffInDays($endDate) + 1;
        $prevStartDate = (clone $startDate)->subDays($daysDiff);
        $prevEndDate = (clone $startDate)->subDay();

        $includeSalesPage = $options['include_sales_page'] ?? true;
        $includeSalesFull = $options['include_sales_full'] ?? false;
        $includeOutstandingReport = $options['include_outstanding_report'] ?? true;
        $includeRecentPayments = $options['include_recent_payments'] ?? true;

        // 1. Revenue Summary & Comparison
        $totalInvoiced = Invoice::whereBetween('created_at', [$startDate, $endDate])
            ->where('status', '!=', InvoiceStatus::Voided)
            ->sum('amount');
        $prevTotalInvoiced = Invoice::whereBetween('created_at', [$prevStartDate, $prevEndDate])
            ->where('status', '!=', InvoiceStatus::Voided)
            ->sum('amount');

        $totalCommissions = Commission::whereBetween('created_at', [$startDate, $endDate])
            ->where('status', '!=', CommissionStatus::CANCELLED->value)
            ->where('type', '!=', 'clawback')
            ->sum('amount');
        $prevTotalCommissions = Commission::whereBetween('created_at', [$prevStartDate, $prevEndDate])
            ->where('status', '!=', CommissionStatus::CANCELLED->value)
            ->where('type', '!=', 'clawback')
            ->sum('amount');
            
        $totalClawbacks = Commission::whereBetween('created_at', [$startDate, $endDate])
            ->where('status', '!=', CommissionStatus::CANCELLED->value)
            ->where('type', 'clawback')
            ->sum('amount');
        $prevTotalClawbacks = Commission::whereBetween('created_at', [$prevStartDate, $prevEndDate])
            ->where('status', '!=', CommissionStatus::CANCELLED->value)
            ->where('type', 'clawback')
            ->sum('amount');

        $totalCollected = Payment::whereBetween('paid_at', [$startDate, $endDate])
            ->where(function ($q) {
                $q->where('is_cash_payment', false)
                    ->orWhere(function ($q2) {
                        $q2->where('is_cash_payment', true)
                            ->whereNotNull('confirmed_at');
                    });
            })
            ->sum('amount');
        $prevTotalCollected = Payment::whereBetween('paid_at', [$prevStartDate, $prevEndDate])
            ->where(function ($q) {
                $q->where('is_cash_payment', false)
                    ->orWhere(function ($q2) {
                        $q2->where('is_cash_payment', true)
                            ->whereNotNull('confirmed_at');
                    });
            })
            ->sum('amount');

        // Collection rate: payments received against the SAME period's invoiced amount
        // This avoids the misleading scenario where collections from prior-period invoices
        // inflate the rate while current-period invoices remain outstanding.
        $collectedAgainstPeriodInvoices = (float) Payment::whereHas('invoice', function ($q) use ($startDate, $endDate) {
            $q->whereBetween('created_at', [$startDate, $endDate])
                ->where('status', '!=', InvoiceStatus::Voided);
        })->sum('amount');
        $collectionRate = $totalInvoiced > 0
            ? round(($collectedAgainstPeriodInvoices / $totalInvoiced) * 100, 1)
            : 0;

        // 2. Payment Method Breakdown
        $paymentMethods = Payment::whereBetween('paid_at', [$startDate, $endDate])
            ->select('payment_method', DB::raw('SUM(amount) as total'))
            ->groupBy('payment_method')
            ->get();

        // 3. Daily Revenue Trend
        $dailyRevenue = Payment::whereBetween('paid_at', [$startDate, $endDate])
            ->select(DB::raw('DATE(paid_at) as date'), DB::raw('SUM(amount) as total'))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        // 4. Revenue by Box Type
        $revenueByBoxType = Box::join('box_types', 'boxes.box_type_id', '=', 'box_types.id')
            ->join('bookings', 'boxes.booking_id', '=', 'bookings.id')
            ->join('invoices', 'bookings.id', '=', 'invoices.booking_id')
            ->whereBetween('invoices.created_at', [$startDate, $endDate])
            ->where('invoices.status', '!=', InvoiceStatus::Voided)
            ->select('box_types.name', DB::raw('SUM(boxes.price_charged) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('box_types.name')
            ->orderBy('total', 'desc')
            ->get();

        // 5. Revenue by Service Type
        $revenueByServiceType = Booking::join('invoices', 'bookings.id', '=', 'invoices.booking_id')
            ->whereBetween('invoices.created_at', [$startDate, $endDate])
            ->where('invoices.status', '!=', InvoiceStatus::Voided)
            ->select('bookings.service_type', DB::raw('SUM(invoices.amount) as total'))
            ->groupBy('bookings.service_type')
            ->get();

        // 6. Top Customers (Senders)
        $topCustomers = Invoice::join('bookings', 'invoices.booking_id', '=', 'bookings.id')
            ->join('senders', 'bookings.sender_id', '=', 'senders.id')
            ->whereBetween('invoices.created_at', [$startDate, $endDate])
            ->where('invoices.status', '!=', InvoiceStatus::Voided)
            ->select(
                'senders.id',
                'senders.first_name',
                'senders.last_name',
                DB::raw('SUM(invoices.amount) as total_revenue'),
                DB::raw('COUNT(invoices.id) as invoice_count')
            )
            ->groupBy('senders.id', 'senders.first_name', 'senders.last_name')
            ->orderBy('total_revenue', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($item) {
                $item->name = trim($item->first_name.' '.$item->last_name);

                return $item;
            });

        // 7. Recent Transactions
        $recentPayments = $includeRecentPayments
            ? Payment::with(['invoice.booking.sender'])
                ->whereBetween('paid_at', [$startDate, $endDate])
                ->latest('paid_at')
                ->limit(10)
                ->get()
            : collect();

        // 8. Unpaid Invoices Summary — only subtract settled payments
        $outstandingAmount = (float) Invoice::whereIn('status', [InvoiceStatus::Unpaid, InvoiceStatus::Partial])
            ->selectRaw('SUM(invoices.amount - COALESCE(settled.total, 0)) as outstanding')
            ->leftJoinSub(
                Payment::select('invoice_id', DB::raw('SUM(amount) as total'))
                    ->where(function ($q) {
                        $q->whereNotNull('paid_at')
                            ->orWhere('stripe_status', 'succeeded');
                    })
                    ->groupBy('invoice_id'),
                'settled',
                'invoices.id',
                'settled.invoice_id'
            )
            ->value('outstanding') ?? 0;
        // 9. VAT Summary
        $vatStats = Invoice::whereBetween('created_at', [$startDate, $endDate])
            ->where('status', '!=', InvoiceStatus::Voided)
            ->select(
                DB::raw('SUM(amount) as total_sales'),
                DB::raw('SUM(vatable_revenue) as vatable_sales'),
                DB::raw('SUM(vat_amount) as vat_amount'),
                DB::raw('SUM(vat_exempt_revenue) as vat_exempt_sales')
            )
            ->first();

        // 10. Daily Collection Detailed
        $dailyCollections = Payment::whereBetween('paid_at', [$startDate, $endDate])
            ->select(
                DB::raw('DATE(paid_at) as date'),
                DB::raw("SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END) as cash"),
                DB::raw("SUM(CASE WHEN payment_method = 'bank_transfer' THEN amount ELSE 0 END) as bank_transfer"),
                DB::raw("SUM(CASE WHEN payment_method NOT IN ('cash', 'bank_transfer') THEN amount ELSE 0 END) as other"),
                DB::raw('SUM(amount) as total'),
                DB::raw('COUNT(*) as transactions_count')
            )
            ->groupBy('date')
            ->orderBy('date', 'desc')
            ->get();

        // 11. Sales Report Data
        $salesReportPaginated = $includeSalesPage
            ? Invoice::with(['booking.sender', 'payments'])
                ->whereBetween('created_at', [$startDate, $endDate])
                ->where('status', '!=', InvoiceStatus::Voided)
                ->latest()
                ->paginate(20)
            : null;

        $salesReportFull = $includeSalesFull
            ? Invoice::with(['booking.sender', 'payments'])
                ->whereBetween('created_at', [$startDate, $endDate])
                ->where('status', '!=', InvoiceStatus::Voided)
                ->latest()
                ->get()
            : collect();

        // 12. Outstanding Report & Aging Analysis
        $outstandingReport = $includeOutstandingReport
            ? Invoice::with(['booking.sender', 'payments'])
                ->whereIn('status', [InvoiceStatus::Unpaid, InvoiceStatus::Partial])
                ->orderBy('due_date')
                ->get()
            : collect();

        $agingBuckets = [
            'current' => 0,         // Not yet due
            'overdue_30' => 0,      // 1-30 days
            'overdue_60' => 0,      // 31-60 days
            'overdue_90' => 0,      // 61-90 days
            'overdue_90_plus' => 0, // 91+ days
        ];

        foreach ($outstandingReport as $inv) {
            $paid = $inv->payments->sum('amount');
            $balance = $inv->amount - $paid;
            $daysOverdue = $inv->due_date ? now()->diffInDays(Carbon::parse($inv->due_date), false) : 0;

            // diffInDays returns negative if due date is in the past
            if ($daysOverdue >= 0) {
                $agingBuckets['current'] += $balance;
            } else {
                $absDays = abs($daysOverdue);
                if ($absDays <= 30) {
                    $agingBuckets['overdue_30'] += $balance;
                } elseif ($absDays <= 60) {
                    $agingBuckets['overdue_60'] += $balance;
                } elseif ($absDays <= 90) {
                    $agingBuckets['overdue_90'] += $balance;
                } else {
                    $agingBuckets['overdue_90_plus'] += $balance;
                }
            }
        }

        // Box-level total for reconciliation display
        $boxLevelTotal = (float) $revenueByBoxType->sum('total');

        return [
            'stats' => [
                'total_invoiced' => (float) $totalInvoiced,
                'prev_total_invoiced' => (float) $prevTotalInvoiced,
                'total_commissions' => (float) $totalCommissions,
                'prev_total_commissions' => (float) $prevTotalCommissions,
                'total_clawbacks' => (float) $totalClawbacks,
                'net_revenue' => (float) ($totalInvoiced - ($totalCommissions + $totalClawbacks)),
                'prev_net_revenue' => (float) ($prevTotalInvoiced - ($prevTotalCommissions + $prevTotalClawbacks)),
                'total_collected' => (float) $totalCollected,
                'prev_total_collected' => (float) $prevTotalCollected,
                'outstanding_amount' => (float) $outstandingAmount,
                'collection_rate' => $collectionRate,
                'collected_against_period' => $collectedAgainstPeriodInvoices,
                'box_level_total' => $boxLevelTotal,
                'payment_methods' => $paymentMethods,
                'daily_revenue' => $dailyRevenue,
                'revenue_by_box_type' => $revenueByBoxType,
                'revenue_by_service_type' => $revenueByServiceType,
                'top_customers' => $topCustomers,
                'vat_stats' => $vatStats,
                'daily_collections' => $dailyCollections,
                'days_in_period' => $daysDiff,
                'aging_buckets' => $agingBuckets,
                'other_revenue_adjustments' => $totalInvoiced - $boxLevelTotal,
            ],
            'sales_report_paginated' => $salesReportPaginated,
            'sales_report_full' => $salesReportFull,
            'outstanding_report' => $outstandingReport,
            'recent_payments' => $recentPayments,
        ];
    }

    public function downloadPdf(Request $request, SettingsService $settingsService)
    {
        $startDate = $request->input('start_date') ? Carbon::parse($request->input('start_date'))->startOfDay() : now()->startOfMonth();
        $endDate = $request->input('end_date') ? Carbon::parse($request->input('end_date'))->endOfDay() : now()->endOfMonth();
        $reportType = $this->normalizeReportType($request->input('report_type', 'full'));
        $reportTitle = self::REPORT_TYPES[$reportType];

        $needsOutstandingReport = in_array($reportType, ['full', 'receivables'], true);
        $needsSalesReport = in_array($reportType, ['full', 'tax'], true);

        $data = $this->getFinancialStats($startDate, $endDate, [
            'include_sales_page' => false,
            'include_sales_full' => $needsSalesReport,
            'include_outstanding_report' => $needsOutstandingReport,
            'include_recent_payments' => false,
        ]);

        $stats = $data['stats'];
        $stats['outstanding_report'] = $data['outstanding_report'];
        $stats['sales_report'] = $data['sales_report_full'];

        $pdf = Pdf::loadView('admin.reports.financial-pdf', [
            'stats' => $stats,
            'recent_payments' => $data['recent_payments'],
            'filters' => [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
            ],
            'currencySymbol' => $settingsService->getGeneralSettings()['currencySymbol'],
            'taxLabel' => $settingsService->getInvoiceSettings()['taxLabel'],
            'logoDataUri' => $this->getPdfLogoDataUri(),
            'reportType' => $reportType,
            'reportTitle' => $reportTitle,
        ]);

        $filename = 'financial-'.$reportType.'-report-'.$startDate->format('Y-m-d').'-to-'.$endDate->format('Y-m-d').'.pdf';

        GeneratedReport::create([
            'type' => 'financial',
            'filename' => $filename,
            'parameters' => [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'report_type' => $reportType,
                'report_title' => $reportTitle,
            ],
            'user_id' => $request->user()->id,
        ]);

        return $pdf->stream($filename);
    }

    private function normalizeReportType(?string $reportType): string
    {
        return array_key_exists($reportType, self::REPORT_TYPES) ? $reportType : 'full';
    }

    private function getPdfLogoDataUri(): ?string
    {
        $logoPath = public_path('eagle_logo.png');

        if (! is_file($logoPath) || ! function_exists('imagecreatefrompng') || ! function_exists('imagejpeg')) {
            return null;
        }

        $source = @imagecreatefrompng($logoPath);

        if (! $source) {
            return null;
        }

        $sourceWidth = imagesx($source);
        $sourceHeight = imagesy($source);
        $maxSize = 120;
        $scale = min($maxSize / $sourceWidth, $maxSize / $sourceHeight);
        $targetWidth = max(1, (int) round($sourceWidth * $scale));
        $targetHeight = max(1, (int) round($sourceHeight * $scale));

        $canvas = imagecreatetruecolor($targetWidth, $targetHeight);
        $white = imagecolorallocate($canvas, 255, 255, 255);

        imagefill($canvas, 0, 0, $white);
        imagealphablending($canvas, true);
        imagecopyresampled(
            $canvas,
            $source,
            0,
            0,
            0,
            0,
            $targetWidth,
            $targetHeight,
            $sourceWidth,
            $sourceHeight
        );

        ob_start();
        imagejpeg($canvas, null, 85);
        $bytes = ob_get_clean();

        imagedestroy($source);
        imagedestroy($canvas);

        if (! $bytes) {
            return null;
        }

        return 'data:image/jpeg;base64,'.base64_encode($bytes);
    }



    public function downloadCsv(Request $request, SettingsService $settingsService, AuditLogService $auditLogService)
    {
        $startDate = $request->input('start_date') ? Carbon::parse($request->input('start_date'))->startOfDay() : now()->startOfMonth();
        $endDate = $request->input('end_date') ? Carbon::parse($request->input('end_date'))->endOfDay() : now()->endOfMonth();

        $data = $this->getFinancialStats($startDate, $endDate, [
            'include_sales_page' => false,
            'include_sales_full' => true,
            'include_outstanding_report' => true,
            'include_recent_payments' => false,
        ]);

        $stats = $data['stats'];
        $sales = $data['sales_report_full'];
        $currencySymbol = $settingsService->getGeneralSettings()['currencySymbol'] ?? '$';
        $taxLabel = $settingsService->getInvoiceSettings()['taxLabel'] ?? 'GST';

        $filename = 'financial-report-'.$startDate->format('Y-m-d').'-to-'.$endDate->format('Y-m-d').'.csv';

        // Log export in GeneratedReport for history/audit
        GeneratedReport::create([
            'type' => 'financial',
            'filename' => $filename,
            'parameters' => [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'report_type' => 'csv_export',
                'report_title' => 'Financial CSV Export',
            ],
            'user_id' => $request->user()->id,
        ]);

        $auditLogService->logExportEvent('csv', 'Financial report exported as CSV', [
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'total_invoiced' => $stats['total_invoiced'],
            'total_collected' => $stats['total_collected'],
        ]);

        return response()->streamDownload(function () use ($stats, $sales, $currencySymbol, $taxLabel, $startDate, $endDate) {
            $handle = fopen('php://output', 'w');

            // UTF-8 BOM for Excel compatibility
            fprintf($handle, chr(0xEF).chr(0xBB).chr(0xBF));

            // Section 1: Executive Summary
            fputcsv($handle, ['=== EAGLE CARGO - FINANCIAL AUDIT REPORT ===']);
            fputcsv($handle, ['Period:', $startDate->format('Y-m-d').' to '.$endDate->format('Y-m-d')]);
            fputcsv($handle, ['Generated At:', now()->toIso8601String()]);
            fputcsv($handle, ['Currency:', $currencySymbol]);
            fputcsv($handle, []);

            fputcsv($handle, ['--- EXECUTIVE SUMMARY ---']);
            fputcsv($handle, ['Metric', 'Amount', 'Notes']);
            fputcsv($handle, ['Total Invoiced', number_format($stats['total_invoiced'], 2), 'Gross invoiced revenue (non-voided)']);
            fputcsv($handle, ['Courier Commissions (Gross)', number_format($stats['total_commissions'], 2), 'Courier commissions issued in period']);
            fputcsv($handle, ['Clawbacks Recovered', number_format($stats['total_clawbacks'], 2), 'Refund/cancellation commission recoveries']);
            fputcsv($handle, ['Net Courier Commissions', number_format($stats['net_commissions'], 2), 'Commissions less recovered clawbacks']);
            fputcsv($handle, ['Invoiced Revenue (Less Comm.)', number_format($stats['net_revenue'], 2), 'Total Invoiced - Net Courier Commissions']);
            fputcsv($handle, ['Total Settled Collections', number_format($stats['total_collected'], 2), 'Confirmed cash & electronic inflows']);
            fputcsv($handle, ['Period Unconfirmed Cash', number_format($stats['unconfirmed_cash'], 2), 'Cash collected by couriers pending admin confirmation']);
            fputcsv($handle, ['All-Time Unconfirmed Cash', number_format($stats['all_time_unconfirmed_cash'], 2), 'Total pending cash across all periods']);
            fputcsv($handle, ['Period Collection Rate', $stats['collection_rate'].'%', 'Settled collections against period invoices']);
            fputcsv($handle, ['Total Outstanding Receivables', number_format($stats['outstanding_amount'], 2), 'Open balance across unpaid/partial invoices (settled basis)']);
            fputcsv($handle, []);

            // Section 2: Receivables Aging
            fputcsv($handle, ['--- RECEIVABLES AGING BREAKDOWN (As of ' . ($stats['reference_date'] ?? $endDate->toDateString()) . ') ---']);
            fputcsv($handle, ['Bucket', 'Outstanding Amount']);
            fputcsv($handle, ['Current (Not yet due)', number_format($stats['aging_buckets']['current'] ?? 0, 2)]);
            fputcsv($handle, ['1-30 Days Overdue', number_format($stats['aging_buckets']['overdue_30'] ?? 0, 2)]);
            fputcsv($handle, ['31-60 Days Overdue', number_format($stats['aging_buckets']['overdue_60'] ?? 0, 2)]);
            fputcsv($handle, ['61-90 Days Overdue', number_format($stats['aging_buckets']['overdue_90'] ?? 0, 2)]);
            fputcsv($handle, ['90+ Days Overdue', number_format($stats['aging_buckets']['overdue_90_plus'] ?? 0, 2)]);
            fputcsv($handle, []);

            // Section 3: Payment Method Summary
            fputcsv($handle, ['--- SETTLED COLLECTIONS BY PAYMENT METHOD ---']);
            fputcsv($handle, ['Payment Method', 'Total Collected']);
            foreach ($stats['payment_methods'] as $pm) {
                fputcsv($handle, [ucwords(str_replace('_', ' ', $pm->payment_method)), number_format($pm->total, 2)]);
            }
            fputcsv($handle, []);

            // Section 4: Courier Cash Collections & In-Transit Float
            if (!empty($stats['courier_cash_collections']) && count($stats['courier_cash_collections']) > 0) {
                fputcsv($handle, ['--- COURIER CASH COLLECTIONS & IN-TRANSIT FLOAT ---']);
                fputcsv($handle, ['Courier / Collector', 'Txns', 'Confirmed (Banked)', 'Unconfirmed (In-Transit)', 'Total Cash Handled']);
                foreach ($stats['courier_cash_collections'] as $courier) {
                    fputcsv($handle, [
                        $courier['collector_name'],
                        $courier['count'],
                        number_format($courier['confirmed_total'], 2),
                        number_format($courier['unconfirmed_total'], 2),
                        number_format($courier['total'], 2),
                    ]);
                }
                fputcsv($handle, []);
            }

            // Section 5: Revenue by Box Type
            fputcsv($handle, ['--- REVENUE BY BOX TYPE ---']);
            fputcsv($handle, ['Box Type', 'Units Shipped', 'Total Revenue']);
            foreach ($stats['revenue_by_box_type'] as $box) {
                fputcsv($handle, [$box->name, $box->count, number_format($box->total, 2)]);
            }
            fputcsv($handle, []);

            // Section 6: Tax Summary
            fputcsv($handle, ['--- TAX & ' . strtoupper($taxLabel) . ' SUMMARY ---']);
            fputcsv($handle, ['Taxable Revenue', number_format($stats['vat_stats']->vatable_sales ?? 0, 2)]);
            fputcsv($handle, ['Tax-Exempt Revenue', number_format($stats['vat_stats']->vat_exempt_sales ?? 0, 2)]);
            fputcsv($handle, ['Tax Amount (' . $taxLabel . ')', number_format($stats['vat_stats']->vat_amount ?? 0, 2)]);
            fputcsv($handle, ['Gross Revenue', number_format($stats['vat_stats']->total_sales ?? 0, 2)]);
            fputcsv($handle, []);

            // Section 7: Invoices & Transactions Ledger
            fputcsv($handle, ['--- DETAILED INVOICE & SALES LEDGER ---']);
            fputcsv($handle, [
                'Invoice Date',
                'Invoice Number',
                'OR Number',
                'Sender ID',
                'Customer Name',
                'Booking Reference',
                'Service Type',
                'Status',
                'Due Date',
                'Taxable Revenue',
                'Tax Amount',
                'Total Amount',
                'Amount Paid (Settled)',
                'Balance',
            ]);

            foreach ($sales as $inv) {
                $paid = $inv->payments->filter(fn ($p) => $p->isSettled())->sum('amount');
                $balance = max(0, ((float) $inv->amount) - $paid);
                $senderName = trim(($inv->booking?->sender?->first_name ?? '') . ' ' . ($inv->booking?->sender?->last_name ?? ''));

                fputcsv($handle, [
                    $inv->created_at ? Carbon::parse($inv->created_at)->format('Y-m-d') : '',
                    $inv->invoice_number,
                    $inv->or_number ?? 'PENDING',
                    $inv->booking?->sender_id ?? '',
                    $senderName ?: 'N/A',
                    $inv->booking?->booking_number ?? $inv->booking_id,
                    $inv->booking?->service_type ?? 'N/A',
                    $inv->status instanceof \BackedEnum ? $inv->status->value : (string) $inv->status,
                    $inv->due_date ? Carbon::parse($inv->due_date)->format('Y-m-d') : '',
                    number_format($inv->vatable_revenue ?? 0, 2, '.', ''),
                    number_format($inv->vat_amount ?? 0, 2, '.', ''),
                    number_format($inv->amount, 2, '.', ''),
                    number_format($paid, 2, '.', ''),
                    number_format($balance, 2, '.', ''),
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store, no-cache',
        ]);
    }

}
