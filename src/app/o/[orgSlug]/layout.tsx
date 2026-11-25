import { AppShell } from "@/components/layout/app-shell";
import type { NavItem } from "@/components/layout/nav-links";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { getMyWork } from "@/features/requests/repository";
import { getOrganisationContext } from "@/lib/auth/session";

export default async function OrganisationLayout({
  children,
  params,
}: LayoutProps<"/o/[orgSlug]">) {
  const { orgSlug } = await params;
  const { session, organisation, organisations, can } = await getOrganisationContext(orgSlug);
  const work = await getMyWork(organisation.id);
  const base = `/o/${orgSlug}`;
  const items: NavItem[] = [{ href: base, label: "Dashboard", icon: "dashboard", exact: true }];
  if (can("requests.create") || can("requests.view"))
    items.push({ href: `${base}/requests`, label: "Requests", icon: "requests" });
  if (can("requests.approve") || work.approvals > 0)
    items.push({
      href: `${base}/approvals`,
      label: "Approvals",
      icon: "approvals",
      count: work.approvals,
    });
  if (can("payments.record") || can("payments.void"))
    items.push({
      href: `${base}/payments`,
      label: "Payments",
      icon: "payments",
      count: work.to_pay,
    });
  items.push({
    href: `${base}/notifications`,
    label: "Notifications",
    icon: "notifications",
    count: work.unread,
  });
  items.push({
    href: `${base}/members`,
    label: "People",
    icon: "members",
    count: work.join_requests,
  });
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
