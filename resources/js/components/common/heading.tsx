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
                className={
                    variant === 'small'
                        ? 'mb-1 text-base font-semibold text-brand-text'
                        : 'text-2xl font-semibold tracking-tight text-brand-text leading-tight'
                }
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






