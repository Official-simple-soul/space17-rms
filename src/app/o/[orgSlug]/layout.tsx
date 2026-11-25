import { AppShell } from "@/components/layout/app-shell";
import type { NavItem } from "@/components/layout/nav-links";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { getOrganisationContext } from "@/lib/auth/session";

export default async function OrganisationLayout({
  children,
  params,
}: LayoutProps<"/o/[orgSlug]">) {
  const { orgSlug } = await params;
  const { session, organisation, organisations, can } = await getOrganisationContext(orgSlug);
  const base = `/o/${orgSlug}`;
  const items: NavItem[] = [{ href: base, label: "Dashboard", icon: "dashboard", exact: true }];
  items.push({ href: `${base}/members`, label: "People", icon: "members" });
  if (can("org.manage"))
    items.push({ href: `${base}/settings`, label: "Settings", icon: "settings" });
  if (can("audit.view")) items.push({ href: `${base}/audit`, label: "Audit log", icon: "audit" });
  if (session.isPlatformAdmin)
    items.push({ href: "/platform", label: "Platform", icon: "platform" });
  return (
    <AppShell
      items={items}
      name={session.name}
      email={session.email}
      switcher={
        organisations.length > 1 && (
          <OrgSwitcher current={organisation.slug} organisations={organisations} />
        )
      }
    >
      {children}
    </AppShell>
  );
}
