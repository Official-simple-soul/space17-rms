import {
  Banknote,
  Building2,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  FileText,
  Plus,
  Receipt,
  ShieldCheck,
  Undo2,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui/surface";
import { getMyWork } from "@/features/requests/repository";
import { SetupChecklist, SetupWarnings } from "@/features/setup/components/setup-checklist";
import { getSetupCounts, listSetupWarnings } from "@/features/setup/repository";
import { describeWarning } from "@/features/setup/warnings";
import { opens } from "@/lib/auth/access";
import { getOrganisationContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ params }: PageProps<"/o/[orgSlug]">) {
  const { orgSlug } = await params;
  const { session, organisation, can } = await getOrganisationContext(orgSlug);
  const manage = can("org.manage") || can("config.manage");
  const [work, counts, warnings] = await Promise.all([
    getMyWork(organisation.id),
    manage ? getSetupCounts(organisation.id) : null,
    manage ? listSetupWarnings(organisation.id) : [],
  ]);
  const base = `/o/${orgSlug}`;
  const tasks = [
    ...(can("requests.create")
      ? [
          {
            label: "Open requests",
            value: work.open_requests,
            icon: FileText,
            href: `${base}/requests`,
          },
          {
            label: "Requests returned to you",
            value: work.returned,
            icon: Undo2,
            href: `${base}/requests?status=returned`,
          },
        ]
      : []),
    ...(work.expenses_returned > 0
      ? [
          {
            label: "Expenses returned to you",
            value: work.expenses_returned,
            icon: Undo2,
            href: `${base}/expenses?status=returned`,
          },
        ]
      : []),
    ...(can("expenses.accept")
      ? [
          {
            label: "Expenses to review",
            value: work.expenses_waiting,
            icon: Receipt,
            href: `${base}/expenses?tab=inbox`,
          },
        ]
      : []),
    ...(can("reports.submit")
      ? [
          {
            label: "Reports to submit",
            value: work.reports_due,
            icon: ClipboardList,
            href: `${base}/reports`,
          },
        ]
      : []),
    ...(work.to_confirm > 0
      ? [
          {
            label: "Payments to confirm",
            value: work.to_confirm,
            icon: Banknote,
            href: `${base}/requests`,
          },
        ]
      : []),
    ...(can("payments.record")
      ? [{ label: "Payments due", value: work.to_pay, icon: Banknote, href: `${base}/payments` }]
      : []),
    ...(can("requests.approve")
      ? [
          {
            label: "Waiting for your approval",
            value: work.approvals,
            icon: CircleCheck,
            href: `${base}/approvals`,
          },
        ]
      : []),
  ];
  const stats = counts
    ? [
        { label: "People", value: counts.members, icon: Users },
        { label: "Departments", value: counts.departments, icon: Building2 },
        { label: "Roles", value: counts.roles, icon: ShieldCheck },
      ]
    : [];
  // Setup may be split between people, so each sees only the parts they can open.
  const canOpen = ({ href }: { href: string }) =>
    (["members", "departments", "configuration"] as const).every(
      (section) => !href.startsWith(`${base}/${section}`) || opens(can, section),
    );
  const blocked = (code: string) => warnings.some((w) => w.code === code);
  const steps = counts
    ? [
        { label: "Turn on two-step verification", done: session.aal === "aal2", href: "/account" },
        { label: "Add departments", done: counts.departments > 0, href: `${base}/departments` },
        { label: "Invite your team", done: counts.members > 1, href: `${base}/members` },
        {
          label: "Choose a head for every department",
          done: counts.departments > 0 && !blocked("department_head"),
          href: `${base}/members`,
        },
        {
          label: "Choose two people to record payments",
          done: !blocked("payers"),
          href: `${base}/members`,
        },
      ].filter(canOpen)
    : [];
  return (
    <>
      <PageHeader
        title={`Hello, ${session.name.split(" ")[0]}`}
        description={`Here's where ${organisation.name} stands.`}
      />
      {can("requests.create") && (
        <Link
          href={`${base}/requests/new`}
          className="group rounded-card mb-6 block focus-visible:outline-offset-4"
        >
          <Card className="lift flex items-center gap-5 p-5 sm:p-6">
            <span className="from-brand grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br to-[#c01526] text-white shadow-[0_8px_20px_-8px_rgb(163_13_26/0.7)] transition-transform duration-300 ease-(--ease-spring) group-hover:scale-105 group-hover:-rotate-3">
              <Plus className="size-7" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold">Ask for something</span>
              <span className="text-muted block text-sm">
                Say what you need and why. Someone will approve it.
              </span>
            </span>
            <ChevronRight
              className="text-muted size-5 shrink-0 transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </Card>
        </Link>
      )}
      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="group rounded-card block">
            <Card className="lift p-5">
              <div className="text-muted flex items-center justify-between text-sm">
                {label}
                <span className="bg-brand-soft text-brand grid size-8 place-items-center rounded-xl transition-transform duration-300 ease-(--ease-spring) group-hover:scale-110 group-hover:-rotate-6">
                  <Icon className="size-4" aria-hidden />
                </span>
              </div>
              <p className="mt-5 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
            </Card>
          </Link>
        ))}
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="p-5">
            <div className="text-muted flex items-center justify-between text-sm">
              {label}
              <span className="bg-ink/[0.05] grid size-8 place-items-center rounded-xl">
                <Icon className="size-4" aria-hidden />
              </span>
            </div>
            <p className="mt-5 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
          </Card>
        ))}
      </div>
      {manage && (
        <>
          <SetupWarnings warnings={warnings.map((w) => describeWarning(w, base)).filter(canOpen)} />
          {steps.some((s) => !s.done) && <SetupChecklist steps={steps} />}
        </>
      )}
    </>
  );
}
