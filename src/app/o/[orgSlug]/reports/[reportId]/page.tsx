import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/components/ui/surface";
import { MarkRead } from "@/features/notifications/components/mark-read";
import {
  ReportLines,
  ReportSummary,
  ReportTimeline,
} from "@/features/reports/components/report-details";
import { ReportEditor } from "@/features/reports/components/report-editor";
import { ReportStatusBadge } from "@/features/reports/components/report-status";
import { getReport } from "@/features/reports/repository";
import { getMyWork } from "@/features/requests/repository";
import { Files } from "@/features/files/components/files";
import { getOrganisationContext } from "@/lib/auth/session";
import { formatDate, formatMonth } from "@/lib/format";

export const metadata: Metadata = { title: "Report" };

export default async function ReportPage({ params }: PageProps<"/o/[orgSlug]/reports/[reportId]">) {
  const { orgSlug, reportId } = await params;
  const { organisation } = await getOrganisationContext(orgSlug);
  const [report, work] = await Promise.all([
    getReport(organisation.id, reportId),
    getMyWork(organisation.id),
  ]);
  if (!report) notFound();
  const base = `/o/${orgSlug}`;
  return (
    <>
      {work.unread > 0 && <MarkRead orgId={organisation.id} subjectId={report.id} />}
      <Link href={`${base}/reports`} className="text-muted mb-4 inline-block text-sm font-medium">
        ← Reports
      </Link>
      <PageHeader
        title={`${report.department.name}, ${formatMonth(report.month)}`}
        description={
          report.submitted_at
            ? `${report.number} · Submitted by ${report.submitted_by} on ${formatDate(report.submitted_at)}`
            : "Not submitted yet"
        }
        action={<ReportStatusBadge status={report.status} overdue={report.overdue} />}
      />
      <ReportSummary report={report} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <ReportLines report={report} base={base} />
        </div>
        <div className="space-y-6 lg:sticky lg:top-6">
          {report.can_edit ? (
            <ReportEditor
              // A changed report starts again from what was saved.
              key={`${report.lock_version}:${report.status}`}
              report={report}
              base={base}
            />
          ) : (
            (report.summary || report.attachments.length > 0) && (
              <Card className="space-y-4 p-6">
                {report.summary && (
                  <div>
                    <h2 className="text-sm font-semibold">Notes for Finance</h2>
                    <p className="mt-1 text-sm whitespace-pre-line">{report.summary}</p>
                  </div>
                )}
                {report.attachments.length > 0 && (
                  <Files files={report.attachments} base={`${base}/files`} />
                )}
              </Card>
            )
          )}
          {report.events.length > 0 && (
            <Card className="p-6">
              <h2 className="mb-4 font-semibold">Activity</h2>
              <ReportTimeline events={report.events} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
