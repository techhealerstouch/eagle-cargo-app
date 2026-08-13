<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreUserRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Enums\Role;
use App\Models\Area;
use App\Models\Courier;
use App\Models\PickupZone;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class UserController extends Controller
{
    public function index(Request $request)
    {
        if ($request->role === Role::Sender->value || $request->role === 'sender') {
            return redirect()->route('admin.senders.index', $request->only(['search']));
        }

        if ($request->role === Role::Recipient->value || $request->role === 'recipient') {
            return redirect()->route('admin.recipients.index', $request->only(['search']));
        }

        if (($request->boolean('trashed') || $request->trashed === 'only') && auth()->user()?->role === Role::SuperAdmin) {
            $query = User::onlyTrashed();
        } else {
            $query = User::query();

            if ($request->filled('role') && $request->role !== 'all') {
                $query->where('role', $request->role);
            }
        }

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $sort = $request->input('sort', 'name');
        $direction = $request->input('direction', 'asc');
        $query->orderBy($sort, $direction);

        $users = $query->paginate(15)->withQueryString();

        return Inertia::render('admin/users/index', [
            'users' => $users,
            'filters' => $request->only(['search', 'role', 'sort', 'direction', 'trashed']),
        ]);
    }

    public function create()
    {
        return Inertia::render('admin/users/create', [
            'areas' => Area::orderBy('name')->get(),
            'pickupZones' => PickupZone::with(['suburbs' => function ($q) {
                $q->where('is_active', true)->orderBy('name');
            }])->where('is_active', true)->orderBy('name')->get(),
        ]);
    }

    public function store(StoreUserRequest $request)
    {
        $validated = $request->validated();
        $userData = Arr::except($validated, ['area_id', 'pickup_zone_id', 'suburb', 'state', 'postcode']);

        $plainPassword = \Illuminate\Support\Str::random(12);
        $userData['password'] = Hash::make($plainPassword);

        // Create the User without firing events to prevent UserObserver
        // from auto-creating a duplicate Sender with placeholder data —
        // profile records for all roles are created explicitly below.
        $user = User::withoutEvents(function () use ($userData) {
            return User::create($userData);
        });

        $parts = explode(' ', $user->name);
        $firstName = collect($parts)->first() ?: 'User';
        $lastName = collect($parts)->slice(1)->implode(' ') ?: 'Name';

        if ($user->role === Role::Courier) {
            Courier::create([
                'user_id' => $user->id,
                'area_id' => $validated['area_id'] ?? null,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $user->email,
                'mobile' => $validated['mobile'] ?? null,
                'address' => $validated['address'] ?? null,
                'suburb' => $validated['suburb'] ?? null,
                'state' => $validated['state'] ?? null,
                'postcode' => $validated['postcode'] ?? null,
            ]);
        } elseif ($user->role === Role::Picker) {
            \App\Models\Picker::create([
                'user_id' => $user->id,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $user->email,
                'mobile' => $validated['mobile'] ?? null,
                'address' => $validated['address'] ?? null,
                'suburb' => $validated['suburb'] ?? null,
                'state' => $validated['state'] ?? null,
                'postcode' => $validated['postcode'] ?? null,
                'pickup_zone_id' => $validated['pickup_zone_id'] ?? null,
            ]);
        } elseif ($user->role === Role::Warehouse) {
            \App\Models\WarehouseStaff::create([
                'user_id' => $user->id,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $user->email,
                'mobile' => $validated['mobile'] ?? null,
            ]);
        } elseif ($user->role === Role::Sender) {
            \App\Models\Sender::create([
                'user_id' => $user->id,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => $user->email,
                'mobile' => $validated['mobile'] ?? null,
                'address' => $validated['address'] ?? null,
                'suburb' => $validated['suburb'] ?? null,
                'state' => $validated['state'] ?? null,
                'postcode' => $validated['postcode'] ?? null,
            ]);
        }

        // Notify the user about their auto-generated credentials
        $user->notify(new \App\Notifications\AccountCreatedByAdmin($user, $plainPassword));

        return redirect()->route('admin.users.index')->with('success', 'User created successfully.');
    }

    public function show(User $user)
    {
        $user->load([
            'courier.area',
            'picker.pickupZone',
            'sender',
            'warehouseStaff',
        ]);

        $roleVal = $user->role instanceof Role ? $user->role->value : (string) $user->role;

        $stats = [
            'pickerRunsheetsCount' => 0,
            'courierRunsheetsCount' => 0,
            'totalBookingsCount' => 0,
            'totalCommissionsAmount' => 0,
        ];

        $recentActivity = [];

        if ($roleVal === Role::Picker->value) {
            $stats['pickerRunsheetsCount'] = \App\Models\Runsheet::where('picker_id', $user->id)->count();
            $stats['totalCommissionsAmount'] = (float) \App\Models\Commission::where('picker_id', $user->id)->sum('amount');
            $recentActivity = \App\Models\Runsheet::where('picker_id', $user->id)
                ->latest()
                ->take(5)
                ->with(['bookings'])
                ->get();
        } elseif ($roleVal === Role::Courier->value) {
            $stats['courierRunsheetsCount'] = \App\Models\Runsheet::where('courier_id', $user->id)->count();
            $recentActivity = \App\Models\Runsheet::where('courier_id', $user->id)
                ->latest()
                ->take(5)
                ->with(['boxes'])
                ->get();
        } elseif ($roleVal === Role::Sender->value && $user->sender) {
            $stats['totalBookingsCount'] = \App\Models\Booking::where('sender_id', $user->sender->id)->count();
            $recentActivity = \App\Models\Booking::where('sender_id', $user->sender->id)
                ->latest()
                ->take(5)
                ->with(['boxes'])
                ->get();
        }

        return Inertia::render('admin/users/show', [
            'user' => $user,
            'stats' => $stats,
            'recentActivity' => $recentActivity,
        ]);
    }

    public function edit(User $user)
    {
        if ($user->role === Role::Courier) {
            $user->load('courier');
        } elseif ($user->role === Role::Picker) {
            $user->load('picker.pickupZone');
        } elseif ($user->role === Role::Sender) {
            $user->load('sender');
        } elseif ($user->role === Role::Warehouse) {
            $user->load('warehouseStaff');
        }

        return Inertia::render('admin/users/edit', [
            'user' => $user,
            'areas' => Area::orderBy('name')->get(),
            'pickupZones' => PickupZone::with(['suburbs' => function ($q) {
                $q->where('is_active', true)->orderBy('name');
            }])->where('is_active', true)->orderBy('name')->get(),
        ]);
    }

    public function update(UpdateUserRequest $request, User $user)
    {
        $validated = $request->validated();
        $userData = Arr::except($validated, ['area_id', 'pickup_zone_id', 'suburb', 'state', 'postcode']);

        // Prevent users from changing their own role
        $changedOwnRole = false;
        if ($user->id === $request->user()->id) {
            if (isset($userData['role']) && $userData['role'] !== $user->role->value) {
                $changedOwnRole = true;
            }
            unset($userData['role']);
        }

        if (empty($userData['password'])) {
            unset($userData['password']);
        } else {
            $userData['password'] = Hash::make($userData['password']);
        }

        $user->update($userData);

        $parts = explode(' ', $user->name);
        $firstName = collect($parts)->first() ?: 'User';
        $lastName = collect($parts)->slice(1)->implode(' ') ?: 'Name';

        if ($user->role === Role::Courier) {
            Courier::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'area_id' => $validated['area_id'] ?? null,
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'email' => $user->email,
                    'mobile' => $validated['mobile'] ?? null,
                    'address' => $validated['address'] ?? null,
                    'suburb' => $validated['suburb'] ?? null,
                    'state' => $validated['state'] ?? null,
                    'postcode' => $validated['postcode'] ?? null,
                ]
            );
        } elseif ($user->role === Role::Picker) {
            \App\Models\Picker::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'email' => $user->email,
                    'mobile' => $validated['mobile'] ?? null,
                    'address' => $validated['address'] ?? null,
                    'suburb' => $validated['suburb'] ?? null,
                    'state' => $validated['state'] ?? null,
                    'postcode' => $validated['postcode'] ?? null,
                    'pickup_zone_id' => $validated['pickup_zone_id'] ?? null,
                ]
            );
        } elseif ($user->role === Role::Warehouse) {
            \App\Models\WarehouseStaff::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'email' => $user->email,
                    'mobile' => $validated['mobile'] ?? null,
                ]
            );
        } elseif ($user->role === Role::Sender) {
            \App\Models\Sender::updateOrCreate(
                ['user_id' => $user->id],
                [
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'email' => $user->email,
                    'mobile' => $validated['mobile'] ?? null,
                    'address' => $validated['address'] ?? null,
                    'suburb' => $validated['suburb'] ?? null,
                    'state' => $validated['state'] ?? null,
                    'postcode' => $validated['postcode'] ?? null,
                ]
            );
        }

        // Cleanup orphaned profiles if role changes
        if ($changedOwnRole || isset($validated['role'])) {
            $newRole = $validated['role'] ?? $user->role->value;
            if ($newRole !== Role::Courier->value) {
                Courier::where('user_id', $user->id)->delete();
            }
            if ($newRole !== Role::Picker->value) {
                \App\Models\Picker::where('user_id', $user->id)->delete();
            }
            if ($newRole !== Role::Warehouse->value) {
                \App\Models\WarehouseStaff::where('user_id', $user->id)->delete();
            }
            if ($newRole !== Role::Sender->value) {
                \App\Models\Sender::where('user_id', $user->id)->delete();
            }
        }

        if ($changedOwnRole) {
            return redirect()->route('admin.users.index')->with('warning', 'Your role cannot be changed on your own profile. Your other updates were saved successfully.');
        }

        return redirect()->route('admin.users.index')->with('success', 'User updated successfully.');
    }

    public function destroy(User $user)
    {
        // Prevent self-deletion
        if ($user->id === request()->user()->id) {
            return redirect()->route('admin.users.index')->with('error', 'You cannot delete your own account.');
        }

        return \Illuminate\Support\Facades\DB::transaction(function () use ($user) {
            // Re-fetch with a pessimistic lock to prevent concurrency issues
            $lockedUser = User::lockForUpdate()->find($user->id);

            if (! $lockedUser) {
                return redirect()->route('admin.users.index')->with('error', 'User not found or already deleted.');
            }

            // Prevent deletion if the user has active transactions
            if ($lockedUser->hasActiveTransactions()) {
                return redirect()->route('admin.users.index')->with('error', 'Cannot archive user with active transactions.');
            }

            $lockedUser->delete();

            return redirect()->route('admin.users.index')->with('success', 'User archived successfully.');
        });
    }

    public function restore($id)
    {
        if (auth()->user()?->role !== Role::SuperAdmin) {
            abort(403, 'Unauthorized');
        }

        $user = User::withTrashed()->findOrFail($id);

        // Cleanup orphaned profiles before restoring, in case they were left behind by a bug
        $roleValue = $user->role instanceof Role ? $user->role->value : $user->role;
        if ($roleValue !== Role::Courier->value) {
            Courier::where('user_id', $user->id)->forceDelete();
        }
        if ($roleValue !== Role::Picker->value) {
            \App\Models\Picker::where('user_id', $user->id)->forceDelete();
        }
        if ($roleValue !== Role::Warehouse->value) {
            \App\Models\WarehouseStaff::where('user_id', $user->id)->forceDelete();
        }
        if ($roleValue !== Role::Sender->value) {
            \App\Models\Sender::where('user_id', $user->id)->forceDelete();
        }

        $user->restore();

        return redirect()->back()->with('success', 'User restored successfully.');
    }
}
