"use client";

import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Card } from "@/components/ui/surface";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import type { ReportMonth } from "../repository";
import { ReportStatusBadge } from "./report-status";

/** The months a head of department is responsible for now. */
export function ReportMonths({
  slug,
  months,
  currency,
}: {
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
              ) : m.waiting > 0 ? (
                <Link
                  href={`/o/${slug}/expenses?tab=inbox`}
                  className={buttonStyles({ variant: "outline", size: "sm" })}
                >
                  Review {m.waiting} waiting
                </Link>
              ) : (
                <p className="text-muted text-sm">
                  Starts by itself when you accept the first expense.
                </p>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
