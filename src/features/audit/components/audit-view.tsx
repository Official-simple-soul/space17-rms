"use client";

import { ScrollText } from "lucide-react";
import { DataView } from "@/components/ui/data-view";
import type { ListView } from "@/config/constants";
import { formatDateTime } from "@/lib/format";

export type AuditRow = {
  id: string;
  action: string;
  person: string;
  area: string;
  reason: string;
  at: string;
};

export function AuditView({ rows, view }: { rows: AuditRow[]; view: ListView }) {
  const areas = [...new Set(rows.map((r) => r.area))].sort();
  return (
    <DataView
      label="Audit log"
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      searchText={(r) => [r.action, r.person, r.reason].join(" ")}
      filters={[
        {
          key: "area",
          label: "Area",
          options: areas.map((a) => ({ value: a, label: a })),
          match: (r, v) => r.area === v,
        },
      ]}
      columns={[
        {
          key: "action",
          header: "Action",
          sort: (r) => r.action,
          cell: (r) => <span className="font-medium">{r.action}</span>,
        },
        { key: "person", header: "By", sort: (r) => r.person, cell: (r) => r.person },
        {
          key: "area",
          header: "Area",
          hideOnMobile: true,
          sort: (r) => r.area,
          cell: (r) => r.area,
        },
        {
          key: "reason",
          header: "Reason",
          hideOnMobile: true,
          cell: (r) => r.reason || <span className="text-muted">—</span>,
        },
        {
          key: "at",
          header: "When",
          sort: (r) => r.at,
          cell: (r) => (
            <time dateTime={r.at} className="whitespace-nowrap">
              {formatDateTime(r.at)}
            </time>
          ),
        },
      ]}
      card={(r) => (
        <>
          <p className="font-medium">{r.action}</p>
          <p className="text-muted mt-1 text-sm">
            {r.person} · {formatDateTime(r.at)}
          </p>
          {r.reason && <p className="mt-3 text-sm">{r.reason}</p>}
        </>
      )}
      empty={{ icon: ScrollText, title: "Nothing yet", description: "Changes will appear here." }}
    />
  );
}
