<?php

use App\Http\Middleware\EnsureDeclarationSigned;
use App\Http\Middleware\EnsureRole;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->encryptCookies(except: ['appearance', 'sidebar_state']);
        $middleware->validateCsrfTokens(except: [
            'stripe/*',
        ]);

        $middleware->statefulApi();

        $middleware->alias([
            'role' => EnsureRole::class,
            'declaration.signed' => EnsureDeclarationSigned::class,
        ]);

        $middleware->web(append: [
            HandleAppearance::class,
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->reportable(function (\Illuminate\Validation\ValidationException $e) {
            \Illuminate\Support\Facades\Log::error('Validation Failed: ', $e->errors());
        });

        $exceptions->render(function (\RuntimeException $e, \Illuminate\Http\Request $request) {
            $msg = $e->getMessage();
            if (
                str_contains($msg, 'Unauthorized transition') ||
                str_contains($msg, 'not permitted by workflow') ||
                str_contains($msg, 'Cannot change box status')
            ) {
                if ($request->header('X-Inertia') || $request->expectsJson()) {
                    return redirect()->back()->with('error', $msg);
                }
            }
        });
    })->create();
