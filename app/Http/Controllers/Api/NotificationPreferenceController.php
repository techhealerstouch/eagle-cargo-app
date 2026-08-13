<?php

namespace App\Http\Controllers\Api;

use App\Enums\NotificationChannel;
use App\Enums\NotificationEvent;
use App\Http\Controllers\Controller;
use App\Repositories\Contracts\NotificationPreferenceRepositoryInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationPreferenceController extends Controller
{
    public function __construct(
        private readonly NotificationPreferenceRepositoryInterface $preferenceRepository
    ) {}

    /**
     * Get all notification preferences for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        $preferences = $this->preferenceRepository->getForUser($user);

        // Build a complete matrix of all channel/event combinations
        $matrix = [];
        foreach (NotificationEvent::cases() as $event) {
            $eventPrefs = [];
            foreach (NotificationChannel::cases() as $channel) {
                $existing = $preferences->first(
                    fn ($p) => $p->channel->value === $channel->value && $p->event_type->value === $event->value
                );
                $eventPrefs[$channel->value] = $existing?->enabled ?? true; // Default enabled
            }
            $matrix[$event->value] = [
                'label' => $event->label(),
                'category' => $event->category(),
                'channels' => $eventPrefs,
            ];
        }

        return response()->json([
            'success' => true,
            'data' => [
                'preferences' => $matrix,
                'channels' => array_map(
                    fn ($c) => ['value' => $c->value, 'label' => $c->label()],
                    NotificationChannel::cases()
                ),
                'categories' => [
                    'box' => __('notifications.categories.box'),
                    'batch' => __('notifications.categories.batch'),
                    'payment' => __('notifications.categories.payment'),
                    'scheduling' => __('notifications.categories.scheduling'),
                ],
            ],
        ]);
    }

    /**
     * Update a single preference.
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        $validated = $request->validate([
            'channel' => ['required', 'string', 'in:'.implode(',', NotificationChannel::values())],
            'event_type' => ['required', 'string', 'in:'.implode(',', NotificationEvent::values())],
            'enabled' => ['required', 'boolean'],
        ]);

        $this->preferenceRepository->setPreference(
            $user,
            NotificationChannel::from($validated['channel']),
            NotificationEvent::from($validated['event_type']),
            $validated['enabled']
        );

        return response()->json([
            'success' => true,
            'message' => 'Preference updated',
        ]);
    }

    /**
     * Bulk update preferences.
     */
    public function bulkUpdate(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        }

        $validated = $request->validate([
            'preferences' => ['required', 'array'],
            'preferences.*.channel' => ['required', 'string', 'in:'.implode(',', NotificationChannel::values())],
            'preferences.*.event_type' => ['required', 'string', 'in:'.implode(',', NotificationEvent::values())],
            'preferences.*.enabled' => ['required', 'boolean'],
        ]);

        $this->preferenceRepository->bulkSetForUser($user, $validated['preferences']);

        return response()->json([
            'success' => true,
            'message' => 'Preferences updated',
        ]);
    }
}
