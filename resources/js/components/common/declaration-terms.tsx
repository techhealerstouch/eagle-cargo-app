import termsData from '../../../data/declaration-terms.json';

type TermsSubitem = {
    letter: string;
    text: string;
};

type TermsItem = {
    number: string;
    paragraphs: string[];
    subitems?: TermsSubitem[];
};

type TermsSection = {
    title: string;
    paragraphs?: string[];
    items?: TermsItem[];
};

type TermsData = {
    sections: TermsSection[];
};

type DeclarationTermsProps = {
    variant?: 'screen' | 'print';
    className?: string;
};

const typedTerms = termsData as TermsData;
const highlightPattern = /(A\$300\.00|five \(5\) days|thirty \(30\) days)/gi;

function HighlightedText({ text }: { text: string }) {
    return (
        <>
            {text.split(highlightPattern).map((part, index) => {
                if (highlightPattern.test(part)) {
                    highlightPattern.lastIndex = 0;

                    return <strong key={`${part}-${index}`}>{part}</strong>;
                }

                highlightPattern.lastIndex = 0;

                return part;
            })}
        </>
    );
}

export default function DeclarationTerms({ variant = 'screen', className = '' }: DeclarationTermsProps) {
    const isPrint = variant === 'print';

    return (
        <div
            className={[
                isPrint
                    ? 'columns-2 gap-8 text-[9px] leading-relaxed text-zinc-700'
                    : 'space-y-5 text-sm leading-7 text-zinc-700',
                className,
            ].join(' ')}
        >
            {typedTerms.sections.map((section) => (
                <section key={section.title} className={isPrint ? 'mb-2 break-inside-avoid' : 'space-y-3'}>
                    <h3 className={isPrint ? 'mb-1 text-[10px] font-black uppercase text-zinc-900' : 'text-xs font-black uppercase tracking-widest text-zinc-900'}>
                        {section.title}
                    </h3>

                    {section.paragraphs?.map((paragraph) => (
                        <p key={paragraph} className={isPrint ? 'mb-1 text-justify' : 'text-justify'}>
                            <HighlightedText text={paragraph} />
                        </p>
                    ))}

                    {section.items?.map((item) => (
                        <div key={`${section.title}-${item.number}`} className={isPrint ? 'mb-1 break-inside-avoid' : 'space-y-2'}>
                            {item.paragraphs.map((paragraph, paragraphIndex) => (
                                <p key={paragraph} className="text-justify">
                                    {paragraphIndex === 0 ? <strong>{item.number}. </strong> : null}
                                    <HighlightedText text={paragraph} />
                                </p>
                            ))}

                            {item.subitems?.map((subitem) => (
                                <p key={`${item.number}-${subitem.letter}`} className={isPrint ? 'ml-3 text-justify' : 'ml-4 text-justify'}>
                                    <strong>{subitem.letter}. </strong>
                                    <HighlightedText text={subitem.text} />
                                </p>
                            ))}
                        </div>
                    ))}
                </section>
            ))}
        </div>
    );
}
