import React from 'react';

export const TrackingSkeleton: React.FC = () => {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Progress Overview Skeleton */}
            <div className="card p-6 md:p-8 h-48 bg-zinc-50/50" />

            {/* Status Details Skeleton */}
            <div className="card h-32 bg-zinc-50/50" />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Timeline Skeleton */}
                    <div className="card h-[600px] bg-zinc-50/50" />
                </div>
                <div className="space-y-8">
                    {/* Details Sidebar Skeleton */}
                    <div className="card h-64 bg-zinc-50/50" />
                    {/* Roadmap Sidebar Skeleton */}
                    <div className="card h-96 bg-zinc-50/50" />
                </div>
            </div>
        </div>
    );
};
