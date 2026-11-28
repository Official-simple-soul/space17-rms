"use client";

import { FileText, Inbox } from "lucide-react";
import Link from "next/link";
import { DataView, type Column, type ServerPaging } from "@/components/ui/data-view";
import type { ListView } from "@/config/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { STATUSES, type RequestStatus, type Provision } from "../schema";
import { StatusBadge } from "./status-badge";

export type RequestRow = {
  id: string;
  number: string;
  title: string;
  requester: string;
  category: string;
  department: string;
  status: RequestStatus;
  provision: Provision;
  amount: number;
  waitingSince: string;
  date: string;
};
type Option = { id: string; name: string };
type Props = {
  mode: "mine" | "all" | "inbox";
  rows: RequestRow[];
  server: ServerPaging;
  view: ListView;
  base: string;
  currency: string;
  now: string;
  categories: Option[];
  departments: Option[];
};

function age(since: string, now: string) {
  const days = Math.floor((Date.parse(now) - Date.parse(since)) / 86_400_000);
  return days < 1 ? "Today" : days === 1 ? "1 day" : `${days} days`;
}

export function RequestsView({
  mode,
  rows,
  server,
  view,
  base,
  currency,
  now,
  categories,
  departments,
}: Props) {
  const link = (r: RequestRow) => (
    <Link href={`${base}/${r.id}`} className="font-medium hover:underline">
      {r.title}
      {r.number && <span className="text-muted block text-xs font-normal">{r.number}</span>}
      {mode !== "mine" && (
        <span className="text-muted block text-xs font-normal md:hidden">{r.requester}</span>
      )}
    </Link>
  );
  const amount = (r: RequestRow) => (
    <span className="whitespace-nowrap tabular-nums">
      {r.amount ? formatMoney(r.amount, currency) : "—"}
    </span>
  );
  const options = (list: Option[]) => list.map((o) => ({ value: o.id, label: o.name }));
  const columns: Column<RequestRow>[] = [
    { key: "title", header: "Request", sort: (r) => r.title, cell: link },
    ...(mode === "mine"
      ? []
      : [
          {
            key: "requester",
            header: "From",
            hideOnMobile: true,
            sort: (r: RequestRow) => r.requester,
            cell: (r: RequestRow) => (
              <>
                {r.requester}
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
      cell: (r) => r.category,
    },
    { key: "amount", header: "Amount", align: "right", sort: (r) => r.amount, cell: amount },
    mode === "inbox"
      ? {
          key: "waiting",
          header: "Waiting",
          hideOnMobile: true,
          cell: (r) => age(r.waitingSince, now),
        }
      : {
          key: "status",
          header: "Status",
          sort: (r) => r.status,
          cell: (r) => <StatusBadge status={r.status} provision={r.provision} />,
        },
    {
      key: "date",
      header: mode === "mine" ? "Date" : "Submitted",
      hideOnMobile: true,
      sort: (r) => r.date,
      cell: (r) => <span className="whitespace-nowrap">{formatDate(r.date)}</span>,
    },
  ];
  return (
    <DataView
      label={mode === "inbox" ? "Approvals" : "Requests"}
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
                options: [
                  ...(mode === "all"
                    ? [{ value: "to_hand_over", label: "Ready to hand over" }]
                    : []),
                  ...Object.entries(STATUSES)
                    .filter(([value]) => mode === "mine" || value !== "draft")
                    .map(([value, label]) => ({ value, label })),
                ],
              },
            ]),
        { key: "category", label: "Category", options: options(categories) },
        ...(mode === "mine"
          ? []
          : [{ key: "department", label: "Department", options: options(departments) }]),
      ]}
      columns={columns}
      card={(r) => (
        <>
          <div className="flex items-start justify-between gap-2">
            {link(r)}
            {mode !== "inbox" && <StatusBadge status={r.status} provision={r.provision} />}
          </div>
          <p className="mt-4 text-lg font-semibold">{amount(r)}</p>
          <p className="text-muted text-sm">
            {mode === "mine" ? r.category : `${r.requester} · ${r.category}`}
          </p>
          <p className="text-muted text-sm">
            {mode === "inbox" ? `Waiting: ${age(r.waitingSince, now)}` : formatDate(r.date)}
          </p>
        </>
      )}
      empty={
        mode === "inbox"
          ? {
              icon: Inbox,
              title: "Nothing to approve",
              description: "Requests waiting for you will appear here.",
            }
          : {
              icon: FileText,
              title: "No requests yet",
              description:
                mode === "mine"
                  ? "Create your first request to get started."
                  : "Submitted requests will appear here.",
            }
      }
    />
  );
}
