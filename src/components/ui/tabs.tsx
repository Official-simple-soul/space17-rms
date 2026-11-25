import Link from "next/link";
import { cn } from "@/lib/utils";

export function LinkTabs({
  label,
  base,
  current,
  tabs,
}: {
  label: string;
  base?: string;
  current: string;
  tabs: { id: string; label: string; count?: number; href?: string }[];
}) {
  return (
    <nav aria-label={label} className="border-line mb-5 flex gap-6 overflow-x-auto border-b">
      {tabs.map((t, i) => (
        <Link
          key={t.id}
          href={t.href ?? (i === 0 ? base! : `${base}?tab=${t.id}`)}
          aria-current={t.id === current ? "page" : undefined}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-2 border-b-2 pb-3 text-sm font-medium",
            t.id === current
              ? "border-brand text-ink"
              : "text-muted hover:text-ink border-transparent",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
              {t.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
