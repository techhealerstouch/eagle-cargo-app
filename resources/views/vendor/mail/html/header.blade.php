@props(['url'])
@php
    $logoUrl = null;
    $appName = config('app.name');
    try {
        $settingsService = resolve(App\Services\SettingsService::class);
        $generalSettings = $settingsService->getGeneralSettings();
        $logoUrl = $generalSettings['appLogo'] ?? null;
        $appName = $generalSettings['appName'] ?? $appName;
    } catch (\Exception $e) {
        // Fallback if settings service or database is not available
    }
@endphp
<tr>
<td class="header" style="text-align: center; padding: 25px 0;">
<a href="{{ $url }}" style="display: inline-block; text-decoration: none;">
@if ($logoUrl)
    <img src="{{ $logoUrl }}" alt="{{ $appName }}" style="height: 75px; max-height: 75px; width: auto; max-width: 280px; display: block; margin: 0 auto; object-fit: contain;">
@else
    <span style="font-size: 20px; font-weight: bold; color: #0a2540; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">{{ $appName }}</span>
@endif
</a>
</td>
</tr>
