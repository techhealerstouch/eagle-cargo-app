import { Link } from '@inertiajs/react';
import { Fragment } from 'react';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function Breadcrumbs({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    if (!breadcrumbs || breadcrumbs.length === 0) {
        return null;
    }

    const currentItem = breadcrumbs[breadcrumbs.length - 1];

    return (
        <div className="flex items-center min-w-0 overflow-hidden">
            {/* Mobile / Small tablet: Current page title (never wraps, truncates if too long) */}
            <span className="md:hidden text-xs sm:text-sm font-semibold text-foreground truncate max-w-[140px] sm:max-w-[200px]">
                {currentItem?.title}
            </span>

            {/* Desktop breadcrumb trail: strictly single line, no wrapping */}
            <Breadcrumb className="hidden md:block min-w-0">
                <BreadcrumbList className="flex items-center gap-1.5 text-xs text-muted-foreground flex-nowrap whitespace-nowrap overflow-hidden">
                    {breadcrumbs.map((item, index) => {
                        const isLast = index === breadcrumbs.length - 1;

                        return (
                            <Fragment key={index}>
                                <BreadcrumbItem className="inline-flex items-center whitespace-nowrap min-w-0">
                                    {isLast ? (
                                        <BreadcrumbPage className="font-semibold text-foreground truncate max-w-[160px] lg:max-w-[240px] xl:max-w-none whitespace-nowrap">
                                            {item.title}
                                        </BreadcrumbPage>
                                    ) : (
                                        <BreadcrumbLink asChild className="hover:text-foreground transition-colors truncate max-w-[100px] lg:max-w-[160px] whitespace-nowrap">
                                            <Link href={item.href}>
                                                {item.title}
                                            </Link>
                                        </BreadcrumbLink>
                                    )}
                                </BreadcrumbItem>
                                {!isLast && <BreadcrumbSeparator className="shrink-0 [&>svg]:size-3" />}
                            </Fragment>
                        );
                    })}
                </BreadcrumbList>
            </Breadcrumb>
        </div>
    );
}
