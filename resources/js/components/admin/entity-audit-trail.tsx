import React, { useState } from 'react';
import {
    Activity,
    ChevronDown,
    ChevronRight,
    Clock,
    Code2,
    Database,
    Globe,
    History,
    ShieldAlert,
    Truck,
    User,
    Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface EntityAuditLog {
    id: number;
    user_id?: number | null;
    action: string;
    description: string;
    event_category: string;
    context: string;
    ip_address?: string | null;
    changes?: Record<string, { old?: any; new?: any }> | Record<string, any> | null;
    created_at: string;
    user?: {
        id: number;
        name: string;
        email: string;
        role: string;
    } | null;
}

interface EntityAuditTrailProps {
    logs: EntityAuditLog[];
    title?: string;
    className?: string;
}

const ACTION_COLORS: Record<string, string> = {
    created: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    updated: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    deleted: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
    restored: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
};

export default function EntityAuditTrail({
    logs = [],
    title = 'Activity & Audit History',
    className = '',
}: EntityAuditTrailProps) {
    const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

    const toggleExpand = (id: number) => {
        setExpandedLogId((prev) => (prev === id ? null : id));
    };

    if (!logs || logs.length === 0) {
        return (
            <div className={`bg-white dark:bg-zinc-900 border border-brand-sand/40 dark:border-zinc-800 rounded-2xl p-6 text-center text-zinc-400 text-xs ${className}`}>
                <History className="size-6 mx-auto text-zinc-300 mb-2" />
                No audit log history recorded for this item yet.
            </div>
        );
    }

    return (
        <div className={`bg-white dark:bg-zinc-900 border border-brand-sand/40 dark:border-zinc-800 rounded-2xl p-6 shadow-2xs ${className}`}>
            <div className="flex items-center justify-between border-b border-brand-sand/30 dark:border-zinc-800 pb-4 mb-4">
                <div className="flex items-center gap-2">
                    <History className="size-4 text-brand-primary" />
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
                </div>
                <Badge variant="outline" className="text-[11px] font-medium">
                    {logs.length} event{logs.length === 1 ? '' : 's'}
                </Badge>
            </div>

            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-brand-sand/40 dark:before:bg-zinc-800">
                {logs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const hasDiffs = log.changes && Object.keys(log.changes).length > 0;

                    return (
                        <div key={log.id} className="relative group">
                            {/* Dot indicator */}
                            <div className="absolute -left-[27px] top-1 size-3.5 rounded-full border-2 border-white dark:border-zinc-900 bg-brand-primary shadow-2xs" />

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${
                                            ACTION_COLORS[log.action] || 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700'
                                        }`}
                                    >
                                        {log.action}
                                    </span>
                                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                        {log.user ? log.user.name : 'System'}
                                    </span>
                                    {log.user?.role && (
                                        <span className="text-[10px] text-zinc-400 capitalize">
                                            ({log.user.role})
                                        </span>
                                    )}
                                </div>
                                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                                    <Clock className="size-3" />
                                    <span>{new Date(log.created_at).toLocaleString()}</span>
                                </div>
                            </div>

                            <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1">
                                {log.description}
                            </p>

                            {/* Additional metadata & toggle */}
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-400">
                                {log.ip_address && (
                                    <span className="flex items-center gap-1 font-mono">
                                        <Globe className="size-3" /> {log.ip_address}
                                    </span>
                                )}
                                <span className="uppercase text-[10px] font-semibold bg-brand-warm/20 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                    {log.context}
                                </span>
                                {hasDiffs && (
                                    <button
                                        type="button"
                                        onClick={() => toggleExpand(log.id)}
                                        className="text-brand-primary hover:underline font-semibold flex items-center gap-0.5"
                                    >
                                        {isExpanded ? (
                                            <>
                                                <ChevronDown className="size-3" /> Hide Changes
                                            </>
                                        ) : (
                                            <>
                                                <ChevronRight className="size-3" /> View Changes
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Expanded Diffs */}
                            {isExpanded && hasDiffs && log.changes && (
                                <div className="mt-3 p-3 bg-brand-warm/15 dark:bg-zinc-800/60 rounded-xl border border-brand-sand/30 dark:border-zinc-800 text-xs">
                                    {log.action === 'updated' && typeof log.changes === 'object' && Object.values(log.changes)[0] && typeof Object.values(log.changes)[0] === 'object' && 'old' in Object.values(log.changes)[0] ? (
                                        <div className="space-y-1.5">
                                            {Object.entries(log.changes as Record<string, { old?: any; new?: any }>).map(([field, diff]) => (
                                                <div key={field} className="grid grid-cols-12 gap-2 text-[11px]">
                                                    <span className="col-span-4 font-mono font-bold text-zinc-600 dark:text-zinc-400">
                                                        {field}:
                                                    </span>
                                                    <span className="col-span-4 font-mono text-rose-600 bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.5 rounded break-all">
                                                        {diff.old === null || diff.old === undefined ? '<empty>' : String(diff.old)}
                                                    </span>
                                                    <span className="col-span-4 font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded break-all">
                                                        {diff.new === null || diff.new === undefined ? '<empty>' : String(diff.new)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <pre className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto">
                                            {JSON.stringify(log.changes, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
