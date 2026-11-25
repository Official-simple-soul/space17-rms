"use client";

import { ScrollText } from "lucide-react";
import { DataView, type ServerPaging } from "@/components/ui/data-view";
import { FormDialog } from "@/components/ui/form-dialog";
import type { ListView } from "@/config/constants";
import { formatDateTime } from "@/lib/format";
import type { Json } from "@/lib/supabase/database.types";

export type AuditRow = {
  id: string;
  action: string;
  person: string;
  area: string;
  reason: string;
  at: string;
  before: Json | null;
  after: Json | null;
};
type Option = { value: string; label: string };

function Values({ title, value }: { title: string; value: Json | null }) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  return (
    <section className="mt-6">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <dl className="divide-line rounded-control border-line divide-y border text-sm">
        {Object.entries(value).map(([key, item]) => (
          <div key={key} className="grid gap-1 p-3">
            <dt className="text-muted text-xs capitalize">{key.replaceAll("_", " ")}</dt>
            <dd className="font-mono text-xs break-words whitespace-pre-wrap">
              {item === null || item === undefined
                ? "—"
                : typeof item === "object"
                  ? JSON.stringify(item, null, 2)
                  : String(item)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Details({ row }: { row: AuditRow }) {
  return (
    <FormDialog
      label="View"
      ariaLabel={`View ${row.action}, ${formatDateTime(row.at)}`}
      title={row.action}
      description={`${row.person} · ${formatDateTime(row.at)}`}
      variant="outline"
      size="sm"
    >
      {row.reason && <p className="text-sm">Reason: {row.reason}</p>}
      <Values title="Before" value={row.before} />
      <Values title="After" value={row.after} />
      {!row.reason && !row.before && !row.after && (
        <p className="text-muted text-sm">No further details were recorded.</p>
      )}
    </FormDialog>
  );
}

export function AuditView({
  rows,
  view,
  server,
  areas,
  people,
}: {
  rows: AuditRow[];
  view: ListView;
  server: ServerPaging;
  areas: Option[];
  people: Option[];
}) {
  const when = (r: AuditRow) => (
    <time dateTime={r.at} className="sm:whitespace-nowrap">
      {formatDateTime(r.at)}
    </time>
  );
  return (
    <DataView
      label="Audit log"
      server={server}
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      filters={[
        { key: "person", label: "Person", options: people },
        { key: "area", label: "Area", options: areas },
        { key: "from", label: "From" },
        { key: "to", label: "To" },
      ]}
      columns={[
        {
          key: "action",
          header: "Action",
          sort: (r) => r.action,
          cell: (r) => <span className="font-medium">{r.action}</span>,
        },
        {
          key: "person",
          header: "By",
          hideOnMobile: true,
          sort: (r) => r.person,
          cell: (r) => r.person,
        },
        {
          key: "area",
          header: "Area",
          hideOnMobile: true,
          sort: (r) => r.area,
          cell: (r) => r.area,
        },
        { key: "at", header: "When", sort: (r) => r.at, cell: when },
        { key: "details", header: "", align: "right", cell: (r) => <Details row={r} /> },
      ]}
      card={(r) => (
        <>
          <p className="font-medium">{r.action}</p>
          <p className="text-muted mt-1 mb-4 text-sm">
            {r.person} · {formatDateTime(r.at)}
          </p>
          <Details row={r} />
        </>
      )}
      empty={{ icon: ScrollText, title: "Nothing yet", description: "Changes will appear here." }}
    />
  );
}
