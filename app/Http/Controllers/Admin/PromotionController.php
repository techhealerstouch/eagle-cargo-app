<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BoxType;
use App\Models\PickupZone;
use App\Models\Promotion;
use App\Models\PromotionRedemption;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class PromotionController extends Controller
{
    public function index(Request $request)
    {
        $query = Promotion::withCount('redemptions');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                  ->orWhere('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('status')) {
            $status = $request->input('status');
            if ($status === 'active') {
                $query->where('is_active', true)
                      ->where(function ($q) {
                          $q->whereNull('valid_to')->orWhere('valid_to', '>=', now());
                      });
            } elseif ($status === 'inactive') {
                $query->where('is_active', false);
            } elseif ($status === 'expired') {
                $query->whereNotNull('valid_to')->where('valid_to', '<', now());
            }
        }

        $promotions = $query->latest()->paginate(20)->withQueryString();

        $stats = [
            'total' => Promotion::count(),
            'active' => Promotion::where('is_active', true)
                ->where(function ($q) {
                    $q->whereNull('valid_to')->orWhere('valid_to', '>=', now());
                })->count(),
            'total_redemptions' => PromotionRedemption::count(),
            'total_discount_disbursed' => (float) PromotionRedemption::sum('discount_amount'),
        ];

        $pickupZones = PickupZone::select('id', 'name', 'code')->where('is_active', true)->get();
        $boxTypes = BoxType::select('id', 'name', 'dimensions')->where('is_active', true)->get();

        return Inertia::render('admin/promotions/Index', [
            'promotions' => $promotions,
            'stats' => $stats,
            'pickupZones' => $pickupZones,
            'boxTypes' => $boxTypes,
            'filters' => $request->only(['search', 'type', 'status']),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50', 'unique:promotions,code'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'type' => ['required', 'string', Rule::in(['fixed_discount', 'percentage_discount', 'per_box_discount', 'waive_empty_box_fee', 'buy_x_get_y_free'])],
            'value' => ['required', 'numeric', 'min:0'],
            'min_box_count' => ['required', 'integer', 'min:1'],
            'buy_quantity' => ['nullable', 'integer', 'min:2'],
            'free_quantity' => ['nullable', 'integer', 'min:1'],
            'min_spend' => ['nullable', 'numeric', 'min:0'],
            'max_discount' => ['nullable', 'numeric', 'min:0'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'max_uses_per_user' => ['required', 'integer', 'min:1'],
            'applicable_pickup_zones' => ['nullable', 'array'],
            'applicable_box_types' => ['nullable', 'array'],
            'first_time_sender_only' => ['boolean'],
            'valid_from' => ['nullable', 'date'],
            'valid_to' => ['nullable', 'date', 'after_or_equal:valid_from'],
            'is_active' => ['boolean'],
        ]);

        // Auto-sync min_box_count with buy_quantity for buy_x_get_y_free promotions
        if ($validated['type'] === 'buy_x_get_y_free' && !empty($validated['buy_quantity'])) {
            $validated['min_box_count'] = $validated['buy_quantity'];
        }

        Promotion::create($validated);

        return redirect()->back()->with('success', 'Promotion created successfully.');
    }

    public function update(Request $request, Promotion $promotion)
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:50', Rule::unique('promotions')->ignore($promotion)],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'type' => ['required', 'string', Rule::in(['fixed_discount', 'percentage_discount', 'per_box_discount', 'waive_empty_box_fee', 'buy_x_get_y_free'])],
            'value' => ['required', 'numeric', 'min:0'],
            'min_box_count' => ['required', 'integer', 'min:1'],
            'buy_quantity' => ['nullable', 'integer', 'min:2'],
            'free_quantity' => ['nullable', 'integer', 'min:1'],
            'min_spend' => ['nullable', 'numeric', 'min:0'],
            'max_discount' => ['nullable', 'numeric', 'min:0'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'max_uses_per_user' => ['required', 'integer', 'min:1'],
            'applicable_pickup_zones' => ['nullable', 'array'],
            'applicable_box_types' => ['nullable', 'array'],
            'first_time_sender_only' => ['boolean'],
            'valid_from' => ['nullable', 'date'],
            'valid_to' => ['nullable', 'date', 'after_or_equal:valid_from'],
            'is_active' => ['boolean'],
        ]);

        // Auto-sync min_box_count with buy_quantity for buy_x_get_y_free promotions
        if ($validated['type'] === 'buy_x_get_y_free' && !empty($validated['buy_quantity'])) {
            $validated['min_box_count'] = $validated['buy_quantity'];
        }

        $promotion->update($validated);

        return redirect()->back()->with('success', 'Promotion updated successfully.');
    }

    public function toggle(Promotion $promotion)
    {
        $promotion->update(['is_active' => ! $promotion->is_active]);

        return redirect()->back()->with('success', 'Promotion status updated.');
    }

    public function destroy(Promotion $promotion)
    {
        $promotion->delete();

        return redirect()->back()->with('success', 'Promotion deleted successfully.');
    }
}

