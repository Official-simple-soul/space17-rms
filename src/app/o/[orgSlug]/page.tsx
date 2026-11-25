import { Building2, Check, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/surface";
import { getSetupCounts } from "@/features/organisations/repository";
import { getOrganisationContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ params }: PageProps<"/o/[orgSlug]">) {
  const { orgSlug } = await params;
  const { session, organisation, can } = await getOrganisationContext(orgSlug);
  const counts = await getSetupCounts(organisation.id);
  const stats = [
    { label: "People", value: counts.members, icon: Users },
    { label: "Departments", value: counts.departments, icon: Building2 },
    { label: "Roles", value: counts.roles, icon: ShieldCheck },
  ];
  const steps = [
    { label: "Create your organisation", done: true },
    { label: "Turn on two-step verification", done: session.aal === "aal2", href: "/account" },
    { label: "Add departments", done: counts.departments > 0, href: `/o/${orgSlug}/departments` },
    { label: "Invite your team", done: counts.members > 1, href: `/o/${orgSlug}/members` },
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
      {can("org.manage") && (
        <Card className="mt-6">
          <div className="border-line border-b p-5">
            <h2 className="font-semibold">Set up your organisation</h2>
            <p className="text-muted mt-1 text-sm">
              {steps.filter((s) => s.done).length} of {steps.length} complete
            </p>
          </div>
          <ol className="divide-line divide-y">
            {steps.map((step, i) => (
              <li key={step.label} className="flex items-center gap-4 p-5 text-sm">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${step.done ? "bg-ink text-white" : "border-line border"}`}
                >
                  {step.done ? <Check className="size-4" aria-label="Done" /> : i + 1}
                </span>
                <span className={`flex-1 ${step.done ? "text-muted" : "font-medium"}`}>
                  {step.label}
                </span>
                {!step.done &&
                  (step.href ? (
                    <Link href={step.href} className="text-brand font-medium">
                      Start
                    </Link>
                  ) : (
                    <span className="text-muted text-xs">Coming next</span>
                  ))}
              </li>
            ))}
          </ol>
        </Card>
      )}
    </>
  );
}
