import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const variants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-control text-sm font-medium transition-[background-color,border-color,box-shadow,transform,color] duration-200 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "sheen bg-gradient-to-b from-neutral-800 to-ink text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_4px_12px_-4px_rgb(10_10_10/0.4)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.15),0_8px_20px_-6px_rgb(10_10_10/0.45)]",
        brand:
          "sheen bg-gradient-to-b from-[#c01526] to-brand text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_4px_14px_-4px_rgb(163_13_26/0.55)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_10px_24px_-6px_rgb(163_13_26/0.6)]",
        outline:
          "border border-white/80 bg-white/60 shadow-[inset_0_1px_0_white,0_1px_2px_rgb(10_10_10/0.05)] hover:bg-white/90",
        ghost: "hover:bg-ink/[0.05]",
        danger: "border border-brand/25 bg-white/60 text-brand hover:bg-brand-soft",
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
