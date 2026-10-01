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

        // 1. Direct return_to query or post input (must be non-empty string)
        $returnUrl = request()->input('return_to');
        if (is_string($returnUrl) && !empty($returnUrl)) {
            return $returnUrl;
        }

        // 2. Check flat admin_return_urls_map in session
        $urlsMap = session('admin_return_urls_map');
        if (is_array($urlsMap) && !empty($urlsMap[$targetRoute]) && is_string($urlsMap[$targetRoute])) {
            return $urlsMap[$targetRoute];
        }

        // 3. Check legacy admin_return_urls (safeguarding against nested array collisions)
        $sessionReturn = session("admin_return_urls.{$targetRoute}");
        if (is_string($sessionReturn) && !empty($sessionReturn)) {
            return $sessionReturn;
        } elseif (is_array($sessionReturn)) {
            // If dot-notation created a nested array (e.g. pickups.calendar), find the first valid URL
            $flattened = \Illuminate\Support\Arr::flatten($sessionReturn);
            foreach ($flattened as $url) {
                if (is_string($url) && filter_var($url, FILTER_VALIDATE_URL)) {
                    return $url;
                }
            }
        }

        // 4. Fallback to general admin_return_url
        $fallback = session('admin_return_url');
        if (is_string($fallback) && !empty($fallback)) {
            $resourceSegment = str_replace(['admin.', '.index', '.pickups', '.deliveries'], '', $defaultRoute);
            if ($resourceSegment === '' || str_contains($fallback, $resourceSegment)) {
                return $fallback;
            }
        }

        // 5. Default route
        return route($defaultRoute);
    }
}
