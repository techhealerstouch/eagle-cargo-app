<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class UserValidationController extends Controller
{
    /**
     * Check if an email address is available for registration or update.
     */
    public function checkEmail(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email:rfc,filter|max:255',
            'ignore_id' => 'nullable|integer',
        ], [
            'email.required' => 'Email address is required.',
            'email.email' => 'Please enter a valid email address.',
            'email.max' => 'Email address cannot exceed 255 characters.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'available' => false,
                'email' => (string) $request->input('email', ''),
                'message' => $validator->errors()->first('email') ?: 'Invalid email address format.',
            ], 422);
        }

        $email = strtolower(trim((string) $request->input('email')));
        $ignoreId = $request->input('ignore_id');

        $query = User::withTrashed()
            ->whereRaw('LOWER(email) = ?', [$email]);

        if (!empty($ignoreId)) {
            $query->where('id', '!=', $ignoreId);
        }

        $exists = $query->exists();

        if ($exists) {
            return response()->json([
                'available' => false,
                'email' => $email,
                'message' => 'This email address is already registered.',
            ]);
        }

        return response()->json([
            'available' => true,
            'email' => $email,
            'message' => 'Email address is available.',
        ]);
    }
}
