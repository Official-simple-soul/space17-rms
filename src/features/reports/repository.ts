import "server-only";
import { parseSort } from "@/lib/data-view";
import { isId, loadPage, text, type Query } from "@/lib/server-page";
import { createClient } from "@/lib/supabase/server";
import { reportDetail, reportStatus } from "./schema";

export async function listReports(orgId: string, query: Query) {
  const supabase = await createClient();
  const sort = parseSort(text(query.sort));
  const department = text(query.department);
  const { rows, server } = await loadPage(query, async (range) => {
    const { data, error } = await supabase.rpc("list_reports", {
      p_org: orgId,
      p_search: text(query.q),
      p_status: reportStatus.safeParse(text(query.status)).data,
      p_department: isId(department) ? department : undefined,
      p_sort: sort?.key,
      p_desc: sort?.desc,
      ...range,
    });
    if (error) throw new Error("Could not load reports");
    return data;
  });
  return {
    server,
    rows: rows.map((r) => ({
      id: r.id,
      number: r.number ?? "",
      department: r.department,
      month: r.month,
      dueDate: r.due_date,
      status: reportStatus.parse(r.status),
      overdue: r.overdue,
      amount: r.total_minor,
      lines: r.lines,
      missing: r.missing,
    })),
  };
}

/** Last month and this month for each department the caller submits reports for. */
export async function listMyReportMonths(orgId: string) {
  const { data, error } = await (await createClient()).rpc("my_report_months", { p_org: orgId });
  if (error) throw new Error("Could not load reports");
  // Generated types don't mark nullable columns.
  return data.map((m) => ({
    departmentId: m.department_id,
    department: m.department,
    month: m.month,
    dueDate: m.due_date,
    overdue: m.overdue,
    reportId: m.report_id as string | null,
    status: m.report_id ? reportStatus.parse(m.status) : null,
    total: m.total_minor,
    lines: m.lines,
    missing: m.missing,
    waiting: m.waiting,
  }));
}
export type ReportMonth = Awaited<ReturnType<typeof listMyReportMonths>>[number];

export async function getReport(orgId: string, id: string) {
  if (!isId(id)) return null;
  const { data, error } = await (await createClient()).rpc("get_report", { p_id: id });
  if (error?.message === "not_found") return null;
  if (error) throw new Error("Could not load report");
  const report = reportDetail.parse(data);
  return report.org_id === orgId ? report : null;
}
