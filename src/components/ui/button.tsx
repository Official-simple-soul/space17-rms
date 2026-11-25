import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const variants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ink text-white hover:bg-neutral-800",
        brand: "bg-brand text-white hover:bg-brand-strong",
        outline: "border border-line bg-surface hover:bg-neutral-100",
        ghost: "hover:bg-neutral-100",
        danger: "border border-brand/30 bg-surface text-brand hover:bg-brand-soft",
      },
      size: { sm: "h-9 px-3", md: "h-11 px-4", icon: "size-10" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type StyleOptions = Pick<VariantProps<typeof variants>, "variant" | "size"> & {
  className?: string;
};

export function buttonStyles({ className, variant, size }: StyleOptions = {}) {
  return cn(variants({ variant, size }), className);
}

type Props = ComponentProps<"button"> & VariantProps<typeof variants> & { loading?: boolean };

export function Button({ className, variant, size, loading, disabled, children, ...props }: Props) {
  return (
    <button
      className={cn(variants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
