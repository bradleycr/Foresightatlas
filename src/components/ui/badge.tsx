import * as React from "react";
import { Slot } from "@radix-ui/react-slot@1.1.2";
import { cva, type VariantProps } from "class-variance-authority@0.7.1";

import { cn } from "./utils";

const badgeVariants = cva(
  /*
   * Base padding raised to px-3 py-1.5 (12px / 6px) — the old px-2.5 py-1
   * (10px / 4px) was too tight vertically and caused the "text touching edges"
   * feel that appeared consistently across focus tags, travel types, alumni
   * chips, and every other <Badge> in the app. One change; fixed everywhere.
   */
  "inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  style,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  // Define gradient styles for each variant
  const gradientStyles: Record<string, React.CSSProperties> = {
    default: {
      background: 'linear-gradient(135deg, #bfdbfe 0%, #a5b4fc 100%)',
      color: '#374151',
      ...style,
    },
    secondary: {
      background: 'linear-gradient(135deg, #e9d5ff 0%, #fbcfe8 100%)',
      color: '#374151',
      ...style,
    },
    destructive: {
      background: 'linear-gradient(135deg, #fecaca 0%, #fed7aa 100%)',
      color: '#7f1d1d',
      ...style,
    },
    outline: style || {},
  };

  const appliedStyle = variant ? gradientStyles[variant] : gradientStyles.default;

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      style={appliedStyle}
      {...props}
    />
  );
}

export { Badge, badgeVariants };