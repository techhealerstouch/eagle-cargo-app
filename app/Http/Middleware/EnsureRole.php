<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    /**
     * Handle an incoming request.
     * Usage: ->middleware('role:courier') or ->middleware('role:admin,super_admin')
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! in_array($user->role->value, $roles)) {
            abort(403, 'Unauthorized action.');
        }

        return $next($request);
    }
}
