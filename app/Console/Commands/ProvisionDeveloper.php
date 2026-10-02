<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\User;
use App\Services\DeveloperAccess;
use Illuminate\Console\Command;

class ProvisionDeveloper extends Command
{
    protected $signature = 'developer:provision
                            {email : The developer account email address}
                            {--name=Developer : The display name for a new account}';

    protected $description = 'Create or promote a verified developer account with an interactive password prompt.';

    public function handle(DeveloperAccess $developerAccess): int
    {
        $email = strtolower(trim((string) $this->argument('email')));

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('Enter a valid email address.');

            return self::INVALID;
        }

        $user = User::withTrashed()->where('email', $email)->first();
        if ($user?->trashed()) {
            $this->error('That email belongs to a deleted account. Restore it before provisioning developer access.');

            return self::FAILURE;
        }

        if ((! $user || $user->role !== Role::Developer) && ! $developerAccess->canProvisionAnother()) {
            $this->error('The maximum of two active developer accounts has been reached.');

            return self::FAILURE;
        }

        $password = $this->secret('Developer password (12+ characters)');
        if (! is_string($password) || strlen($password) < 12) {
            $this->error('The developer password must contain at least 12 characters.');

            return self::INVALID;
        }

        $confirmation = $this->secret('Confirm developer password');
        if ($password !== $confirmation) {
            $this->error('The passwords do not match.');

            return self::INVALID;
        }

        $user ??= new User(['email' => $email]);
        $user->forceFill([
            'name' => $user->exists ? $user->name : (string) $this->option('name'),
            'role' => Role::Developer,
            'password' => $password,
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        $this->info("Developer account provisioned: {$email}");

        return self::SUCCESS;
    }
}
