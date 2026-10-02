<?php

namespace App\Http\Middleware;

use App\Enums\Feature;
use App\Services\FeatureAccess;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class EnsureFeatureAccess
{
    public function __construct(private readonly FeatureAccess $featureAccess) {}

    public function handle(Request $request, Closure $next, string $featureKey): Response
    {
        $flag = $this->featureAccess->getFlag($featureKey);
        $enumFeature = Feature::tryFrom($featureKey);

        if ((! $flag && ! $enumFeature) || ! $request->user()) {
            abort(404);
        }

        if ($this->featureAccess->canAccess($request->user(), $featureKey)) {
            return $next($request);
        }

        if ($this->featureAccess->isUnderMaintenance($featureKey)) {
            if ($request->wantsJson() && ! $request->header('X-Inertia')) {
                return response()->json([
                    'message' => $flag?->maintenance_message ?: 'This module is currently undergoing scheduled maintenance.',
                    'feature' => $featureKey,
                    'status' => 'maintenance',
                ], 503);
            }

            return Inertia::render('feature-maintenance', [
                'feature' => [
                    'key' => $flag?->feature_key ?? $featureKey,
                    'name' => $flag?->name ?? ($enumFeature?->name() ?? $featureKey),
                    'message' => $flag?->maintenance_message,
                ],
            ])->toResponse($request)->setStatusCode(503);
        }

        abort(404);
    }
}
