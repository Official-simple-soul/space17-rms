import {
  Banknote,
  Building2,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  ClipboardList,
  FileText,
  Package,
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
import { SetupNudge } from "@/features/setup/components/setup-nudge";
import { getSetupCounts, listSetupWarnings } from "@/features/setup/repository";
import { describeWarning } from "@/features/setup/warnings";
import { opens } from "@/lib/auth/access";
import { GuidedTour, TourButton, type TourStep } from "@/features/tour/components/guided-tour";
import { tourNeeded } from "@/features/tour/repository";
import { getOrganisationContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ params }: PageProps<"/o/[orgSlug]">) {
  const { orgSlug } = await params;
  const { session, organisation, can } = await getOrganisationContext(orgSlug);
  const manage = can("org.manage") || can("config.manage");
  const [work, counts, warnings, firstVisit] = await Promise.all([
    getMyWork(organisation.id),
    manage ? getSetupCounts(organisation.id) : null,
    manage ? listSetupWarnings(organisation.id) : [],
    tourNeeded(organisation.id),
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
    ...(work.to_collect > 0
      ? [
          {
            label: "Items to collect",
            value: work.to_collect,
            icon: Package,
            href: `${base}/requests?status=handed_over`,
          },
        ]
      : []),
    ...(work.to_hand_over > 0
      ? [
          {
            label: "Items to hand over",
            value: work.to_hand_over,
            icon: Package,
            href: `${base}/requests?tab=all&status=to_hand_over`,
          },
        ]
      : []),
    ...(work.questions > 0
      ? [
          {
            label: "Questions for you",
            value: work.questions,
            icon: CircleHelp,
            href: `${base}/notifications`,
          },
        ]
      : []),
    ...(can("reports.review")
      ? [
          {
            label: "Reports to check",
            value: work.reports_to_review,
            icon: ClipboardList,
            href: `${base}/reports?status=under_review`,
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
  const shownWarnings = manage ? warnings.map((w) => describeWarning(w, base)).filter(canOpen) : [];
  const setupLeft = steps.some((s) => !s.done);
  const setup = manage && (setupLeft || shownWarnings.length > 0);
  // Only what this person can use, in plain words.
  const tour: TourStep[] = [
    {
      title: `Welcome to ${organisation.name}`,
      body: "Here's a quick look around. It takes less than a minute.",
    },
    ...(can("requests.create")
      ? [
          {
            target: "ask",
            title: "Ask for something",
            body: "Need something? Tap here, say what you need and why, and add a photo if it helps. You'll see who will approve it.",
          },
        ]
      : []),
    ...(opens(can, "requests")
      ? [
          {
            target: "nav-requests",
            title: "Your requests",
            body: "Everything you've asked for, and where each one has got to.",
          },
        ]
      : []),
    ...(opens(can, "approvals")
      ? [
          {
            target: "nav-approvals",
            title: "Approvals",
            body: "Requests waiting for you. Approve, return with a note, or reject.",
          },
        ]
      : []),
    ...(opens(can, "expenses")
      ? [
          {
            target: "nav-expenses",
            title: "Expenses",
            body: can("expenses.accept")
              ? "Record what you spent with a photo of the receipt, and check what your team has spent."
              : "Record what you spent, with a photo of the receipt.",
          },
        ]
      : []),
    ...(opens(can, "reports")
      ? [
          {
            target: "nav-reports",
            title: "Monthly reports",
            body: "Accepted expenses collect here by themselves. At the end of the month, send the report to Finance.",
          },
        ]
      : []),
    ...(opens(can, "payments")
      ? [
          {
            target: "nav-payments",
            title: "Payments",
            body: "Record money given out for approved requests. Nobody pays their own.",
          },
        ]
      : []),
    {
      target: "nav-notifications",
      title: "Notifications",
      body: "We'll tell you here when something needs you or changes.",
    },
    ...(setup
      ? [
          {
            target: "setup",
            title: "Finish setting up",
            body: "A few steps to get your organisation ready. Each one takes you to where it's done.",
          },
        ]
      : []),
    {
      target: "tour-button",
      title: "You're all set",
      body: "You can take this tour again from here at any time.",
    },
  ];
  return (
    <>
      <PageHeader
        title={`Hello, ${session.name.split(" ")[0]}`}
        description={`Here's where ${organisation.name} stands.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {setupLeft && manage && <SetupNudge left={steps.filter((x) => !x.done).length} />}
            <TourButton />
          </div>
        }
      />
      {can("requests.create") && (
        <Link
          href={`${base}/requests/new`}
          data-tour="ask"
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
      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {tasks.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href} className="group rounded-card block">
            <Card className="lift h-full p-4 sm:p-5">
              <div className="text-muted flex items-start justify-between gap-2 text-sm">
                {label}
                <span className="bg-brand-soft text-brand grid size-8 place-items-center rounded-xl transition-transform duration-300 ease-(--ease-spring) group-hover:scale-110 group-hover:-rotate-6">
                  <Icon className="size-4" aria-hidden />
                </span>
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums sm:mt-5 sm:text-3xl">
                {value}
              </p>
            </Card>
          </Link>
        ))}
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="h-full p-4 sm:p-5">
            <div className="text-muted flex items-start justify-between gap-2 text-sm">
              {label}
              <span className="bg-ink/[0.05] grid size-8 place-items-center rounded-xl">
                <Icon className="size-4" aria-hidden />
              </span>
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums sm:mt-5 sm:text-3xl">
              {value}
            </p>
          </Card>
        ))}
      </div>
      {setup && (
        <section
          id="setup"
          aria-label="Setup"
          data-tour="setup"
          className="rounded-card mt-6 scroll-mt-6 space-y-6"
        >
          <SetupWarnings warnings={shownWarnings} />
          {setupLeft && <SetupChecklist steps={steps} />}
        </section>
      )}
      <GuidedTour orgId={organisation.id} steps={tour} autoStart={firstVisit} />
    </>
  );
}
