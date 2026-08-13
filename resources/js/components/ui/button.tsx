import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        brand:
          "bg-brand-primary text-white shadow-xs hover:bg-brand-primary-dark hover:shadow-primary transition-all hover:-translate-y-0.5 uppercase tracking-wide",
        "brand-secondary":
          "bg-brand-secondary text-white shadow-xs hover:opacity-90 transition-all hover:-translate-y-0.5 uppercase tracking-wide",
        "brand-outline":
          "border-2 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white transition-all hover:-translate-y-0.5 uppercase tracking-wide",
        "brand-rust":
          "bg-brand-rust text-white shadow-xs hover:bg-brand-rust/90 transition-all hover:-translate-y-0.5 uppercase tracking-wide",
        success:
          "bg-green-600 text-white shadow-xs hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500 hover:shadow-lg hover:shadow-green-600/20 transition-all hover:-translate-y-0.5 uppercase tracking-wide",
        warning:
          "bg-amber-600 text-white shadow-xs hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 hover:shadow-lg hover:shadow-amber-600/20 transition-all hover:-translate-y-0.5 uppercase tracking-wide",
      },
      size: {
        default: "h-8.5 px-3.5 py-1.5 has-[>svg]:px-2.5",
        sm: "h-7.5 rounded-lg px-2.5 has-[>svg]:px-2",
        lg: "h-9.5 rounded-lg px-5 has-[>svg]:px-3.5",
        icon: "size-8.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }





