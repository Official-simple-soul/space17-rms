"use client";

import { Workflow } from "lucide-react";
import Link from "next/link";
import { DataView } from "@/components/ui/data-view";
import { Badge } from "@/components/ui/surface";
import type { ListView } from "@/config/constants";
import { formatDate } from "@/lib/format";
import { WORKFLOW_SUBJECTS, type WorkflowSubject } from "../schema";

export type WorkflowRow = {
  id: string;
  name: string;
  subject: WorkflowSubject;
  version: number;
  publishedAt: string;
  steps: string[];
};

export function WorkflowsView({
  rows,
  view,
  base,
}: {
  rows: WorkflowRow[];
  view: ListView;
  base: string;
}) {
  const link = (r: WorkflowRow) => (
    <Link href={`${base}/${r.id}`} className="font-medium hover:underline">
      {r.name}
    </Link>
  );
  return (
    <DataView
      label="Workflows"
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      searchText={(r) => [r.name, ...r.steps].join(" ")}
      filters={[
        {
          key: "subject",
          label: "Used for",
          options: Object.entries(WORKFLOW_SUBJECTS).map(([value, label]) => ({ value, label })),
          match: (r, v) => r.subject === v,
        },
      ]}
      columns={[
        { key: "name", header: "Name", sort: (r) => r.name, cell: link },
        {
          key: "subject",
          header: "Used for",
          sort: (r) => WORKFLOW_SUBJECTS[r.subject],
          cell: (r) => WORKFLOW_SUBJECTS[r.subject],
        },
        {
          key: "steps",
          header: "Steps",
          hideOnMobile: true,
          sort: (r) => r.steps.length,
          cell: (r) => r.steps.join(" → "),
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
            <Badge>{WORKFLOW_SUBJECTS[r.subject]}</Badge>
          </div>
          <p className="text-muted mt-4 text-sm">{r.steps.join(" → ")}</p>
        </>
      )}
      empty={{
        icon: Workflow,
        title: "No workflows yet",
        description: "Without one, a category needs a single approval from its approvers.",
      }}
    />
  );
}
