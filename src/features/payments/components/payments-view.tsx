"use client";

import { Banknote } from "lucide-react";
import Link from "next/link";
import { DataView, type ServerPaging } from "@/components/ui/data-view";
import { Badge } from "@/components/ui/surface";
import type { ListView } from "@/config/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { METHODS, type PaymentMethod } from "../schema";

type Shared = { server: ServerPaging; view: ListView; base: string; currency: string };
const money = (minor: number, currency: string) => (
  <span className="whitespace-nowrap tabular-nums">{formatMoney(minor, currency)}</span>
);

export type PayableRow = {
  id: string;
  number: string;
  title: string;
  requester: string;
  department: string;
  approved: number;
  balance: number;
  neededBy: string;
  approvedAt: string;
  isOwn: boolean;
};

export function PayableView({
  rows,
  departments,
  server,
  view,
  base,
  currency,
}: Shared & { rows: PayableRow[]; departments: { id: string; name: string }[] }) {
  const link = (r: PayableRow) => (
    <Link href={`${base}/requests/${r.id}`} className="font-medium hover:underline">
      {r.title}
      <span className="text-muted block text-xs font-normal">
        {r.number}
        {r.isOwn && " · Your own, someone else must pay it"}
      </span>
      <span className="text-muted block text-xs font-normal md:hidden">{r.requester}</span>
    </Link>
  );
  return (
    <DataView
      label="Payments due"
      server={server}
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      filters={[
        {
          key: "department",
          label: "Department",
          options: departments.map((d) => ({ value: d.id, label: d.name })),
        },
      ]}
      columns={[
        { key: "title", header: "Request", sort: (r) => r.title, cell: link },
        {
          key: "requester",
          header: "For",
          hideOnMobile: true,
          sort: (r) => r.requester,
          cell: (r) => (
            <>
              {r.requester}
              <span className="text-muted block text-xs">{r.department}</span>
            </>
          ),
        },
        {
          key: "total",
          header: "Approved",
          hideOnMobile: true,
          align: "right",
          cell: (r) => money(r.approved, currency),
        },
        {
          key: "balance",
          header: "Balance",
          align: "right",
          sort: (r) => r.balance,
          cell: (r) => <strong>{money(r.balance, currency)}</strong>,
        },
        {
          key: "needed",
          header: "Needed by",
          hideOnMobile: true,
          sort: (r) => r.neededBy,
          cell: (r) => (r.neededBy ? formatDate(r.neededBy) : "—"),
        },
        {
          key: "approved",
          header: "Approved on",
          hideOnMobile: true,
          sort: (r) => r.approvedAt,
          cell: (r) => formatDate(r.approvedAt),
        },
      ]}
      card={(r) => (
        <>
          {link(r)}
          <p className="mt-4 text-lg font-semibold">{money(r.balance, currency)}</p>
          <p className="text-muted text-sm">
            {r.requester} · {r.department}
          </p>
        </>
      )}
      empty={{
        icon: Banknote,
        title: "Nothing to pay",
        description: "Approved requests will appear here.",
      }}
    />
  );
}

export type PaymentRow = {
  id: string;
  number: string;
  href: string;
  request: string;
  payee: string;
  amount: number;
  paidOn: string;
  method: PaymentMethod;
  state: string;
};

export function PaymentsView({
  rows,
  server,
  view,
  base,
  currency,
}: Shared & { rows: PaymentRow[] }) {
  const link = (r: PaymentRow) => (
    <Link href={`${base}/${r.href}`} className="font-medium hover:underline">
      {r.number}
      <span className="text-muted block text-xs font-normal">{r.request}</span>
    </Link>
  );
  const state = (r: PaymentRow) => (
    <Badge tone={r.state === "Voided" ? "alert" : r.state === "Confirmed" ? "solid" : "neutral"}>
      {r.state}
    </Badge>
  );
  return (
    <DataView
      label="Payments"
      server={server}
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      filters={[
        {
          key: "status",
          label: "Status",
          options: [
            { value: "recorded", label: "Recorded" },
            { value: "voided", label: "Voided" },
          ],
        },
        {
          key: "method",
          label: "Method",
          options: Object.entries(METHODS).map(([value, label]) => ({ value, label })),
        },
        { key: "from", label: "From" },
        { key: "to", label: "To" },
      ]}
      columns={[
        { key: "number", header: "Payment", cell: link },
        {
          key: "payee",
          header: "Paid to",
          hideOnMobile: true,
          sort: (r) => r.payee,
          cell: (r) => r.payee,
        },
        {
          key: "amount",
          header: "Amount",
          align: "right",
          sort: (r) => r.amount,
          cell: (r) => money(r.amount, currency),
        },
        {
          key: "method",
          header: "Method",
          hideOnMobile: true,
          cell: (r) => METHODS[r.method],
        },
        {
          key: "date",
          header: "Date",
          hideOnMobile: true,
          sort: (r) => r.paidOn,
          cell: (r) => formatDate(r.paidOn),
        },
        { key: "status", header: "Status", hideOnMobile: true, cell: state },
      ]}
      card={(r) => (
        <>
          <div className="flex items-start justify-between gap-2">
            {link(r)}
            {state(r)}
          </div>
          <p className="mt-4 text-lg font-semibold">{money(r.amount, currency)}</p>
          <p className="text-muted text-sm">
            {r.payee} · {formatDate(r.paidOn)}
          </p>
        </>
      )}
      empty={{
        icon: Banknote,
        title: "No payments yet",
        description: "Recorded payments will appear here.",
      }}
    />
  );
}

export type RepayableRow = {
  id: string;
  description: string;
  payee: string;
  department: string;
  total: number;
  balance: number;
  date: string;
  isOwn: boolean;
};

/** Expenses paid with someone's own money, waiting to be repaid. */
export function RepayableView({
  rows,
  departments,
  server,
  view,
  base,
  currency,
}: Shared & { rows: RepayableRow[]; departments: { id: string; name: string }[] }) {
  const link = (r: RepayableRow) => (
    <Link href={`${base}/expenses/${r.id}`} className="font-medium hover:underline">
      {r.description}
      <span className="text-muted block text-xs font-normal">
        {r.payee}
        {r.isOwn && " · Your own, someone else must repay it"}
      </span>
    </Link>
  );
  return (
    <DataView
      label="Repayments due"
      server={server}
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      filters={[
        {
          key: "department",
          label: "Department",
          options: departments.map((d) => ({ value: d.id, label: d.name })),
        },
      ]}
      columns={[
        { key: "description", header: "Expense", cell: link },
        { key: "department", header: "Department", hideOnMobile: true, cell: (r) => r.department },
        {
          key: "date",
          header: "Spent on",
          hideOnMobile: true,
          cell: (r) => (r.date ? formatDate(r.date) : "—"),
        },
        {
          key: "balance",
          header: "To repay",
          align: "right",
          cell: (r) => money(r.balance, currency),
        },
      ]}
      card={(r) => (
        <>
          {link(r)}
          <p className="mt-4 text-lg font-semibold">{money(r.balance, currency)}</p>
          <p className="text-muted text-sm">
            {r.department}
            {r.date && ` · ${formatDate(r.date)}`}
          </p>
        </>
      )}
      empty={{
        icon: Banknote,
        title: "Nobody is waiting to be repaid",
        description: "Accepted expenses paid with personal money appear here.",
      }}
    />
  );
}
