<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreShippingUpdateRequest;
use App\Models\ShippingUpdate;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ShippingUpdateController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', 'string', 'in:all,info,alert,success'],
            'is_published' => ['nullable', 'string', 'in:all,published,draft'],
            'sort' => ['nullable', 'string', 'in:title,type,is_published,created_at'],
            'direction' => ['nullable', 'string', 'in:asc,desc'],
        ]);

        $query = ShippingUpdate::with('creator');

        if (! empty($validated['search'])) {
            $search = trim($validated['search']);

            $query->where(function ($updateQuery) use ($search) {
                $updateQuery
                    ->where('title', 'like', "%{$search}%")
                    ->orWhere('body', 'like', "%{$search}%");
            });
        }

        if (! empty($validated['type']) && $validated['type'] !== 'all') {
            $query->where('type', $validated['type']);
        }

        if (! empty($validated['is_published']) && $validated['is_published'] !== 'all') {
            $query->where('is_published', $validated['is_published'] === 'published');
        }

        $sort = $validated['sort'] ?? 'created_at';
        $direction = $validated['direction'] ?? 'desc';

        $updates = $query
            ->orderBy($sort, $direction)
            ->orderBy('id', 'desc')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('admin/shipping-updates/index', [
            'updates' => $updates,
            'filters' => $request->only(['search', 'type', 'is_published', 'sort', 'direction']),
        ]);
    }

    public function create()
    {
        return Inertia::render('admin/shipping-updates/create');
    }

    public function store(StoreShippingUpdateRequest $request)
    {
        $validated = $request->validated();
        $validated['created_by'] = $request->user()?->id;

        if (isset($validated['is_published']) && $validated['is_published']) {
            $validated['published_at'] = now();
        }

        ShippingUpdate::create($validated);

        return redirect()->route('admin.shipping-updates.index')->with('success', 'Shipping update published.');
    }

    public function edit(ShippingUpdate $shippingUpdate)
    {
        return Inertia::render('admin/shipping-updates/edit', [
            'update' => $shippingUpdate,
        ]);
    }

    public function update(StoreShippingUpdateRequest $request, ShippingUpdate $shippingUpdate)
    {
        $validated = $request->validated();

        if (isset($validated['is_published']) && $validated['is_published'] && ! $shippingUpdate->published_at) {
            $validated['published_at'] = now();
        }

        $shippingUpdate->update($validated);

        return redirect()->route('admin.shipping-updates.index')->with('success', 'Shipping update saved.');
    }

    public function destroy(ShippingUpdate $shippingUpdate)
    {
        $shippingUpdate->delete();

        return redirect()->route('admin.shipping-updates.index')->with('success', 'Shipping update deleted.');
    }
}
