"use client";

import { Inbox, Receipt } from "lucide-react";
import Link from "next/link";
import { DataView, type Column, type ServerPaging } from "@/components/ui/data-view";
import type { ListView } from "@/config/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { EVIDENCE, FUNDING, STATUSES, type ExpenseFlag, type ExpenseStatus } from "../schema";
import { ExpenseFlags, ExpenseStatusBadge } from "./expense-badges";

export type ExpenseRow = {
  id: string;
  description: string;
  seller: string;
  by: string;
  category: string;
  department: string;
  date: string;
  amount: number;
  funding: keyof typeof FUNDING;
  status: ExpenseStatus;
  flags: ExpenseFlag[];
};
type Option = { id: string; name: string };

export function ExpensesView({
  mode,
  rows,
  server,
  view,
  base,
  currency,
  categories,
  departments,
}: {
  mode: "mine" | "inbox" | "all";
  rows: ExpenseRow[];
  server: ServerPaging;
  view: ListView;
  base: string;
  currency: string;
  categories: Option[];
  departments: Option[];
}) {
  // A draft's gaps are still being filled in, so only submitted expenses show flags.
  const flags = (r: ExpenseRow) =>
    r.status === "draft" || r.status === "cancelled" ? null : <ExpenseFlags flags={r.flags} />;
  const link = (r: ExpenseRow) => (
    <Link
      href={r.status === "draft" ? `${base}/${r.id}/edit` : `${base}/${r.id}`}
      className="font-medium hover:underline"
    >
      {r.description}
      <span className="text-muted block text-xs font-normal">
        {[r.seller, FUNDING[r.funding]].filter(Boolean).join(" · ")}
      </span>
      {mode !== "mine" && (
        <span className="text-muted block text-xs font-normal md:hidden">{r.by}</span>
      )}
    </Link>
  );
  const amount = (r: ExpenseRow) => (
    <span className="whitespace-nowrap tabular-nums">
      {r.amount ? formatMoney(r.amount, currency) : "—"}
    </span>
  );
  const date = (r: ExpenseRow) => (r.date ? formatDate(r.date) : "—");
  const options = (list: Option[]) => list.map((o) => ({ value: o.id, label: o.name }));
  const columns: Column<ExpenseRow>[] = [
    {
      key: "description",
      header: "Expense",
      sort: (r) => r.description,
      cell: (r) => (
        <div className="space-y-1.5">
          {link(r)}
          {flags(r)}
        </div>
      ),
    },
    ...(mode === "mine"
      ? []
      : [
          {
            key: "by",
            header: "From",
            hideOnMobile: true,
            sort: (r: ExpenseRow) => r.by,
            cell: (r: ExpenseRow) => (
              <>
                {r.by}
                <span className="text-muted block text-xs">{r.department}</span>
              </>
            ),
          },
        ]),
    {
      key: "category",
      header: "Category",
      hideOnMobile: true,
      sort: (r) => r.category,
      cell: (r) => r.category || "—",
    },
    {
      key: "date",
      header: "Date",
      hideOnMobile: true,
      sort: (r) => r.date,
      cell: (r) => <span className="whitespace-nowrap">{date(r)}</span>,
    },
    { key: "amount", header: "Amount", align: "right", sort: (r) => r.amount, cell: amount },
    ...(mode === "inbox"
      ? []
      : [
          {
            key: "status",
            header: "Status",
            sort: (r: ExpenseRow) => r.status,
            cell: (r: ExpenseRow) => <ExpenseStatusBadge status={r.status} />,
          },
        ]),
  ];
  return (
    <DataView
      label="Expenses"
      server={server}
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      filters={[
        ...(mode === "inbox"
          ? []
          : [
              {
                key: "status",
                label: "Status",
                options: Object.entries(STATUSES)
                  .filter(([value]) => mode === "mine" || value !== "draft")
                  .map(([value, label]) => ({ value, label })),
              },
            ]),
        { key: "category", label: "Category", options: options(categories) },
        ...(mode === "mine"
          ? []
          : [{ key: "department", label: "Department", options: options(departments) }]),
        {
          key: "evidence",
          label: "Evidence",
          options: Object.entries(EVIDENCE).map(([value, label]) => ({ value, label })),
        },
        { key: "from", label: "From" },
        { key: "to", label: "To" },
      ]}
      columns={columns}
      card={(r) => (
        <>
          <div className="flex items-start justify-between gap-2">
            {link(r)}
            {mode !== "inbox" && <ExpenseStatusBadge status={r.status} />}
          </div>
          <p className="mt-4 text-lg font-semibold">{amount(r)}</p>
          <p className="text-muted mb-2 text-sm">
            {[mode !== "mine" && r.by, r.category, date(r)].filter(Boolean).join(" · ")}
          </p>
          {flags(r)}
        </>
      )}
      empty={
        mode === "inbox"
          ? {
              icon: Inbox,
              title: "Nothing to review",
              description: "Expenses from your department will appear here.",
            }
          : {
              icon: Receipt,
              title: "No expenses yet",
              description:
                mode === "mine"
                  ? "Add what you spent and send it to your head of department."
                  : "Submitted expenses will appear here.",
            }
      }
    />
  );
}
