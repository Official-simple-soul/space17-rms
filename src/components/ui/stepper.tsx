import { Check } from "lucide-react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

/** Progress through a short flow. `current` is the zero-based step being done now. */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol aria-label="Progress" className="mb-8 flex items-start">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <Fragment key={label}>
            {i > 0 && (
              <li
                aria-hidden
                className="bg-ink/10 relative mx-2 mt-4 h-0.5 flex-1 overflow-hidden rounded-full"
              >
                {i <= current && (
                  <span className="from-ink to-brand animate-grow absolute inset-0 origin-left bg-gradient-to-r" />
                )}
              </li>
            )}
            <li
              aria-current={active ? "step" : undefined}
              className="flex w-28 shrink-0 flex-col items-center gap-2 text-center"
            >
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-full text-sm font-semibold transition-colors",
                  done && "bg-ink text-white shadow-[0_4px_12px_-4px_rgb(10_10_10/0.5)]",
                  active &&
                    "from-brand animate-halo bg-gradient-to-br to-[#c01526] text-white shadow-[0_6px_16px_-6px_rgb(163_13_26/0.7)]",
                  !done && !active && "border-ink/15 text-muted border bg-white/70",
                )}
              >
                {done ? <Check className="animate-pop size-4" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-xs leading-tight",
                  active ? "text-ink font-semibold" : done ? "text-ink" : "text-muted",
                )}
              >
                {label}
                <span className="sr-only">
                  {`, step ${i + 1} of ${steps.length}`}
                  {done ? ", done" : active ? ", current step" : ""}
                </span>
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
