"use client";

import {
  Banknote,
  Bell,
  Building2,
  CircleCheck,
  ClipboardList,
  FileText,
  Gauge,
  KeyRound,
  Network,
  Receipt,
  ScrollText,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: Gauge,
  requests: FileText,
  expenses: Receipt,
  approvals: CircleCheck,
  reports: ClipboardList,
  payments: Banknote,
  notifications: Bell,
  members: Users,
  departments: Network,
  roles: KeyRound,
  configuration: SlidersHorizontal,
  settings: Settings2,
  audit: ScrollText,
  organisation: Building2,
  platform: ShieldCheck,
} satisfies Record<string, LucideIcon>;
export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  exact?: boolean;
  count?: number;
};

export function NavCount({ count, className }: { count?: number; className?: string }) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "bg-brand grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold text-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
      <span className="sr-only"> waiting</span>
    </span>
  );
}

export const NAV_ICONS: Record<NavItem["icon"], LucideIcon> = ICONS;

export function isActive({ href, exact }: NavItem, path: string) {
  return exact ? path === href : path === href || path.startsWith(`${href}/`);
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = isActive(item, path);
        const Icon = ICONS[item.icon];
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group rounded-control flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active
                  ? "text-ink bg-white shadow-[0_6px_20px_-6px_rgb(0_0_0/0.5)]"
                  : "text-neutral-300 hover:translate-x-0.5 hover:bg-white/[0.08] hover:text-white",
              )}
            >
              <Icon
                className={cn(
                  "size-4.5 transition-transform duration-300 ease-(--ease-spring) group-hover:scale-110",
                  active && "text-brand",
                )}
                aria-hidden
              />
              {item.label}
              <NavCount count={item.count} className="ml-auto" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
