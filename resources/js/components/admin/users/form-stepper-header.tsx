import { Check, User, MapPin, Map, ShieldCheck } from 'lucide-react';

export interface StepItem {
    id: number;
    title: string;
    description: string;
    icon: React.ElementType;
}

interface FormStepperHeaderProps {
    steps: StepItem[];
    currentStep: number;
    onStepClick?: (stepId: number) => void;
}

export default function FormStepperHeader({
    steps,
    currentStep,
    onStepClick,
}: FormStepperHeaderProps) {
    return (
        <div className="w-full mb-8">
            <div className="flex items-center justify-between relative">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border/60 -translate-y-1/2 -z-0" />
                <div
                    className="absolute top-1/2 left-0 h-0.5 bg-brand-rust -translate-y-1/2 transition-all duration-300 -z-0"
                    style={{
                        width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
                    }}
                />

                {steps.map((step) => {
                    const Icon = step.icon;
                    const isCompleted = step.id < currentStep;
                    const isActive = step.id === currentStep;

                    return (
                        <div
                            key={step.id}
                            className="flex flex-col items-center relative z-10 bg-card px-2 cursor-pointer group"
                            onClick={() => isCompleted && onStepClick?.(step.id)}
                        >
                            <div
                                className={`size-10 rounded-2xl flex items-center justify-center font-bold text-xs transition-all duration-300 border shadow-2xs ${
                                    isCompleted
                                        ? 'bg-emerald-500 text-white border-emerald-600'
                                        : isActive
                                        ? 'bg-brand-navy text-white border-brand-navy ring-4 ring-brand-navy/15 scale-105'
                                        : 'bg-card text-muted-foreground border-border/80 group-hover:border-foreground/30'
                                }`}
                            >
                                {isCompleted ? (
                                    <Check className="size-5 stroke-[2.5]" />
                                ) : (
                                    <Icon className="size-4" />
                                )}
                            </div>
                            <div className="text-center mt-2 hidden sm:block">
                                <span
                                    className={`block text-[10px] font-extrabold uppercase tracking-wider ${
                                        isActive
                                            ? 'text-brand-navy font-black'
                                            : isCompleted
                                            ? 'text-emerald-700'
                                            : 'text-muted-foreground'
                                    }`}
                                >
                                    STEP {step.id}
                                </span>
                                <span
                                    className={`block text-[11px] font-bold ${
                                        isActive
                                            ? 'text-foreground'
                                            : isCompleted
                                            ? 'text-foreground/80'
                                            : 'text-muted-foreground/70'
                                    }`}
                                >
                                    {step.title}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
