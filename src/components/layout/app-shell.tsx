import Link from "next/link";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { Logo } from "./logo";
import { NavLinks, type NavItem } from "./nav-links";

type Props = {
  items: NavItem[];
  name: string;
  email: string;
  switcher?: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({ items, name, email, switcher, children }: Props) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:bg-white focus:p-3"
      >
        Skip to content
      </a>
      <aside className="bg-ink sticky top-0 hidden h-dvh flex-col p-4 text-white lg:flex">
        <Link href="/" className="mb-6 px-2 py-2">
          <Logo inverse />
        </Link>
        {switcher}
        <nav aria-label="Main" className="mt-4 flex-1 overflow-y-auto">
          <NavLinks items={items} />
        </nav>
        <div className="flex items-center gap-2 border-t border-white/10 pt-4">
          <Link href="/account" className="rounded-control min-w-0 flex-1 p-2 hover:bg-white/10">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-xs text-neutral-400">{email}</span>
          </Link>
          <SignOutButton compact />
        </div>
      </aside>
      <div className="min-w-0">
        <header className="border-line bg-surface sticky top-0 z-20 flex items-center justify-between border-b px-4 py-3 lg:hidden">
          <Link href="/">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/account" className="rounded-control px-3 py-2 text-sm font-medium">
              Account
            </Link>
            <SignOutButton compact />
          </div>
        </header>
        {switcher && <div className="bg-ink px-4 py-2 lg:hidden">{switcher}</div>}
        <main id="content" className="mx-auto max-w-6xl px-4 py-8 pb-28 sm:px-8 lg:py-12">
          {children}
        </main>
      </div>
      <nav
        aria-label="Mobile"
        className="border-line bg-surface fixed inset-x-0 bottom-0 z-20 border-t px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <NavLinks items={items} mobile />
      </nav>
    </div>
  );
}
