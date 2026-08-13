import type { FormDataConvertible } from '@inertiajs/core';

export type FilterQueryParams = Record<string, FormDataConvertible>;

export function sanitizeQueryParams(
    params: FilterQueryParams,
): FilterQueryParams {
    return Object.fromEntries(
        Object.entries(params)
            .filter(([, value]) => {
                if (value === undefined || value === null) {
                    return false;
                }

                if (typeof value === 'string') {
                    return value.trim() !== '';
                }

                if (Array.isArray(value)) {
                    return value.length > 0;
                }

                return true;
            })
            .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]),
    ) as FilterQueryParams;
}
