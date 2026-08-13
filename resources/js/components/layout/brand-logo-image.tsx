import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export const DEFAULT_APP_LOGO = '/images/love-logo.png';

type BrandLogoImageProps = {
    alt: string;
    className?: string;
    fallback?: ReactNode;
    src?: string | null;
};

function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function encodeLocalPath(path: string): string {
    const [, pathname = path, suffix = ''] = path.match(/^([^?#]*)(.*)$/) ?? [];

    return (
        pathname
            .split('/')
            .map((segment, index) =>
                index === 0 && segment === ''
                    ? ''
                    : encodeURIComponent(safeDecode(segment)),
            )
            .join('/') + suffix
    );
}

export function normalizeLogoSrc(src?: string | null): string | null {
    const trimmed = src?.trim();

    if (!trimmed) {
        return null;
    }

    if (/^(https?:|data:|blob:)/i.test(trimmed)) {
        return trimmed;
    }

    let path = trimmed.replace(/\\/g, '/').replace(/^\/?public\//, '');

    if (!path.startsWith('/')) {
        path = `/${path}`;
    }

    return encodeLocalPath(path);
}

export function getLogoSources(src?: string | null): string[] {
    return [normalizeLogoSrc(src), normalizeLogoSrc(DEFAULT_APP_LOGO)].filter(
        (source, index, sources): source is string =>
            Boolean(source) && sources.indexOf(source) === index,
    );
}

export default function BrandLogoImage({
    alt,
    className,
    fallback = null,
    src,
}: BrandLogoImageProps) {
    const sources = useMemo(() => getLogoSources(src), [src]);
    const [failedSources, setFailedSources] = useState<Set<string>>(
        () => new Set(),
    );
    const currentSource = sources.find((source) => !failedSources.has(source));

    if (!currentSource) {
        return <>{fallback}</>;
    }

    return (
        <img
            src={currentSource}
            alt={alt}
            className={className}
            onError={() =>
                setFailedSources((current) => {
                    if (current.has(currentSource)) {
                        return current;
                    }

                    const next = new Set(current);
                    next.add(currentSource);

                    return next;
                })
            }
        />
    );
}
