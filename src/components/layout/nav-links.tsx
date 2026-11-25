"use client";

import {
  Building2,
  Gauge,
  KeyRound,
  Network,
  ScrollText,
  Settings2,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: Gauge,
  members: Users,
  departments: Network,
  roles: KeyRound,
  settings: Settings2,
  audit: ScrollText,
  organisation: Building2,
  platform: ShieldCheck,
} satisfies Record<string, LucideIcon>;
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; exact?: boolean };

export function NavLinks({ items, mobile }: { items: NavItem[]; mobile?: boolean }) {
  const path = usePathname();
  return (
    <ul
      className={mobile ? "flex [justify-content:safe_space-around] overflow-x-auto" : "space-y-1"}
    >
      {items.map(({ href, label, icon, exact }) => {
        const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
        const Icon = ICONS[icon];
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={
                mobile
                  ? cn(
                      "flex min-w-16 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                      active ? "text-brand" : "text-muted",
                    )
                  : cn(
                      "rounded-control flex items-center gap-3 px-3 py-2.5 text-sm font-medium",
                      active
                        ? "text-ink bg-white"
                        : "text-neutral-300 hover:bg-white/10 hover:text-white",
                    )
              }
            >
              <Icon className={cn("size-4.5", active && "text-brand")} aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
