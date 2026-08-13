<?php

namespace App\Http\Controllers\Picker;

use App\Http\Controllers\Controller;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;

class StripeOnboardingController extends Controller
{
    public function index(PaymentService $paymentService)
    {
        $picker = Auth::user();
        
        // Refresh status just in case they finished onboarding out-of-band
        if ($picker->stripe_account_id && !$picker->stripe_onboarding_completed) {
            $paymentService->checkConnectedAccountStatus($picker);
            $picker->refresh();
        }

        return Inertia::render('picker/payout-settings', [
            'stripe_account_id' => $picker->stripe_account_id,
            'stripe_onboarding_completed' => (bool)$picker->stripe_onboarding_completed,
            'preferred_payout_method' => $picker->preferred_payout_method,
            'ewallet_details' => $picker->ewallet_details,
        ]);
    }

    public function updatePreferences(Request $request)
    {
        $request->validate([
            'preferred_payout_method' => 'required|string|in:stripe,cash,ewallet',
            'ewallet_provider' => 'required_if:preferred_payout_method,ewallet|nullable|string',
            'ewallet_account' => 'required_if:preferred_payout_method,ewallet|nullable|string',
        ]);

        $picker = Auth::user();
        
        $ewalletDetails = null;
        if ($request->preferred_payout_method === 'ewallet') {
            $ewalletDetails = [
                'provider' => $request->ewallet_provider,
                'account' => $request->ewallet_account,
            ];
        }

        $picker->update([
            'preferred_payout_method' => $request->preferred_payout_method,
            'ewallet_details' => $ewalletDetails,
        ]);

        return back()->with('success', 'Payout preferences updated successfully.');
    }

    public function start(PaymentService $paymentService)
    {
        $picker = Auth::user();

        if ($picker->stripe_onboarding_completed) {
            return redirect()->route('picker.stripe.onboarding')->with('info', 'Your account is already connected.');
        }

        try {
            $onboardingUrl = $paymentService->createConnectedAccount($picker);
            return Inertia::location($onboardingUrl);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Stripe Onboarding URL creation failed: ' . $e->getMessage());
            
            $errorMessage = $e->getMessage();
            $friendlyMessage = 'Unable to connect to the payment provider at this time. Please try again later.';

            if (str_contains($errorMessage, 'signed up for Connect')) {
                $friendlyMessage = 'The payout system is currently being set up by the platform administrators. Please try again later or contact support.';
            }

            return back()->with('error', $friendlyMessage);
        }
    }

    public function success(PaymentService $paymentService)
    {
        $picker = Auth::user();
        $paymentService->checkConnectedAccountStatus($picker);

        return redirect()->route('picker.stripe.onboarding')->with('success', 'Stripe connection updated successfully.');
    }

    public function manage(PaymentService $paymentService)
    {
        $picker = Auth::user();

        if (!$picker->stripe_account_id) {
            return back()->with('error', 'No Stripe account connected.');
        }

        try {
            \Stripe\Stripe::setApiKey(config('services.stripe.secret'));
            $loginLink = \Stripe\Account::createLoginLink($picker->stripe_account_id);
            return Inertia::location($loginLink->url);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Stripe Login Link creation failed: ' . $e->getMessage());
            return back()->with('error', 'Unable to generate Stripe dashboard link. Please try again later.');
        }
    }
}
