<?php

namespace App\Http\Controllers\Admin;

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
}
