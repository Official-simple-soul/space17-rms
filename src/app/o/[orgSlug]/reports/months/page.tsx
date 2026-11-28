import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MfaNotice } from "@/components/layout/mfa-notice";
import { PageHeader } from "@/components/ui/surface";
import { LinkTabs } from "@/components/ui/tabs";
import { getOrganisation } from "@/features/organisations/repository";
import { MonthClose } from "@/features/reports/components/month-close";
import { getMonthChecklist, listPeriods } from "@/features/reports/repository";
import { requireSection } from "@/lib/auth/access";
import { formatMonth } from "@/lib/format";
import { text } from "@/lib/server-page";

export const metadata: Metadata = { title: "Close a month" };

export default async function MonthsPage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/reports/months">) {
  const { orgSlug } = await params;
  const { session, organisation, can } = await requireSection(orgSlug, "reports");
  if (!can("periods.close")) notFound();
  const [periods, details] = await Promise.all([
    listPeriods(organisation.id),
    getOrganisation(organisation.id),
  ]);
  const wanted = text((await searchParams).month);
  const period =
    periods.find((p) => p.month === wanted) ??
    periods.find((p) => p.status === "open") ??
    periods[0];
  if (!period) notFound();
  const rows = await getMonthChecklist(organisation.id, period.month);
  const base = `/o/${orgSlug}/reports`;
  return (
    <>
      <MfaNotice aal={session.aal} />
      <Link href={base} className="text-muted mb-4 inline-block text-sm font-medium">
        ← Reports
      </Link>
      <PageHeader
        title="Close a month"
        description="Check every department, then lock the month so nothing in it changes."
      />
      <LinkTabs
        label="Months"
        current={period.month}
        tabs={periods.map((p) => ({
          id: p.month,
          label: `${formatMonth(p.month)}${p.status === "closed" ? " · Closed" : ""}`,
          href: `${base}/months?month=${p.month}`,
        }))}
      />
      <MonthClose
        orgId={organisation.id}
        slug={orgSlug}
        base={base}
        period={period}
        rows={rows}
        currency={details.currency}
      />
    </>
  );
}
