<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PromotionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PromotionApiController extends Controller
{
    public function __construct(private readonly PromotionService $promotionService)
    {
    }

    public function validateCode(Request $request)
    {
        $request->validate([
            'code' => ['required', 'string'],
            'boxes' => ['required', 'array'],
            'subtotal' => ['required', 'numeric', 'min:0'],
            'empty_box_count' => ['nullable', 'integer', 'min:0'],
            'empty_box_fee' => ['nullable', 'numeric', 'min:0'],
        ]);

        $senderId = $request->input('sender_id') ? (int) $request->input('sender_id') : (Auth::check() ? Auth::user()->sender?->id : null);
        
        $result = $this->promotionService->validateAndCalculate(
            $request->input('code'),
            $senderId,
            $request->input('boxes'),
            (float) $request->input('subtotal'),
            (int) $request->input('empty_box_count', 0),
            (float) $request->input('empty_box_fee', 10.00)
        );

        if (!$result['valid']) {
            return response()->json([
                'valid' => false,
                'message' => $result['message'],
            ], 422);
        }

        return response()->json([
            'valid' => true,
            'message' => $result['message'],
            'discount_amount' => $result['discount_amount'],
            'promotion' => [
                'type' => $result['promotion']->type,
                'name' => $result['promotion']->name,
            ]
        ]);
    }
}
