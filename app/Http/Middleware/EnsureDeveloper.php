<?php

namespace App\Http\Middleware;

use App\Services\DeveloperAccess;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureDeveloper
{
    public function __construct(private readonly DeveloperAccess $developerAccess) {}

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $isDeveloper = $this->developerAccess->isDeveloper($user)
            || (bool) $request->session()->get('impersonated_by_developer');

        abort_unless($isDeveloper, 404);

        return $next($request);
    }
}
