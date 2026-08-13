<?php

namespace App\Http\Controllers\Admin;

use App\Enums\CommissionStatus;
use App\Enums\CommissionType;
use App\Enums\PayoutMethod;
use App\Http\Controllers\Controller;
use App\Models\Payout;
use App\Models\Setting;
use App\Models\User;
use App\Services\PaymentService;
use App\Services\SettingsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class CommissionController extends Controller
{
    public function index()
    {
        $pickers = User::where('role', 'picker')
            ->withSum(['commissions as pending_amount' => function ($query) {
                $query->where('status', CommissionStatus::PENDING->value);
            }], 'amount')
            ->withCount(['commissions as pending_count' => function ($query) {
                $query->where('status', CommissionStatus::PENDING->value);
            }])
            ->get();

        $settings = app(SettingsService::class);
        $defaultType = $settings->get('commission_default_type', CommissionType::FLAT->value);
        $ratesSetting = $settings->get('commission_default_rates', '{"amount": 0}');
        $defaultRates = is_array($ratesSetting) ? $ratesSetting : json_decode($ratesSetting, true);
        $distanceRate = $settings->get('distance_rate_per_km', 0);
        $cancellationFee = $settings->get('cancellation_flat_fee', 0);
        $payoutMinimumThreshold = $settings->get('payout_minimum_threshold', 0);

        return Inertia::render('admin/commissions/index', [
            'pickers' => $pickers,
            'default_type' => $defaultType,
            'default_rates' => $defaultRates,
            'distance_rate_per_km' => $distanceRate,
            'cancellation_flat_fee' => $cancellationFee,
            'payout_minimum_threshold' => (float) $payoutMinimumThreshold,
        ]);
    }

    public function payouts()
    {
        $payouts = Payout::with(['picker', 'processedByUser'])
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        return Inertia::render('admin/commissions/payouts', [
            'payouts' => $payouts,
        ]);
    }

    public function processPayout(Request $request, User $picker, PaymentService $paymentService)
    {
        $validated = $request->validate([
            'payout_method' => ['required', Rule::enum(PayoutMethod::class)],
            'payout_provider' => 'nullable|required_if:payout_method,ewallet|string|max:100',
            'reference_number' => 'required|string|max:255',
            'notes' => 'nullable|string|max:1000',
        ]);

        $payoutMethod = PayoutMethod::from($validated['payout_method']);

        try {
            DB::transaction(function () use ($request, $picker, $paymentService, $payoutMethod, $validated) {
                $commissions = $picker->commissions()
                    ->where('status', CommissionStatus::PENDING->value)
                    ->lockForUpdate()
                    ->get();

                if ($commissions->isEmpty()) {
                    throw new \Exception('No pending commissions for this picker.');
                }

                $totalAmount = (float) $commissions->sum('amount');

                $settings = app(\App\Services\SettingsService::class);
                $payoutMinimumThreshold = (float) $settings->get('payout_minimum_threshold', 0);

                if ($totalAmount <= 0) {
                    throw new \Exception('Payout amount must be greater than zero.');
                }
                
                if ($totalAmount < $payoutMinimumThreshold) {
                    throw new \Exception('Payout amount does not meet the minimum threshold of $' . number_format($payoutMinimumThreshold, 2) . '.');
                }

                $payout = Payout::create([
                    'picker_id' => $picker->id,
                    'total_amount' => $totalAmount,
                    'payout_method' => $payoutMethod->value,
                    'payout_provider' => $payoutMethod === PayoutMethod::Ewallet ? $validated['payout_provider'] : null,
                    'reference_number' => $validated['reference_number'],
                    'notes' => $validated['notes'] ?? null,
                    'processed_by' => $request->user()->id,
                    'paid_at' => now(),
                ]);

                $picker->commissions()
                    ->where('status', CommissionStatus::PENDING->value)
                    ->update([
                        'status' => CommissionStatus::PAID->value,
                        'payout_id' => $payout->id,
                    ]);

                if ($payoutMethod === PayoutMethod::Stripe) {
                    if (! $picker->stripe_account_id || ! $picker->stripe_onboarding_completed) {
                        throw new \Exception('Picker Stripe account is not fully configured. Choose cash or e-wallet for a manual payout.');
                    }

                    $transfer = $paymentService->transferToConnectedAccount($payout);
                    $payout->update(['reference_number' => $payout->reference_number ? $payout->reference_number.' | '.$transfer->id : $transfer->id]);
                }
            });
        } catch (\Exception $e) {
            Log::warning('Commission payout failed.', [
                'picker_id' => $picker->id,
                'error' => $e->getMessage(),
            ]);

            return back()->with('error', $this->payoutFailureMessage($e));
        }

        return back()->with('success', 'Payout processed successfully.');
    }

    private function payoutFailureMessage(\Exception $e): string
    {
        $message = $e->getMessage();

        if (str_contains(strtolower($message), 'insufficient available funds')) {
            return app()->environment('production')
                ? 'Stripe transfer failed: The platform Stripe account has insufficient available balance. Add funds to your Stripe balance and retry.'
                : 'Stripe transfer failed: The platform Stripe account has insufficient available balance. In test mode, add funds or create a charge with Stripe test card 4000000000000077, then retry.';
        }

        return $message;
    }

    public function updateGlobalSettings(Request $request)
    {
        $request->validate([
            'commission_type' => 'required|string|in:flat,size,percentage',
            'commission_rates' => 'required|array',
            'distance_rate_per_km' => 'nullable|numeric|min:0',
            'cancellation_flat_fee' => 'nullable|numeric|min:0',
            'payout_minimum_threshold' => 'nullable|numeric|min:0',
        ]);

        Setting::updateOrCreate(
            ['key' => 'commission_default_type'],
            [
                'value' => $request->input('commission_type'),
                'type' => 'string',
                'group' => 'commission',
                'display_name' => 'Default Commission Type',
            ]
        );

        Setting::updateOrCreate(
            ['key' => 'commission_default_rates'],
            [
                'value' => json_encode($request->input('commission_rates')),
                'type' => 'json',
                'group' => 'commission',
                'display_name' => 'Default Commission Rates',
            ]
        );

        if ($request->has('distance_rate_per_km')) {
            Setting::updateOrCreate(
                ['key' => 'distance_rate_per_km'],
                [
                    'value' => (string) $request->input('distance_rate_per_km'),
                    'type' => 'string',
                    'group' => 'commission',
                    'display_name' => 'Distance Rate per km',
                ]
            );
        }

        if ($request->has('cancellation_flat_fee')) {
            Setting::updateOrCreate(
                ['key' => 'cancellation_flat_fee'],
                [
                    'value' => (string) $request->input('cancellation_flat_fee'),
                    'type' => 'string',
                    'group' => 'commission',
                    'display_name' => 'Cancellation Flat Fee',
                ]
            );
        }

        if ($request->has('payout_minimum_threshold')) {
            Setting::updateOrCreate(
                ['key' => 'payout_minimum_threshold'],
                [
                    'value' => (string) $request->input('payout_minimum_threshold'),
                    'type' => 'string',
                    'group' => 'commission',
                    'display_name' => 'Minimum Payout Threshold',
                ]
            );
        }

        // Clear cache
        $settingsService = app(SettingsService::class);
        $settingsService->forget('commission_default_type', 'commission');
        $settingsService->forget('commission_default_rates', 'commission');
        $settingsService->forget('distance_rate_per_km', 'commission');
        $settingsService->forget('cancellation_flat_fee', 'commission');
        $settingsService->forget('payout_minimum_threshold', 'commission');

        return back()->with('success', 'Global commission settings updated successfully.');
    }
}
