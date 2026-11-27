import { AppShell } from "@/components/layout/app-shell";
import type { NavItem } from "@/components/layout/nav-links";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { getMyWork } from "@/features/requests/repository";
import { opens } from "@/lib/auth/access";
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
  if (opens(can, "requests"))
    items.push({ href: `${base}/requests`, label: "Requests", icon: "requests" });
  if (opens(can, "expenses"))
    items.push({
      href: `${base}/expenses`,
      label: "Expenses",
      icon: "expenses",
      count: work.expenses_waiting,
    });
  if (opens(can, "approvals"))
    items.push({
      href: `${base}/approvals`,
      label: "Approvals",
      icon: "approvals",
      count: work.approvals,
    });
  if (opens(can, "payments"))
    items.push({
      href: `${base}/payments`,
      label: "Payments",
      icon: "payments",
      count: work.to_pay,
    });
  if (opens(can, "reports"))
    items.push({
      href: `${base}/reports`,
      label: "Reports",
      icon: "reports",
      count: work.reports_due,
    });
  items.push({
    href: `${base}/notifications`,
    label: "Notifications",
    icon: "notifications",
    count: work.unread,
  });
  if (opens(can, "members"))
    items.push({
      href: `${base}/members`,
      label: "People",
      icon: "members",
      count: work.join_requests,
    });
  if (opens(can, "departments"))
    items.push({ href: `${base}/departments`, label: "Departments", icon: "departments" });
  if (opens(can, "roles")) items.push({ href: `${base}/roles`, label: "Roles", icon: "roles" });
  if (opens(can, "configuration"))
    items.push({ href: `${base}/configuration`, label: "Categories", icon: "configuration" });
  if (opens(can, "settings"))
    items.push({ href: `${base}/settings`, label: "Settings", icon: "settings" });
  if (opens(can, "audit")) items.push({ href: `${base}/audit`, label: "Audit log", icon: "audit" });
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
