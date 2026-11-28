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
  /** `badge` is a small red count for things waiting, shown only when above zero. */
  tabs: { id: string; label: string; count?: number; badge?: number; href?: string }[];
}) {
  return (
    <nav
      aria-label={label}
      className="border-line mb-5 flex gap-6 overflow-x-auto overflow-y-hidden border-b"
    >
      {tabs.map((t, i) => (
        <Link
          key={t.id}
          href={t.href ?? (i === 0 ? base! : `${base}?tab=${t.id}`)}
          aria-current={t.id === current ? "page" : undefined}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors",
            t.id === current
              ? "border-brand text-ink"
              : "text-muted hover:text-ink border-transparent",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className="bg-ink/[0.06] rounded-full px-2 py-0.5 text-xs text-neutral-700">
              {t.count}
            </span>
          )}
          {!!t.badge && (
            <span className="bg-brand grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] leading-none font-semibold text-white tabular-nums">
              {t.badge > 99 ? "99+" : t.badge}
              <span className="sr-only"> waiting</span>
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
