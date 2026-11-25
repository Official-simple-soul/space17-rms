"use client";

import { Network } from "lucide-react";
import Link from "next/link";
import { DataView } from "@/components/ui/data-view";
import { FormDialog } from "@/components/ui/form-dialog";
import type { ListView } from "@/config/constants";
import { ArchiveDepartment, DepartmentForm } from "./department-forms";

export type DepartmentRow = {
  id: string;
  name: string;
  code: string;
  parent_id: string | null;
  parent: string;
  head: string;
  deputies: string;
  people: number;
};

type Props = {
  rows: DepartmentRow[];
  view: ListView;
  orgId: string;
  peopleBase: string;
  canManage: boolean;
};

export function DepartmentsView({ rows, view, orgId, peopleBase, canManage }: Props) {
  const people = (r: DepartmentRow) => (
    <Link
      href={`${peopleBase}?department=${r.id}`}
      className="text-brand font-medium hover:underline"
    >
      {r.people} {r.people === 1 ? "person" : "people"}
    </Link>
  );
  const head = (r: DepartmentRow) => (
    <>
      {r.head || <span className="text-muted">No head yet</span>}
      {r.deputies && <span className="text-muted block text-xs">Deputy: {r.deputies}</span>}
    </>
  );
  const edit = (r: DepartmentRow) => (
    <FormDialog
      label="Edit"
      ariaLabel={`Edit ${r.name}`}
      title={`Edit ${r.name}`}
      variant="outline"
      size="sm"
    >
      <DepartmentForm orgId={orgId} departments={rows} department={r} />
      <div className="border-line mt-8 border-t pt-5">
        <h3 className="text-sm font-semibold">Archive department</h3>
        <ArchiveDepartment orgId={orgId} id={r.id} />
      </div>
    </FormDialog>
  );
  return (
    <DataView
      label="Departments"
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      searchText={(r) => [r.name, r.code, r.head, r.parent].join(" ")}
      filters={[
        {
          key: "head",
          label: "Head",
          options: [
            { value: "yes", label: "Assigned" },
            { value: "no", label: "Not assigned" },
          ],
          match: (r, v) => Boolean(r.head) === (v === "yes"),
        },
      ]}
      columns={[
        {
          key: "name",
          header: "Name",
          sort: (r) => r.name,
          cell: (r) => <span className="font-medium">{r.name}</span>,
        },
        {
          key: "code",
          header: "Code",
          hideOnMobile: true,
          sort: (r) => r.code,
          cell: (r) => r.code,
        },
        { key: "head", header: "Head", sort: (r) => r.head, cell: head },
        {
          key: "parent",
          header: "Part of",
          hideOnMobile: true,
          sort: (r) => r.parent,
          cell: (r) => r.parent || <span className="text-muted">Top level</span>,
        },
        {
          key: "people",
          header: "People",
          hideOnMobile: true,
          sort: (r) => r.people,
          cell: people,
        },
        ...(canManage ? [{ key: "actions", header: "", align: "right" as const, cell: edit }] : []),
      ]}
      card={(r) => (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold">{r.name}</p>
              <p className="text-muted text-xs">
                {[r.code, r.parent && `Part of ${r.parent}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            {canManage && edit(r)}
          </div>
          <div className="mt-5 flex items-end justify-between gap-2 text-sm">
            <div>{head(r)}</div>
            {people(r)}
          </div>
        </>
      )}
      empty={{
        icon: Network,
        title: "No departments yet",
        description: "Add the first one to start organising people and reports.",
      }}
    />
  );
}
