<?php

namespace App\Http\Controllers;

abstract class Controller
{
    /**
     * Get the preserved return URL for an admin index route, or fall back to the default route.
     */
    protected function adminReturnUrl(string $defaultRoute, ?string $resourceRoute = null): string
    {
        $targetRoute = $resourceRoute ?? $defaultRoute;
        $returnUrl = request()->input('return_to') ?? session("admin_return_urls.{$targetRoute}");
        if ($returnUrl) {
            return $returnUrl;
        }

        $fallback = session('admin_return_url');
        if ($fallback) {
            $resourceSegment = str_replace(['admin.', '.index', '.pickups', '.deliveries'], '', $defaultRoute);
            if ($resourceSegment === '' || str_contains($fallback, $resourceSegment)) {
                return $fallback;
            }
        }

        return route($defaultRoute);
    }
}

