"use client";

import { Mail, Users } from "lucide-react";
import Link from "next/link";
import { DataView, type Column, type ServerPaging } from "@/components/ui/data-view";
import { Badge } from "@/components/ui/surface";
import type { ListView } from "@/config/constants";
import { formatDate } from "@/lib/format";
import { RevokeInvitation } from "./member-forms";

export type MemberRow = {
  id: string;
  name: string;
  status: string;
  roles: string[];
  departments: string[];
};
export type InvitationRow = { id: string; email: string; role: string; expiresAt: string };

function Person({ row, href }: { row: MemberRow; href?: string }) {
  const body = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-sm font-semibold">
        {row.name[0]?.toUpperCase()}
      </span>
      <span className="font-medium">{row.name}</span>
    </>
  );
  return href ? (
    <Link href={href} className="flex items-center gap-3 hover:underline">
      {body}
    </Link>
  ) : (
    <span className="flex items-center gap-3">{body}</span>
  );
}
const status = (row: MemberRow) => (
  <Badge tone={row.status === "active" ? "neutral" : "alert"}>{row.status}</Badge>
);
const names = (row: MemberRow) => row.departments.join(", ");

type Props = {
  rows: MemberRow[];
  view: ListView;
  departments: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  server: ServerPaging;
  base: string;
  canManage: boolean;
};

export function MembersView({ rows, view, server, departments, roles, base, canManage }: Props) {
  const href = (row: MemberRow) => (canManage ? `${base}/${row.id}` : undefined);
  const columns: Column<MemberRow>[] = [
    {
      key: "name",
      header: "Name",
      sort: (r) => r.name,
      cell: (r) => <Person row={r} href={href(r)} />,
    },
    {
      key: "role",
      header: "Role",
      sort: (r) => r.roles.join(", "),
      cell: (r) => r.roles.join(", ") || <span className="text-muted">No role</span>,
    },
    {
      key: "departments",
      header: "Departments",
      hideOnMobile: true,
      sort: names,
      cell: (r) => names(r) || <span className="text-muted">None</span>,
    },
    { key: "status", header: "Status", hideOnMobile: true, sort: (r) => r.status, cell: status },
  ];
  return (
    <DataView
      label="People"
      server={server}
      rows={rows}
      rowKey={(r) => r.id}
      columns={columns}
      initialView={view}
      searchText={(r) => [r.name, ...r.roles, names(r)].join(" ")}
      filters={[
        {
          key: "department",
          label: "Department",
          options: [
            ...departments.map((d) => ({ value: d.id, label: d.name })),
            { value: "none", label: "No department" },
          ],
        },
        {
          key: "role",
          label: "Role",
          options: roles.map((r) => ({ value: r.id, label: r.name })),
        },
        {
          key: "status",
          label: "Status",
          options: [
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
          ],
        },
      ]}
      card={(r) => (
        <>
          <div className="flex items-start justify-between gap-2">
            <Person row={r} href={href(r)} />
            {status(r)}
          </div>
          <p className="mt-4 text-sm">{r.roles.join(", ") || "No role"}</p>
          <p className="text-muted text-sm">{names(r) || "No department"}</p>
        </>
      )}
      empty={{ icon: Users, title: "No people yet", description: "Invite someone to get started." }}
    />
  );
}

export function InvitationsView({
  rows,
  view,
  orgId,
}: {
  rows: InvitationRow[];
  view: ListView;
  orgId: string;
}) {
  return (
    <DataView
      label="Invitations"
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      searchText={(r) => `${r.email} ${r.role}`}
      columns={[
        {
          key: "email",
          header: "Email",
          sort: (r) => r.email,
          cell: (r) => <span className="font-medium">{r.email}</span>,
        },
        {
          key: "role",
          header: "Role",
          hideOnMobile: true,
          sort: (r) => r.role,
          cell: (r) => r.role,
        },
        {
          key: "expires",
          header: "Expires",
          hideOnMobile: true,
          sort: (r) => r.expiresAt,
          cell: (r) => formatDate(r.expiresAt),
        },
        {
          key: "actions",
          header: "",
          align: "right",
          cell: (r) => <RevokeInvitation orgId={orgId} id={r.id} />,
        },
      ]}
      card={(r) => (
        <>
          <p className="truncate font-medium">{r.email}</p>
          <p className="text-muted mt-1 mb-4 text-sm">
            {r.role} · Expires {formatDate(r.expiresAt)}
          </p>
          <RevokeInvitation orgId={orgId} id={r.id} />
        </>
      )}
      empty={{
        icon: Mail,
        title: "No open invitations",
        description: "New invitations will appear here until they're accepted.",
      }}
    />
  );
}
