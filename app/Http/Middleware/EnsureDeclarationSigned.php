<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureDeclarationSigned
{
    /**
     * Handle an incoming request.
     *
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        // Retired: Customs declaration is no longer enforced as a hard blocker at the routing/middleware level.
        // Bookings can now be accepted/confirmed, updated, scanned, and collected without a declaration form
        // since the declaration form can also be completed/handed over during pickup (by the picker) or later.
        return $next($request);
    }
}
