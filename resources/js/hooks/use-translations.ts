import { usePage } from '@inertiajs/react';

type TranslationReplacements = Record<string, string | number>;

interface TranslationMap {
    [key: string]: string | TranslationMap;
}

interface TranslationProps {
    [key: string]: unknown;
    locale?: string;
    translations?: TranslationMap;
}

const readByPath = (source: TranslationMap, path: string): string | TranslationMap | undefined =>
    path.split('.').reduce<string | TranslationMap | undefined>((current, segment) => {
        if (current === undefined) {
            return undefined;
        }

        if (typeof current === 'string') {
            return undefined;
        }

        return current[segment];
    }, source);

const interpolate = (template: string, replacements: TranslationReplacements): string =>
    template.replace(/:([a-zA-Z0-9_]+)/g, (_, key: string) => {
        const value = replacements[key];

        return value === undefined ? `:${key}` : String(value);
    });

export const useTranslations = () => {
    const page = usePage<TranslationProps>();
    const locale = page.props.locale ?? 'en';
    const translations = page.props.translations ?? {};

    const t = (key: string, fallback?: string, replacements: TranslationReplacements = {}): string => {
        const translation = readByPath(translations, key);
        const template = typeof translation === 'string' ? translation : fallback ?? key;

        return interpolate(template, replacements);
    };

    return { locale, t };
};
