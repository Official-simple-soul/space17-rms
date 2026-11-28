"use client";

import { CircleCheck, Lock } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { TextArea } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Badge, Card, Notice } from "@/components/ui/surface";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { closePeriod, reopenPeriod, waiveReport } from "../actions";
import { STATUSES, type ReportStatus } from "../schema";

type Row = {
  department_id: string;
  department: string;
  report_id: string | null;
  number: string | null;
  status: string;
  total_minor: number;
  lines: number;
  missing: number;
  waiting: number;
};
type Period = { month: string; status: string; closed_by: string | null; closed_at: string | null };

const SETTLED = ["approved", "waived"];

function label(status: string) {
  return status === "missing" ? "Not started" : (STATUSES[status as ReportStatus] ?? status);
}

/** Finance's checklist for closing a month. */
export function MonthClose({
  orgId,
  slug,
  base,
  period,
  rows,
  currency,
}: {
  orgId: string;
  slug: string;
  base: string;
  period: Period;
  rows: Row[];
  currency: string;
}) {
  const closed = period.status === "closed";
  const outstanding = rows.filter((r) => !SETTLED.includes(r.status));
  const total = rows.reduce((sum, r) => sum + r.total_minor, 0);
  return (
    <div className="space-y-6">
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Departments for {formatMonth(period.month)}</caption>
          <thead className="border-line text-muted border-b text-left text-xs">
            <tr>
              <th className="px-5 py-3 font-medium">Department</th>
              <th className="px-5 font-medium">Report</th>
              <th className="hidden px-5 text-right font-medium sm:table-cell">Spent</th>
              <th className="px-5 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {rows.map((r) => (
              <tr key={r.department_id}>
                <td className="px-5 py-3.5">
                  <span className="font-medium">{r.department}</span>
                  <span className="text-muted block text-xs">
                    {r.lines} {r.lines === 1 ? "expense" : "expenses"}
                    {r.missing > 0 && ` · ${r.missing} without a receipt`}
                    {r.waiting > 0 && ` · ${r.waiting} still waiting for the head`}
                  </span>
                </td>
                <td className="px-5">
                  <Badge
                    tone={
                      SETTLED.includes(r.status)
                        ? "solid"
                        : r.status === "missing"
                          ? "alert"
                          : "neutral"
                    }
                  >
                    {label(r.status)}
                  </Badge>
                </td>
                <td className="hidden px-5 text-right tabular-nums sm:table-cell">
                  {formatMoney(r.total_minor, currency)}
                </td>
                <td className="px-5 text-right">
                  <div className="flex justify-end gap-2">
                    {r.report_id && (
                      <Link
                        href={`${base}/${r.report_id}`}
                        className="text-sm font-medium underline"
                      >
                        Open
                      </Link>
                    )}
                    {!closed &&
                      ["missing", "draft", "returned"].includes(r.status) &&
                      r.lines === 0 && (
                        <FormDialog
                          label="Excuse"
                          ariaLabel={`Excuse ${r.department}`}
                          title={`Excuse ${r.department} for ${formatMonth(period.month)}`}
                          description="Use this when the department had nothing to report."
                          variant="outline"
                          size="sm"
                        >
                          <ActionForm
                            action={waiveReport}
                            submit="Excuse department"
                            closeOnSuccess
                          >
                            {(state) => (
                              <>
                                <input type="hidden" name="orgId" value={orgId} />
                                <input type="hidden" name="departmentId" value={r.department_id} />
                                <input type="hidden" name="month" value={period.month} />
                                <TextArea
                                  label="Reason"
                                  name="reason"
                                  maxLength={500}
                                  defaultValue="Nothing spent this month"
                                  errors={state.fieldErrors?.reason}
                                />
                              </>
                            )}
                          </ActionForm>
                        </FormDialog>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-line border-t font-semibold">
              <td className="px-5 py-3" colSpan={2}>
                Total
              </td>
              <td className="hidden px-5 text-right tabular-nums sm:table-cell">
                {formatMoney(total, currency)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </Card>

      {closed ? (
        <Card className="space-y-4 p-6">
          <p className="flex items-center gap-2 font-semibold">
            <Lock className="size-4" aria-hidden />
            Closed by {period.closed_by} on {period.closed_at && formatDate(period.closed_at)}
          </p>
          <p className="text-muted text-sm">
            Nothing in this month can change. Late expenses go into the next open month, and
            corrections are made on approved reports, and need a second person to approve them.
          </p>
          <FormDialog
            label="Reopen month"
            title={`Reopen ${formatMonth(period.month)}`}
            variant="outline"
          >
            <ActionForm action={reopenPeriod} submit="Reopen month" variant="danger" closeOnSuccess>
              {(state) => (
                <>
                  <input type="hidden" name="orgId" value={orgId} />
                  <input type="hidden" name="month" value={period.month} />
                  <TextArea
                    label="Why?"
                    name="reason"
                    maxLength={500}
                    errors={state.fieldErrors?.reason}
                  />
                </>
              )}
            </ActionForm>
          </FormDialog>
        </Card>
      ) : (
        <Card className="space-y-4 p-6">
          {outstanding.length > 0 ? (
            <Notice>
              {outstanding.length} {outstanding.length === 1 ? "department is" : "departments are"}{" "}
              not settled yet. Approve their reports, or excuse them if they had nothing to report.
            </Notice>
          ) : (
            <p className="flex items-center gap-2 text-sm font-medium">
              <CircleCheck className="size-4" aria-hidden />
              Every department is settled.
            </p>
          )}
          <ActionForm
            action={closePeriod}
            submit={`Close ${formatMonth(period.month)}`}
            variant="brand"
            confirm={{
              title: `Close ${formatMonth(period.month)}?`,
              description:
                "Its expenses and reports will be locked. You can reopen it later with a reason.",
            }}
          >
            {() => (
              <>
                <input type="hidden" name="orgId" value={orgId} />
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="month" value={period.month} />
              </>
            )}
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
