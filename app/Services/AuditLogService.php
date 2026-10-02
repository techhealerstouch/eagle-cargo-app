<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class AuditLogService
{
    /**
     * Log a general or business domain event.
     */
    public function logEvent(
        string $category,
        string $action,
        string $description,
        ?Model $subject = null,
        ?array $changes = null,
        ?User $user = null,
        ?string $context = null
    ): ActivityLog {
        $userId = $user?->id ?? Auth::id();
        $ip = request()?->ip();
        $userAgent = request()?->userAgent();

        if (! $context) {
            $context = app()->runningInConsole()
                ? 'cli'
                : (request()?->is('api/*') ? 'api' : 'web');
        }

        $requestId = app()->bound('request_id')
            ? app('request_id')
            : (request()?->header('X-Request-ID') ?: null);

        return ActivityLog::create([
            'request_id' => $requestId,
            'user_id' => $userId,
            'impersonator_id' => session('impersonator_id'),
            'model_type' => $subject ? get_class($subject) : (User::class),
            'model_id' => $subject ? (int) $subject->getKey() : (int) ($userId ?? 0),
            'action' => $action,
            'description' => $description,
            'event_category' => $category,
            'context' => $context,
            'ip_address' => $ip,
            'user_agent' => $userAgent,
            'changes' => $changes,
        ]);
    }

    /**
     * Log a security or authentication event (login, logout, failed login, 2FA, password change).
     */
    public function logSecurityEvent(
        string $action,
        string $description,
        ?User $user = null,
        array $metadata = []
    ): ActivityLog {
        return $this->logEvent(
            category: 'security',
            action: $action,
            description: $description,
            subject: $user,
            changes: $metadata ?: null,
            user: $user,
        );
    }

    /**
     * Log data exports and sensitive file downloads.
     */
    public function logExportEvent(
        string $exportType,
        string $description,
        array $metadata = []
    ): ActivityLog {
        return $this->logEvent(
            category: 'compliance',
            action: 'exported',
            description: $description,
            subject: null,
            changes: array_merge(['export_type' => $exportType], $metadata),
        );
    }

    /**
     * Log administrative financial overrides or manual adjustments.
     */
    public function logFinancialOverride(
        string $action,
        string $description,
        Model $subject,
        array $changes = []
    ): ActivityLog {
        return $this->logEvent(
            category: 'financial',
            action: $action,
            description: $description,
            subject: $subject,
            changes: $changes ?: null,
        );
    }
}
