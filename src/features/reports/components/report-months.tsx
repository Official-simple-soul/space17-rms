"use client";

import Link from "next/link";
import { ActionForm } from "@/components/ui/action-form";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/surface";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { openReport } from "../actions";
import type { ReportMonth } from "../repository";
import { ReportStatusBadge } from "./report-status";

/** The months a head of department is responsible for now. */
export function ReportMonths({
  orgId,
  slug,
  months,
  currency,
}: {
  orgId: string;
  slug: string;
  months: ReportMonth[];
  currency: string;
}) {
  return (
    <ul className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {months.map((m) => (
        <li key={m.departmentId + m.month}>
          <Card className="flex h-full flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold">{formatMonth(m.month)}</h2>
                <p className="text-muted text-sm">{m.department}</p>
              </div>
              <ReportStatusBadge status={m.status} overdue={m.overdue} />
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">
              {formatMoney(m.total, currency)}
            </p>
            <p className="text-muted mt-1 mb-5 text-sm">
              {m.lines} {m.lines === 1 ? "expense" : "expenses"}
              {m.missing > 0 && ` · ${m.missing} without a receipt`}
              {" · "}Due {formatDate(m.dueDate)}
            </p>
            <div className="mt-auto">
              {m.reportId ? (
                <Link
                  href={`/o/${slug}/reports/${m.reportId}`}
                  className={buttonStyles({ variant: "outline", size: "sm" })}
                >
                  Open report
                </Link>
              ) : (
                <ActionForm
                  action={openReport}
                  submit="Start report"
                  variant="outline"
                  size="sm"
                  className="space-y-2"
                >
                  {() => (
                    <>
                      <input type="hidden" name="orgId" value={orgId} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="departmentId" value={m.departmentId} />
                      <input type="hidden" name="month" value={m.month} />
                    </>
                  )}
                </ActionForm>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
