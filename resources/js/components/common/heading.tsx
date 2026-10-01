import { cn } from '@/lib/utils';

export default function Heading({
    title,
    description,
    eyebrow,
    variant = 'default',
}: {
    title: string;
    description?: string;
    eyebrow?: string;
    variant?: 'default' | 'small';
}) {
    return (
        <header className={variant === 'small' ? '' : 'space-y-1'}>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h2
                className={cn(
                    "font-sans text-brand-text",
                    variant === 'small'
                        ? 'mb-0.5 text-base font-bold'
                        : 'text-xl font-bold tracking-tight leading-tight'
                )}
            >
                {title}
            </h2>
            {description && (
                <p className={cn(
                    "text-brand-text-mid leading-relaxed",
                    variant === 'small' ? "text-sm" : "text-sm"
                )}>
                    {description}
                </p>
            )}
        </header>
    );
}






