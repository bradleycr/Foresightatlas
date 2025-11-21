import * as React from "react";
import { Slot } from "@radix-ui/react-slot@1.1.2";
import { cva, type VariantProps } from "class-variance-authority@0.7.1";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "text-white shadow hover:shadow-lg border border-white/20",
        destructive:
          "text-white shadow-sm hover:shadow-lg border border-white/20",
        outline:
          "border border-gray-300 bg-white shadow-sm hover:bg-gray-50 hover:shadow",
        secondary:
          "shadow-sm hover:shadow border border-white/20",
        ghost: "hover:bg-gray-100",
        link: "text-blue-600 underline-offset-4 hover:underline hover:text-blue-700",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button(
  {
    className,
    variant,
    size,
    asChild = false,
    style,
    ...props
  }: React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
) {
  const Comp = asChild ? Slot : "button";

  // Define gradient styles for each variant
  const gradientStyles: Record<string, React.CSSProperties> = {
    default: {
      background: 'linear-gradient(135deg, #93c5fd 0%, #a5b4fc 100%)',
      ...style,
    },
    destructive: {
      background: 'linear-gradient(135deg, #fca5a5 0%, #fbbf24 100%)',
      ...style,
    },
    secondary: {
      background: 'linear-gradient(135deg, #e9d5ff 0%, #fbcfe8 100%)',
      ...style,
    },
    outline: style || {},
    ghost: style || {},
    link: style || {},
  };

  const appliedStyle = variant ? gradientStyles[variant] : gradientStyles.default;

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      style={appliedStyle}
      {...props}
    />
  );
}

export { Button, buttonVariants };