"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { DataView } from "@/components/ui/data-view";
import { Badge } from "@/components/ui/surface";
import type { ListView } from "@/config/constants";
import { formatDate } from "@/lib/format";
import { TEMPLATE_KINDS, type TemplateKind } from "../schema";

export type TemplateRow = {
  id: string;
  name: string;
  kind: TemplateKind;
  version: number;
  fields: number;
  publishedAt: string;
};

export function TemplatesView({
  rows,
  view,
  base,
}: {
  rows: TemplateRow[];
  view: ListView;
  base: string;
}) {
  const link = (r: TemplateRow) => (
    <Link href={`${base}/${r.id}`} className="font-medium hover:underline">
      {r.name}
    </Link>
  );
  return (
    <DataView
      label="Templates"
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      searchText={(r) => `${r.name} ${TEMPLATE_KINDS[r.kind]}`}
      filters={[
        {
          key: "kind",
          label: "Used for",
          options: Object.entries(TEMPLATE_KINDS).map(([value, label]) => ({ value, label })),
          match: (r, v) => r.kind === v,
        },
      ]}
      columns={[
        { key: "name", header: "Name", sort: (r) => r.name, cell: link },
        {
          key: "kind",
          header: "Used for",
          sort: (r) => TEMPLATE_KINDS[r.kind],
          cell: (r) => TEMPLATE_KINDS[r.kind],
        },
        {
          key: "fields",
          header: "Fields",
          hideOnMobile: true,
          sort: (r) => r.fields,
          cell: (r) => r.fields,
        },
        {
          key: "version",
          header: "Version",
          hideOnMobile: true,
          sort: (r) => r.version,
          cell: (r) => `v${r.version}`,
        },
        {
          key: "published",
          header: "Published",
          hideOnMobile: true,
          sort: (r) => r.publishedAt,
          cell: (r) => formatDate(r.publishedAt),
        },
      ]}
      card={(r) => (
        <>
          <div className="flex items-start justify-between gap-2">
            {link(r)}
            <Badge>v{r.version}</Badge>
          </div>
          <p className="text-muted mt-4 text-sm">
            {TEMPLATE_KINDS[r.kind]} · {r.fields} {r.fields === 1 ? "field" : "fields"}
          </p>
        </>
      )}
      empty={{
        icon: FileText,
        title: "No templates yet",
        description: "Templates add your own questions to requests and reports.",
      }}
    />
  );
}
