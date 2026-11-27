"use client";

import { Tags } from "lucide-react";
import { DataView } from "@/components/ui/data-view";
import { FormDialog } from "@/components/ui/form-dialog";
import type { ListView } from "@/config/constants";
import { ArchiveCategory, CategoryForm } from "./category-forms";

type Row = { id: string; name: string };

export function CategoriesView({
  rows,
  view,
  orgId,
}: {
  rows: Row[];
  view: ListView;
  orgId: string;
}) {
  const edit = (r: Row) => (
    <FormDialog
      label="Edit"
      ariaLabel={`Edit ${r.name}`}
      title={`Edit ${r.name}`}
      variant="outline"
      size="sm"
    >
      <CategoryForm orgId={orgId} category={r} />
      <div className="border-line mt-8 border-t pt-5">
        <h3 className="text-sm font-semibold">Archive category</h3>
        <ArchiveCategory orgId={orgId} id={r.id} />
      </div>
    </FormDialog>
  );
  return (
    <DataView
      label="Categories"
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      searchText={(r) => r.name}
      columns={[
        {
          key: "name",
          header: "Name",
          sort: (r) => r.name,
          cell: (r) => <span className="font-medium">{r.name}</span>,
        },
        { key: "actions", header: "", align: "right", cell: edit },
      ]}
      card={(r) => (
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">{r.name}</span>
          {edit(r)}
        </div>
      )}
      empty={{
        icon: Tags,
        title: "No categories yet",
        description: "Categories are optional labels that group spending in reports.",
      }}
    />
  );
}
