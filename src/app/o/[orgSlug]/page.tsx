import { Building2, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/ui/surface";
import { SetupChecklist, SetupWarnings } from "@/features/setup/components/setup-checklist";
import { getSetupCounts, listSetupWarnings } from "@/features/setup/repository";
import { describeWarning } from "@/features/setup/warnings";
import { getOrganisationContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ params }: PageProps<"/o/[orgSlug]">) {
  const { orgSlug } = await params;
  const { session, organisation, can } = await getOrganisationContext(orgSlug);
  const manage = can("org.manage") || can("config.manage");
  const [counts, warnings] = await Promise.all([
    getSetupCounts(organisation.id),
    manage ? listSetupWarnings(organisation.id) : [],
  ]);
  const base = `/o/${orgSlug}`;
  const stats = [
    { label: "People", value: counts.members, icon: Users },
    { label: "Departments", value: counts.departments, icon: Building2 },
    { label: "Roles", value: counts.roles, icon: ShieldCheck },
  ];
  const blocked = (code: string) => warnings.some((w) => w.code === code);
  const steps = [
    { label: "Turn on two-step verification", done: session.aal === "aal2", href: "/account" },
    { label: "Add departments", done: counts.departments > 0, href: `${base}/departments` },
    {
      label: "Create categories",
      done: counts.categories > 0,
      href: `${base}/configuration/categories`,
    },
    { label: "Invite your team", done: counts.members > 1, href: `${base}/members` },
    {
      label: "Give every department a head",
      done: counts.departments > 0 && !blocked("department_head"),
      href: `${base}/members`,
    },
    {
      label: "Assign enough approvers",
      done: counts.categories > 0 && !blocked("category_approvers") && !blocked("workflow_step"),
      href: `${base}/configuration/categories`,
    },
    {
      label: "Assign two people to record payments",
      done: !blocked("payers"),
      href: `${base}/members`,
    },
  ];
  return (
    <>
      <PageHeader
        title={`Hello, ${session.name.split(" ")[0]}`}
        description={`Here's where ${organisation.name} stands.`}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-5">
            <div className="text-muted flex items-center justify-between text-sm">
              {label}
              <Icon className="size-4" aria-hidden />
            </div>
            <p className="mt-5 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
          </Card>
        ))}
      </div>
      {manage && (
        <>
          <SetupWarnings warnings={warnings.map((w) => describeWarning(w, base))} />
          {steps.some((s) => !s.done) && <SetupChecklist steps={steps} />}
        </>
      )}
    </>
  );
}
