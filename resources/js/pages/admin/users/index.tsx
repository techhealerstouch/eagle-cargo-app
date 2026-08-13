import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import ConfirmModal from '@/components/common/confirm-modal';
import { Users, Plus, Pencil, Filter, ShieldCheck, Truck, UserCircle, Warehouse, UserPlus, Fingerprint, AlertTriangle, Trash2, Eye, RotateCcw } from 'lucide-react';
import Heading from '@/components/common/heading';
import Pagination, { type PaginationData } from '@/components/common/pagination';
import SearchFilter from '@/components/common/search-filter';
import SortLink from '@/components/common/sort-link';
import ActiveFilterChips from '@/components/common/active-filter-chips';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';

interface User {
    id: number;
    custom_id?: string;
    name: string;
    email: string;
    role: string;
    created_at: string;
    deleted_at?: string | null;
}

type UserPagination = PaginationData & { data: User[] };

const ROLE_COLORS: Record<string, string> = {
    super_admin: 'bg-purple-500/10 text-purple-600 border border-purple-500/20',
    admin: 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/20',
    courier: 'bg-blue-500/10 text-blue-600 border border-blue-500/20',
    picker: 'bg-cyan-500/10 text-cyan-600 border border-cyan-500/20',
    warehouse: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
    sender: 'bg-muted text-muted-foreground border border-border',
};

const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    courier: 'Courier',
    picker: 'Picker',
    warehouse: 'Warehouse',
    sender: 'Sender',
};

export default function UsersIndex({
    users,
    filters = { search: '', role: '', sort: 'created_at', direction: 'desc' },
}: {
    users: UserPagination;
    filters: { search?: string; role?: string; sort?: string; direction?: string; trashed?: boolean | string };
}) {
    const { auth, isLocal } = usePage<{ auth: any; isLocal?: boolean }>().props;
    const isSuperAdmin = auth?.user?.role === 'super_admin';
    const showImpersonate = !!(isLocal && isSuperAdmin);

    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleRoleChange = (role: string) => {
        if (role === 'trashed') {
            router.get('/admin/users', { trashed: true }, { preserveState: true });
        } else {
            router.get(
                '/admin/users',
                { ...filters, role: role === 'all' ? '' : role, trashed: undefined },
                { preserveState: true }
            );
        }
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'User Management', href: '/admin/users' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="User Management | Admin" />
            <div className="flex h-full flex-1 flex-col gap-8 p-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-brand-warm/20 pb-6">
                    <Heading
                        eyebrow="Access Control"
                        title="User Management"
                        description="Manage staff, couriers, pickers, and warehouse accounts. Senders and Recipients are managed in their dedicated panels."
                    />
                    <div className="flex items-center gap-3">
                        <Link
                            href="/admin/senders"
                            className="bg-white border border-brand-sand/60 text-brand-text hover:bg-brand-warm/30 flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                        >
                            <UserCircle className="size-4 text-brand-rust" />
                            Senders Panel
                        </Link>
                        <Link
                            href="/admin/recipients"
                            className="bg-white border border-brand-sand/60 text-brand-text hover:bg-brand-warm/30 flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                        >
                            <Users className="size-4 text-brand-secondary" />
                            Recipients Panel
                        </Link>
                        <Link
                            href="/admin/users/create"
                            className="bg-brand-rust text-white hover:bg-brand-rust/90 flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-brand-rust/10 transition-all font-sans"
                        >
                            <Plus className="size-4" />
                            Add Staff User
                        </Link>
                    </div>
                </div>

                <div className="flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <Tabs 
                            value={filters.trashed ? 'trashed' : (filters.role || 'all')} 
                            onValueChange={handleRoleChange}
                            className="w-full"
                        >
                            <TabsList className="h-10 inline-flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-1 w-auto overflow-x-auto">
                                <TabsTrigger value="all" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                    <Users className="size-3.5" />
                                    All Staff
                                </TabsTrigger>
                                <TabsTrigger value="admin" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                    <ShieldCheck className="size-3.5" />
                                    Admins
                                </TabsTrigger>
                                <TabsTrigger value="courier" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                    <Truck className="size-3.5" />
                                    Couriers
                                </TabsTrigger>
                                <TabsTrigger value="picker" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                    <UserPlus className="size-3.5" />
                                    Pickers
                                </TabsTrigger>
                                <TabsTrigger value="warehouse" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                    <Warehouse className="size-3.5" />
                                    Warehouse
                                </TabsTrigger>
                                {isSuperAdmin && (
                                    <TabsTrigger value="trashed" className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-all data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-2xs gap-1.5">
                                        <AlertTriangle className="size-3.5" />
                                        Archived
                                    </TabsTrigger>
                                )}
                            </TabsList>
                        </Tabs>

                        <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-1.5 w-full md:w-64">
                                <SearchFilter
                                    routeName="/admin/users"
                                    queryParams={filters}
                                    placeholder="Search by name or email..."
                                />
                            </div>
                        </div>
                    </div>

                    <ActiveFilterChips
                        routeName="/admin/users"
                        queryParams={filters}
                        className="px-1"
                    />
                </div>

                <div className="rounded-xl border border-zinc-200/80 bg-white overflow-hidden shadow-2xs">
                    {users.data.length > 0 ? (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-zinc-200/80 bg-zinc-50/70 text-xs font-semibold text-zinc-600">
                                        <th scope="col" className="px-4 py-3 font-semibold">
                                            <SortLink
                                                label="User ID"
                                                sortField="custom_id"
                                                currentSort={filters.sort}
                                                currentDirection={filters.direction}
                                                routeName="/admin/users"
                                                queryParams={filters}
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3 font-semibold">
                                            <SortLink
                                                label="Name"
                                                sortField="name"
                                                currentSort={filters.sort}
                                                currentDirection={filters.direction}
                                                routeName="/admin/users"
                                                queryParams={filters}
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3 font-semibold">
                                            <SortLink
                                                label="Email"
                                                sortField="email"
                                                currentSort={filters.sort}
                                                currentDirection={filters.direction}
                                                routeName="/admin/users"
                                                queryParams={filters}
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3 font-semibold">
                                            <SortLink
                                                label="Role"
                                                sortField="role"
                                                currentSort={filters.sort}
                                                currentDirection={filters.direction}
                                                routeName="/admin/users"
                                                queryParams={filters}
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3 font-semibold">
                                            <SortLink
                                                label="Joined"
                                                sortField="created_at"
                                                currentSort={filters.sort}
                                                currentDirection={filters.direction}
                                                routeName="/admin/users"
                                                queryParams={filters}
                                            />
                                        </th>
                                        <th scope="col" className="px-4 py-3 font-semibold text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 text-xs font-normal">
                                    {users.data.map((user) => (
                                        <tr key={user.id} className="hover:bg-zinc-50/60 transition-colors">
                                            <td className="px-4 py-3.5 font-mono text-xs font-semibold text-zinc-900">
                                                {user.custom_id || '-'}
                                            </td>
                                            <td className="px-4 py-3.5 font-semibold text-zinc-900">
                                                {user.name}
                                            </td>
                                            <td className="px-4 py-3.5 text-zinc-600">
                                                {user.email}
                                            </td>
                                            <td className="px-4 py-3.5 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role] ?? 'bg-zinc-100 text-zinc-700'}`}>
                                                    {ROLE_LABELS[user.role] ?? user.role}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-zinc-600 whitespace-nowrap">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                <div className="flex justify-end items-center gap-1.5">
                                                    {!user.deleted_at && showImpersonate && user.id !== auth?.user?.id && (
                                                        <a
                                                            href={`/impersonate/${user.id}`}
                                                            title={`Impersonate ${user.name}`}
                                                            className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center justify-center shadow-2xs"
                                                        >
                                                            <Fingerprint className="size-3.5" />
                                                        </a>
                                                    )}
                                                    <Link
                                                        href={`/admin/users/${user.id}`}
                                                        title="View user details"
                                                        className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center justify-center shadow-2xs"
                                                    >
                                                        <Eye className="size-3.5" />
                                                    </Link>
                                                    {!user.deleted_at && (
                                                        <Link
                                                            href={`/admin/users/${user.id}/edit`}
                                                            title="Edit user"
                                                            className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-brand-rust hover:bg-zinc-50 hover:border-zinc-300 transition-all flex items-center justify-center shadow-2xs"
                                                        >
                                                            <Pencil className="size-3.5" />
                                                        </Link>
                                                    )}
                                                    {!user.deleted_at && isSuperAdmin && user.id !== auth?.user?.id && (
                                                        <button
                                                            type="button"
                                                            title="Archive user"
                                                            className="h-8 w-8 rounded-lg border border-zinc-200/80 bg-white text-zinc-500 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-all flex items-center justify-center shadow-2xs"
                                                            onClick={() => {
                                                                setSelectedUser(user);
                                                                setIsArchiveModalOpen(true);
                                                            }}
                                                        >
                                                            <AlertTriangle className="size-3.5" />
                                                        </button>
                                                    )}
                                                    {user.deleted_at && isSuperAdmin && (
                                                        <button
                                                            type="button"
                                                            title="Restore user"
                                                            className="h-8 px-2.5 rounded-lg border border-emerald-200/80 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 transition-all flex items-center gap-1 text-xs font-semibold shadow-2xs"
                                                            onClick={() => {
                                                                setSelectedUser(user);
                                                                setIsRestoreModalOpen(true);
                                                            }}
                                                        >
                                                            <RotateCcw className="size-3.5" />
                                                            Restore
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <Pagination data={users} />
                        </div>
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center p-12">
                            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-warm/20">
                                <Users className="size-10 text-brand-rust" />
                            </div>
                            <h3 className="mb-2 font-serif text-xl font-medium text-brand-text">
                                No users found
                            </h3>
                            <p className="mb-6 max-w-sm text-center text-brand-text-mid">
                                No accounts found matching the selected role or search criteria.
                            </p>
                            <Link href="/admin/users/create" className="bg-brand-rust text-white px-6 py-2 rounded-xl font-bold uppercase text-xs tracking-widest">
                                Add First User
                            </Link>
                        </div>
                    )}
                </div>
            </div>
                <ConfirmModal
                    isOpen={isRestoreModalOpen}
                    onClose={() => {
                        setIsRestoreModalOpen(false);
                        setSelectedUser(null);
                    }}
                    onConfirm={() => {
                        if (selectedUser) {
                            setIsProcessing(true);
                            router.post(`/admin/users/${selectedUser.id}/restore`, {}, {
                                onFinish: () => {
                                    setIsRestoreModalOpen(false);
                                    setSelectedUser(null);
                                    setIsProcessing(false);
                                }
                            });
                        }
                    }}
                    loading={isProcessing}
                    title="Restore User?"
                    description={`Are you sure you want to restore user ${selectedUser?.name}?`}
                    variant="primary"
                    confirmText="Yes, Restore"
                />

                <ConfirmModal
                    isOpen={isArchiveModalOpen}
                    onClose={() => {
                        setIsArchiveModalOpen(false);
                        setSelectedUser(null);
                    }}
                    onConfirm={() => {
                        if (selectedUser) {
                            setIsProcessing(true);
                            router.delete(`/admin/users/${selectedUser.id}`, {
                                onFinish: () => {
                                    setIsArchiveModalOpen(false);
                                    setSelectedUser(null);
                                    setIsProcessing(false);
                                }
                            });
                        }
                    }}
                    loading={isProcessing}
                    title="Archive User?"
                    description={`Are you sure you want to archive user ${selectedUser?.name}?`}
                    variant="destructive"
                    confirmText="Yes, Archive"
                />
            </AppLayout>
    );
}





