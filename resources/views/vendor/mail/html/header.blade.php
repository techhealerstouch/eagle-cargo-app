@props(['url'])
@php
    $logoSrc = null;
    $appName = config('app.name');
    try {
        $settingsService = resolve(App\Services\SettingsService::class);
        $generalSettings = $settingsService->getGeneralSettings();
        $appName = $generalSettings['appName'] ?? $appName;
        $logoUrl = $generalSettings['appLogo'] ?? null;

        // Resolve local file for inline CID embedding (works even when APP_URL is localhost)
        $localPath = null;
        if (file_exists(public_path('images/logo-email.png'))) {
            $localPath = public_path('images/logo-email.png');
        } elseif (file_exists(public_path('images/eagle_logo.png'))) {
            $localPath = public_path('images/eagle_logo.png');
        } elseif ($logoUrl) {
            $path = parse_url($logoUrl, PHP_URL_PATH);
            if ($path && file_exists(public_path($path))) {
                $localPath = public_path($path);
            }
        }

        if ($localPath && isset($message) && is_object($message) && method_exists($message, 'embed')) {
            $logoSrc = $message->embed($localPath);
        } else {
            $logoSrc = $logoUrl;
        }
    } catch (\Exception $e) {
        // Fallback if settings service or database is not available
    }
@endphp
<tr>
<td class="header" style="text-align: center; padding: 25px 0;">
<a href="{{ $url }}" style="display: inline-block; text-decoration: none;">
@if ($logoSrc)
    <img src="{{ $logoSrc }}" alt="{{ $appName }}" style="height: 75px; max-height: 75px; width: auto; max-width: 280px; display: block; margin: 0 auto; object-fit: contain;">
@else
    <span style="font-size: 20px; font-weight: bold; color: #0a2540; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">{{ $appName }}</span>
@endif
</a>
</td>
</tr>

