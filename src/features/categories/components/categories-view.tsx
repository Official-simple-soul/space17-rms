"use client";

import { Tags } from "lucide-react";
import Link from "next/link";
import { DataView } from "@/components/ui/data-view";
import { Badge } from "@/components/ui/surface";
import type { ListView } from "@/config/constants";
import { APPLIES_TO, type AppliesTo } from "../schema";

export type CategoryRow = {
  id: string;
  name: string;
  code: string;
  appliesTo: AppliesTo;
  departments: string;
  departmentIds: string[];
  workflow: string;
  warning: boolean;
};

export function CategoriesView({
  rows,
  view,
  base,
  departments,
}: {
  rows: CategoryRow[];
  view: ListView;
  base: string;
  departments: { id: string; name: string }[];
}) {
  const link = (r: CategoryRow) => (
    <Link href={`${base}/${r.id}`} className="font-medium hover:underline">
      {r.name}
    </Link>
  );
  const status = (r: CategoryRow) =>
    r.warning ? <Badge tone="alert">Needs approvers</Badge> : <Badge>Ready</Badge>;
  return (
    <DataView
      label="Categories"
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      searchText={(r) => [r.name, r.code, r.departments, r.workflow].join(" ")}
      filters={[
        {
          key: "use",
          label: "Used for",
          options: Object.entries(APPLIES_TO).map(([value, label]) => ({ value, label })),
          match: (r, v) => r.appliesTo === v,
        },
        {
          key: "department",
          label: "Department",
          options: departments.map((d) => ({ value: d.id, label: d.name })),
          match: (r, v) => !r.departmentIds.length || r.departmentIds.includes(v),
        },
      ]}
      columns={[
        { key: "name", header: "Name", sort: (r) => r.name, cell: link },
        {
          key: "code",
          header: "Code",
          hideOnMobile: true,
          sort: (r) => r.code,
          cell: (r) => r.code,
        },
        {
          key: "use",
          header: "Used for",
          hideOnMobile: true,
          sort: (r) => APPLIES_TO[r.appliesTo],
          cell: (r) => APPLIES_TO[r.appliesTo],
        },
        {
          key: "departments",
          header: "Departments",
          hideOnMobile: true,
          sort: (r) => r.departments,
          cell: (r) => r.departments,
        },
        {
          key: "workflow",
          header: "Approval",
          hideOnMobile: true,
          sort: (r) => r.workflow,
          cell: (r) => r.workflow,
        },
        { key: "status", header: "Status", sort: (r) => Number(r.warning), cell: status },
      ]}
      card={(r) => (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              {link(r)}
              <p className="text-muted text-xs">{r.code}</p>
            </div>
            {status(r)}
          </div>
          <p className="mt-4 text-sm">{APPLIES_TO[r.appliesTo]}</p>
          <p className="text-muted text-sm">{[r.departments, r.workflow].join(" · ")}</p>
        </>
      )}
      empty={{
        icon: Tags,
        title: "No categories yet",
        description: "Categories decide who can approve a request and what it asks for.",
      }}
    />
  );
}
