"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { isActive, NAV_ICONS, type NavItem } from "./nav-links";

const SLOTS = 5;
const tab = "flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium";

/** Bottom bar: the first destinations, with the rest behind More. */
export function MobileNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const overflow = items.length > SLOTS;
  const main = overflow ? items.slice(0, SLOTS - 1) : items;
  const rest = overflow ? items.slice(SLOTS - 1) : [];
  const inRest = rest.some((item) => isActive(item, path));
  return (
    <ul className="flex">
      {main.map((item) => {
        const Icon = NAV_ICONS[item.icon];
        const active = isActive(item, path);
        return (
          <li key={item.href} className="min-w-0 flex-1">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(tab, active ? "text-brand" : "text-muted")}
            >
              <Icon className="size-4.5" aria-hidden />
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </Link>
          </li>
        );
      })}
      {overflow && (
        <li className="min-w-0 flex-1">
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger className={cn(tab, inRest ? "text-brand" : "text-muted")}>
              <Menu className="size-4.5" aria-hidden />
              More
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 lg:hidden" />
              <Dialog.Content
                aria-describedby={undefined}
                className="bg-surface fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl lg:hidden"
              >
                <Dialog.Title className="px-3 pb-2 font-semibold">More</Dialog.Title>
                <ul>
                  {rest.map((item) => {
                    const Icon = NAV_ICONS[item.icon];
                    const active = isActive(item, path);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "rounded-control flex items-center gap-3 px-3 py-3 font-medium hover:bg-neutral-100",
                            active && "text-brand",
                          )}
                        >
                          <Icon className="size-5" aria-hidden />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </li>
      )}
    </ul>
  );
}
