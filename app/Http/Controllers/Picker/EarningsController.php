<?php

namespace App\Http\Controllers\Picker;

use App\Enums\CommissionStatus;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class EarningsController extends Controller
{
    public function index()
    {
        $picker = Auth::user();

        $pendingAmount = $picker->commissions()
            ->where('status', CommissionStatus::PENDING->value)
            ->sum('amount');

        $pendingCommissions = $picker->commissions()
            ->where('status', CommissionStatus::PENDING->value)
            ->with('box')
            ->orderBy('created_at', 'desc')
            ->get();

        $lifetimeEarnings = $picker->payouts()->sum('total_amount');

        $payouts = $picker->payouts()
            ->with(['commissions.box', 'processedByUser'])
            ->orderBy('created_at', 'desc')
            ->paginate(15);
            
        $externalAccounts = [];
        if ($picker->stripe_account_id && $picker->stripe_onboarding_completed) {
            try {
                \Stripe\Stripe::setApiKey(config('services.stripe.secret'));
                $account = \Stripe\Account::retrieve($picker->stripe_account_id);
                $externalAccounts = $account->external_accounts->data;
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error('Failed to fetch external accounts: ' . $e->getMessage());
            }
        }

        $settings = app(\App\Services\SettingsService::class);
        $payoutMinimumThreshold = (float) $settings->get('payout_minimum_threshold', 0);

        return Inertia::render('picker/earnings', [
            'pendingAmount' => (float) $pendingAmount,
            'pendingCommissions' => $pendingCommissions,
            'payouts' => $payouts,
            'lifetimeEarnings' => (float) $lifetimeEarnings,
            'externalAccounts' => $externalAccounts,
            'payoutMinimumThreshold' => $payoutMinimumThreshold,
        ]);
    }

    public function cashout(Request $request, \App\Services\PaymentService $paymentService)
    {
        $request->validate([
            'destination_account_id' => 'required|string',
        ]);

        $picker = Auth::user();
        
        $pendingAmount = $picker->commissions()
            ->where('status', CommissionStatus::PENDING->value)
            ->sum('amount');
            
        if ($pendingAmount <= 0) {
            return back()->with('error', 'You have no pending balance to cash out.');
        }

        $settings = app(\App\Services\SettingsService::class);
        $payoutMinimumThreshold = (float) $settings->get('payout_minimum_threshold', 0);

        if ($pendingAmount < $payoutMinimumThreshold) {
            return back()->with('error', 'Your pending balance does not meet the minimum cash out threshold of $' . number_format($payoutMinimumThreshold, 2) . '.');
        }

        try {
            $paymentService->processPickerCashout($picker, $request->input('destination_account_id'));
            return back()->with('success', 'Cash out initiated successfully!');
        } catch (\Exception $e) {
            return back()->with('error', $e->getMessage());
        }
    }
}
