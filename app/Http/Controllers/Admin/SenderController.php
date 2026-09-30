<?php

namespace App\Http\Controllers\Admin;

use Maatwebsite\Excel\Facades\Excel;

use App\Services\AuditLogService;

use App\Notifications\SenderCredentialsNotification;

use App\Imports\SendersImport;

use App\Exports\SendersExport;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreSenderRequest;
use App\Http\Requests\Admin\UpdateSenderRequest;
use App\Models\Sender;
use App\Models\User;
use App\Enums\Role;
use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Inertia\Inertia;

class SenderController extends Controller
{
    public function index(Request $request)
    {
        $query = Sender::with('user');
        $query = $this->applyFilters($query, $request);

        $senders = $query->paginate(10)->withQueryString();

        return Inertia::render('admin/senders/index', [
            'senders' => $senders,
            'filters' => $request->only(['search', 'sort', 'direction']),
        ]);
    }

    public function create()
    {
        return Inertia::render('admin/senders/create');
    }

    public function store(StoreSenderRequest $request)
    {
        $validated = $request->validated();

        DB::transaction(function () use ($validated) {
            $plainPassword = Str::random(12);

            $user = User::withoutEvents(function () use ($validated, $plainPassword) {
                $prefix = 'SD';
                do {
                    $customId = $prefix . '-' . strtoupper(Str::random(6));
                } while (User::where('custom_id', $customId)->exists());

                return User::create([
                    'custom_id' => $customId,
                    'name' => trim($validated['first_name'] . ' ' . $validated['last_name']),
                    'email' => $validated['email'],
                    'password' => Hash::make($plainPassword),
                    'role' => Role::Sender->value,
                ]);
            });

            // Create the sender, linked to the newly created user
            $senderData = array_merge($validated, ['user_id' => $user->id]);
            $sender = Sender::create($senderData);

            // Notify the user about their auto-generated credentials
            $user->notify(new \App\Notifications\AccountCreatedByAdmin($user, $plainPassword));
        });

        return redirect()->route('admin.senders.index')->with('success', 'Sender created successfully.');
    }

    public function show(Sender $sender)
    {
        $sender->load(['user', 'pickupZone', 'recipients.area']);

        $bookings = $sender->bookings()
            ->with(['pickupZone'])
            ->latest()
            ->paginate(10);

        $stats = [
            'totalBookingsCount' => $sender->bookings()->count(),
            'recipientsCount' => $sender->recipients()->count(),
        ];

        return Inertia::render('admin/senders/show', [
            'sender' => $sender,
            'bookings' => $bookings,
            'stats' => $stats,
        ]);
    }

    public function edit(Sender $sender)
    {
        return Inertia::render('admin/senders/edit', [
            'sender' => $sender,
        ]);
    }

    public function update(UpdateSenderRequest $request, Sender $sender)
    {
        $sender->update($request->validated());

        $returnUrl = $request->input('return_to') ?? session('admin_return_url.admin.senders.index') ?? session('admin_return_url') ?? route('admin.senders.index');
        return redirect($returnUrl)->with('success', 'Sender updated successfully.');
    }

    public function bulkExport(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'nullable|string', // Comma separated IDs
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
        ]);

        if ($request->boolean('select_all')) {
            $query = Sender::query();
            $query = $this->applyFilters($query, $request);
            $senders = $query->get();
        } else {
            $ids = explode(',', $validated['ids'] ?? '');
            $senders = Sender::whereIn('id', array_filter($ids))->get();
        }

        $headers = [
            'Content-type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename=senders_export_'.now()->format('Ymd_His').'.csv',
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        $callback = function () use ($senders) {
            $file = fopen('php://output', 'w');
            fputcsv($file, ['ID', 'First Name', 'Last Name', 'Email', 'Mobile', 'Secondary Mobile', 'Address', 'Created At']);

            foreach ($senders as $sender) {
                fputcsv($file, [
                    $sender->id,
                    $sender->first_name,
                    $sender->last_name,
                    $sender->email,
                    $sender->mobile,
                    $sender->secondary_mobile ?? '',
                    $sender->address,
                    $sender->created_at->format('Y-m-d H:i:s'),
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }

    public function bulkDestroy(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
        ]);

        if ($request->boolean('select_all')) {
            $query = Sender::query();
            $query = $this->applyFilters($query, $request);
            $query->delete();
        } else {
            Sender::whereIn('id', $validated['ids'])->delete();
        }

        return redirect()->back()->with('success', 'Selected senders deleted successfully.');
    }

    public function destroy(Sender $sender)
    {
        $sender->delete();

        return redirect()->back()->with('success', 'Sender deleted successfully.');
    }

    private function applyFilters(Builder $query, Request $request)
    {
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", ["%{$search}%"])
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhereHas('user', function ($uq) use ($search) {
                        $uq->where('custom_id', 'like', "%{$search}%");
                    });
            });
        }

        $sortableColumns = [
            'first_name',
            'last_name',
            'email',
            'created_at',
        ];

        $sort = in_array($request->sort, $sortableColumns) ? $request->sort : 'created_at';
        $direction = in_array($request->direction, ['asc', 'desc']) ? $request->direction : 'desc';

        return $query->orderBy($sort, $direction);
    }



    public function sendCredentials(Request $request, Sender $sender)
    {
        if (!$sender->email) {
            return back()->with('error', 'Sender does not have an email address.');
        }

        $plainPassword = \Illuminate\Support\Str::password(10, letters: true, numbers: true, symbols: false);

        \Illuminate\Support\Facades\DB::transaction(function () use ($sender, $plainPassword) {
            if (!$sender->user) {
                $user = \App\Models\User::firstOrCreate(
                    ['email' => $sender->email],
                    [
                        'name' => $sender->first_name . ' ' . $sender->last_name,
                        'password' => \Illuminate\Support\Facades\Hash::make($plainPassword),
                        'role' => \App\Enums\Role::Sender,
                        'email_verified_at' => now(),
                    ]
                );
                $sender->update(['user_id' => $user->id]);
            } else {
                $sender->user->update([
                    'password' => \Illuminate\Support\Facades\Hash::make($plainPassword),
                    'email_verified_at' => $sender->user->email_verified_at ?? now(),
                ]);
            }
        });

        $user = $sender->fresh()->user;

        try {
            $token = \Illuminate\Support\Facades\Password::createToken($user);
            $resetUrl = url(route('password.reset', [
                'token' => $token,
                'email' => $user->getEmailForPasswordReset(),
            ], false));
        } catch (\Throwable $e) {
            $resetUrl = null;
        }

        $user->notify(new \App\Notifications\SenderCredentialsNotification($user, $plainPassword, $resetUrl));

        return back()->with('success', "Account credentials have been generated and sent to {$user->email}.");
    }



    public function bulkSendCredentials(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
        ]);

        if ($request->boolean('select_all')) {
            $query = Sender::query();
            $query = $this->applyFilters($query, $request);
            $senders = $query->with('user')->get();
        } else {
            $ids = is_array($request->ids) ? $request->ids : explode(',', (string) $request->ids);
            $senders = Sender::whereIn('id', array_filter($ids))->with('user')->get();
        }

        $sentCount = 0;
        $failedCount = 0;

        foreach ($senders as $sender) {
            if (!$sender->email) {
                $failedCount++;
                continue;
            }

            try {
                $plainPassword = \Illuminate\Support\Str::password(10, letters: true, numbers: true, symbols: false);

                \Illuminate\Support\Facades\DB::transaction(function () use ($sender, $plainPassword) {
                    if (!$sender->user) {
                        $user = \App\Models\User::firstOrCreate(
                            ['email' => $sender->email],
                            [
                                'name' => $sender->first_name . ' ' . $sender->last_name,
                                'password' => \Illuminate\Support\Facades\Hash::make($plainPassword),
                                'role' => \App\Enums\Role::Sender,
                                'email_verified_at' => now(),
                            ]
                        );
                        $sender->update(['user_id' => $user->id]);
                    } else {
                        $sender->user->update([
                            'password' => \Illuminate\Support\Facades\Hash::make($plainPassword),
                            'email_verified_at' => $sender->user->email_verified_at ?? now(),
                        ]);
                    }
                });

                $user = $sender->fresh()->user;

                try {
                    $token = \Illuminate\Support\Facades\Password::createToken($user);
                    $resetUrl = url(route('password.reset', [
                        'token' => $token,
                        'email' => $user->getEmailForPasswordReset(),
                    ], false));
                } catch (\Throwable $e) {
                    $resetUrl = null;
                }

                $user->notify(new \App\Notifications\SenderCredentialsNotification($user, $plainPassword, $resetUrl));
                $sentCount++;
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::error('Failed to bulk send credentials: ' . $e->getMessage(), [
                    'sender_id' => $sender->id,
                ]);
                $failedCount++;
            }
        }

        $message = "Welcome credentials sent to {$sentCount} sender(s).";
        if ($failedCount > 0) {
            $message .= " {$failedCount} sender(s) failed or had no email.";
        }

        return back()->with('success', $message);
    }



    public function bulkHold(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'required_without:select_all|array',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
            'is_held' => 'required|boolean',
            'hold_reason' => 'nullable|string|max:500',
        ]);

        $query = Sender::query();
        
        if ($request->boolean('select_all')) {
            $query = $this->applyFilters($query, $request);
        } else {
            $query->whereIn('id', $validated['ids']);
        }

        $userIds = $query->pluck('user_id')->filter()->toArray();

        if (!empty($userIds)) {
            \App\Models\User::whereIn('id', $userIds)->update([
                'is_held' => $validated['is_held'],
                'hold_reason' => $validated['is_held'] ? ($validated['hold_reason'] ?? null) : null,
            ]);
        }

        $status = $validated['is_held'] ? 'held' : 'unheld';
        return back()->with('success', "Selected sender accounts have been {$status}.")->with('bulk_result', ['updated' => count($userIds)]);
    }



    public function exportExcel(Request $request)
    {
        $validated = $request->validate([
            'ids' => 'nullable|string',
            'select_all' => 'nullable|boolean',
            'search' => 'nullable|string',
        ]);

        if ($request->boolean('select_all')) {
            $query = Sender::query();
            $query = $this->applyFilters($query, $request);
            $senders = $query->get();
        } elseif ($request->filled('ids')) {
            $ids = is_array($request->ids) ? $request->ids : explode(',', (string) $request->ids);
            $senders = Sender::whereIn('id', array_filter($ids))->get();
        } else {
            $query = Sender::query();
            $query = $this->applyFilters($query, $request);
            $senders = $query->get();
        }

        app(AuditLogService::class)->logExportEvent('excel', 'Senders list exported as Excel (.xlsx)', [
            'count' => $senders->count(),
        ]);

        return Excel::download(new SendersExport($senders), 'senders_export_'.now()->format('Ymd_His').'.xlsx');
    }



    public function downloadImportTemplate()
    {
        return Excel::download(new SendersExport(null, true), 'senders_import_template.xlsx');
    }



    public function importExcel(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        $import = new SendersImport;
        Excel::import($import, $request->file('file'));

        $message = "Import completed: {$import->createdCount} created, {$import->updatedCount} updated.";
        if (! empty($import->failures)) {
            $failedCount = count($import->failures);
            $message .= " {$failedCount} rows had errors and were skipped.";
        }

        return back()->with([
            'success' => $message,
            'import_result' => [
                'created' => $import->createdCount,
                'updated' => $import->updatedCount,
                'failures' => $import->failures,
            ],
        ]);
    }

}
