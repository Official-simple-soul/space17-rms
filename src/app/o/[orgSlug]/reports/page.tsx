import type { Metadata } from "next";
import { Notice, PageHeader } from "@/components/ui/surface";
import { listDepartments } from "@/features/departments/repository";
import { getOrganisation } from "@/features/organisations/repository";
import { ReportMonths } from "@/features/reports/components/report-months";
import { ReportsView } from "@/features/reports/components/reports-view";
import { listMyReportMonths, listReports } from "@/features/reports/repository";
import { requireSection } from "@/lib/auth/access";
import { getListView } from "@/lib/list-view";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({
  params,
  searchParams,
}: PageProps<"/o/[orgSlug]/reports">) {
  const { orgSlug } = await params;
  const { organisation } = await requireSection(orgSlug, "reports");
  const [reports, months, departments, details, view] = await Promise.all([
    listReports(organisation.id, await searchParams),
    listMyReportMonths(organisation.id),
    listDepartments(organisation.id),
    getOrganisation(organisation.id),
    getListView(),
  ]);
  return (
    <>
      <PageHeader title="Reports" description="Monthly expense reports by department." />
      {months.length > 0 ? (
        <ReportMonths slug={orgSlug} months={months} currency={details.currency} />
      ) : (
        <div className="mb-6">
          <Notice>
            Heads of department start and submit reports. You&apos;ll see them here once they begin.
          </Notice>
        </div>
      )}
      <ReportsView
        {...reports}
        view={view}
        base={`/o/${orgSlug}/reports`}
        currency={details.currency}
        departments={departments}
      />
    </>
  );
}
