"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { DataView } from "@/components/ui/data-view";
import { Badge } from "@/components/ui/surface";
import type { ListView } from "@/config/constants";

export type RoleRow = {
  id: string;
  name: string;
  isDefault: boolean;
  covers: string;
  permissions: number;
  people: number;
};

export function RolesView({ rows, view, base }: { rows: RoleRow[]; view: ListView; base: string }) {
  const link = (r: RoleRow) => (
    <Link href={`${base}/${r.id}`} className="font-medium hover:underline">
      {r.name}
    </Link>
  );
  const type = (r: RoleRow) => (
    <Badge tone={r.isDefault ? "neutral" : "solid"}>{r.isDefault ? "Default" : "Custom"}</Badge>
  );
  return (
    <DataView
      label="Roles"
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      searchText={(r) => r.name}
      filters={[
        {
          key: "type",
          label: "Type",
          options: [
            { value: "default", label: "Default" },
            { value: "custom", label: "Custom" },
          ],
          match: (r, v) => r.isDefault === (v === "default"),
        },
      ]}
      columns={[
        { key: "name", header: "Name", sort: (r) => r.name, cell: link },
        {
          key: "covers",
          header: "Covers",
          hideOnMobile: true,
          sort: (r) => r.covers,
          cell: (r) => r.covers,
        },
        {
          key: "permissions",
          header: "Permissions",
          hideOnMobile: true,
          sort: (r) => r.permissions,
          cell: (r) => r.permissions,
        },
        { key: "people", header: "People", sort: (r) => r.people, cell: (r) => r.people },
        { key: "type", header: "Type", cell: type },
      ]}
      card={(r) => (
        <>
          <div className="flex items-start justify-between gap-2">
            {link(r)}
            {type(r)}
          </div>
          <p className="text-muted mt-4 text-sm">{r.covers}</p>
          <p className="text-muted text-sm">
            {r.permissions} permissions · {r.people} {r.people === 1 ? "person" : "people"}
          </p>
        </>
      )}
      empty={{ icon: KeyRound, title: "No roles", description: "Create a role to get started." }}
    />
  );
}
