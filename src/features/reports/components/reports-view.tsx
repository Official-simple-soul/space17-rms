"use client";

import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { DataView, type ServerPaging } from "@/components/ui/data-view";
import type { ListView } from "@/config/constants";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";
import { STATUSES, type ReportStatus } from "../schema";
import { ReportStatusBadge } from "./report-status";

export type ReportRow = {
  id: string;
  number: string;
  department: string;
  month: string;
  dueDate: string;
  status: ReportStatus;
  overdue: boolean;
  amount: number;
  lines: number;
  missing: number;
};

export function ReportsView({
  rows,
  server,
  view,
  base,
  currency,
  departments,
}: {
  rows: ReportRow[];
  server: ServerPaging;
  view: ListView;
  base: string;
  currency: string;
  departments: { id: string; name: string }[];
}) {
  const link = (r: ReportRow) => (
    <Link href={`${base}/${r.id}`} className="font-medium hover:underline">
      {formatMonth(r.month)}
      {r.number && <span className="text-muted block text-xs font-normal">{r.number}</span>}
      <span className="text-muted block text-xs font-normal md:hidden">{r.department}</span>
    </Link>
  );
  const amount = (r: ReportRow) => (
    <span className="whitespace-nowrap tabular-nums">{formatMoney(r.amount, currency)}</span>
  );
  const evidence = (r: ReportRow) =>
    r.missing ? `${r.missing} of ${r.lines} without a receipt` : `${r.lines} of ${r.lines}`;
  const badge = (r: ReportRow) => <ReportStatusBadge status={r.status} overdue={r.overdue} />;
  return (
    <DataView
      label="Reports"
      server={server}
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      filters={[
        {
          key: "status",
          label: "Status",
          options: Object.entries(STATUSES).map(([value, label]) => ({ value, label })),
        },
        {
          key: "department",
          label: "Department",
          options: departments.map((d) => ({ value: d.id, label: d.name })),
        },
      ]}
      columns={[
        { key: "month", header: "Month", sort: (r) => r.month, cell: link },
        {
          key: "department",
          header: "Department",
          hideOnMobile: true,
          sort: (r) => r.department,
          cell: (r) => r.department,
        },
        {
          key: "amount",
          header: "Total",
          align: "right",
          sort: (r) => r.amount,
          cell: amount,
        },
        { key: "evidence", header: "Receipts", hideOnMobile: true, cell: evidence },
        {
          key: "due",
          header: "Due",
          hideOnMobile: true,
          cell: (r) => <span className="whitespace-nowrap">{formatDate(r.dueDate)}</span>,
        },
        { key: "status", header: "Status", sort: (r) => r.status, cell: badge },
      ]}
      card={(r) => (
        <>
          <div className="flex items-start justify-between gap-2">
            {link(r)}
            {badge(r)}
          </div>
          <p className="mt-4 text-lg font-semibold">{amount(r)}</p>
          <p className="text-muted text-sm">
            {r.department} · Receipts: {evidence(r)}
          </p>
        </>
      )}
      empty={{
        icon: ClipboardList,
        title: "No reports yet",
        description: "Monthly expense reports will appear here.",
      }}
    />
  );
}
