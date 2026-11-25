import { AppShell } from "@/components/layout/app-shell";
import type { NavItem } from "@/components/layout/nav-links";
import { getHomeOrganisation } from "@/lib/auth/home";
import { requireSession } from "@/lib/auth/session";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const organisation = await getHomeOrganisation();
  const items: NavItem[] = [];
  if (organisation)
    items.push({ href: `/o/${organisation.slug}`, label: "Organisation", icon: "organisation" });
  if (session.isPlatformAdmin)
    items.push({ href: "/platform", label: "Platform", icon: "platform" });
  return (
    <AppShell items={items} name={session.name} email={session.email}>
      {children}
    </AppShell>
  );
}
