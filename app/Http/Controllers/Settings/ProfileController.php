<?php

namespace App\Http\Controllers\Settings;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileDeleteRequest;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
            'sender' => $request->user()->sender,
            'registeredSuburbs' => \App\Models\Suburb::where('is_active', true)->select('name', 'postcode')->distinct()->orderBy('name')->get(),
        ]);
    }

    /**
     * Update the user's profile information.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();
        $user->fill($request->safe()->only(['name', 'email']));

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        // Update Sender profile for all users who provide address data
        // (Allows admins and other roles to book pickups)
        $nameParts = preg_split('/\s+/', trim($user->name)) ?: [];
        $firstName = $nameParts[0] ?? $user->name;
        $lastName = count($nameParts) > 1 ? implode(' ', array_slice($nameParts, 1)) : '';
        $senderData = $request->safe()->only(['mobile', 'secondary_mobile', 'country', 'address', 'suburb', 'state', 'postcode', 'latitude', 'longitude']);

        $user->sender()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $user->email,
                'country' => $senderData['country'] ?? 'Australia',
                'mobile' => $senderData['mobile'] ?? '',
                'secondary_mobile' => $senderData['secondary_mobile'] ?? null,
                'address' => $senderData['address'] ?? '',
                'suburb' => $senderData['suburb'] ?? null,
                'state' => $senderData['state'] ?? null,
                'postcode' => $senderData['postcode'] ?? null,
                'latitude' => $senderData['latitude'] ?? null,
                'longitude' => $senderData['longitude'] ?? null,
            ]
        );

        return to_route('profile.edit');
    }

    /**
     * Delete the user's profile.
     */
    public function destroy(ProfileDeleteRequest $request): RedirectResponse
    {
        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
