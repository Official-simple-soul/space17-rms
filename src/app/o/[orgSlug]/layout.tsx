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
  items.push({ href: `${base}/departments`, label: "Departments", icon: "departments" });
  if (can("roles.manage")) items.push({ href: `${base}/roles`, label: "Roles", icon: "roles" });
  if (can("config.manage"))
    items.push({ href: `${base}/configuration`, label: "Configuration", icon: "configuration" });
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
