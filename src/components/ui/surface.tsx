import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-card glass border", className)}>{children}</section>;
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="animate-rise mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="text-muted mt-1.5 max-w-2xl text-sm">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-white to-neutral-100 shadow-[inset_0_1px_0_white,0_6px_16px_-6px_rgb(60_10_15/0.2)]">
        <Icon className="size-5" aria-hidden />
      </span>
      <h2 className="font-semibold">{title}</h2>
      <p className="text-muted mt-1 max-w-sm text-sm">{description}</p>
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "solid" | "alert";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap first-letter:uppercase",
        tone === "neutral" && "bg-ink/[0.06] text-neutral-700",
        tone === "solid" && "bg-ink text-white",
        tone === "alert" && "bg-brand-soft text-brand-strong",
      )}
    >
      {children}
    </span>
  );
}

export function Notice({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "alert";
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "alert" ? "alert" : "status"}
      className={cn(
        "rounded-control border px-3.5 py-3 text-sm",
        tone === "alert"
          ? "border-brand/20 bg-brand-soft text-brand-strong"
          : "border-line bg-white/50",
      )}
    >
      {children}
    </div>
  );
}
