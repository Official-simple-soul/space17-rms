"use client";

import { Building2, Inbox, Mail } from "lucide-react";
import { DataView } from "@/components/ui/data-view";
import { FormDialog } from "@/components/ui/form-dialog";
import { Badge } from "@/components/ui/surface";
import type { ListView } from "@/config/constants";
import { formatDate } from "@/lib/format";
import { DeclineRequest, RevokeInvite, StatusForm } from "./forms";

type Organisation = { id: string; name: string; slug: string; status: string; created_at: string };
type Invite = { id: string; email: string; expires_at: string };
type Request = {
  id: string;
  org_name: string;
  contact_name: string;
  email: string;
  message: string | null;
  created_at: string;
};

export function OrganisationsView({ rows, view }: { rows: Organisation[]; view: ListView }) {
  const status = (r: Organisation) => (
    <Badge tone={r.status === "suspended" ? "alert" : "neutral"}>{r.status}</Badge>
  );
  const manage = (r: Organisation) => (
    <FormDialog
      label="Manage"
      ariaLabel={`Manage ${r.name}`}
      title={r.name}
      description={`Access is currently: ${r.status}`}
      variant="outline"
      size="sm"
    >
      <StatusForm id={r.id} suspended={r.status === "suspended"} />
    </FormDialog>
  );
  return (
    <DataView
      label="Organisations"
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      searchText={(r) => `${r.name} ${r.slug}`}
      filters={[
        {
          key: "status",
          label: "Status",
          options: ["setup", "active", "suspended"].map((s) => ({
            value: s,
            label: s[0].toUpperCase() + s.slice(1),
          })),
          match: (r, v) => r.status === v,
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
          key: "slug",
          header: "Link name",
          hideOnMobile: true,
          sort: (r) => r.slug,
          cell: (r) => <span className="text-muted">{r.slug}</span>,
        },
        { key: "status", header: "Status", sort: (r) => r.status, cell: status },
        {
          key: "created",
          header: "Created",
          hideOnMobile: true,
          sort: (r) => r.created_at,
          cell: (r) => formatDate(r.created_at),
        },
        { key: "actions", header: "", align: "right", cell: manage },
      ]}
      card={(r) => (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold">{r.name}</p>
            {status(r)}
          </div>
          <p className="text-muted mt-1 mb-5 text-sm">
            {r.slug} · {formatDate(r.created_at)}
          </p>
          {manage(r)}
        </>
      )}
      empty={{
        icon: Building2,
        title: "No organisations",
        description: "Create an invitation to add the first one.",
      }}
    />
  );
}

export function InvitesView({ rows, view }: { rows: Invite[]; view: ListView }) {
  return (
    <DataView
      label="Invitations"
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      searchText={(r) => r.email}
      columns={[
        {
          key: "email",
          header: "Email",
          sort: (r) => r.email,
          cell: (r) => <span className="font-medium">{r.email}</span>,
        },
        {
          key: "expires",
          header: "Expires",
          sort: (r) => r.expires_at,
          cell: (r) => formatDate(r.expires_at),
        },
        { key: "actions", header: "", align: "right", cell: (r) => <RevokeInvite id={r.id} /> },
      ]}
      card={(r) => (
        <>
          <p className="truncate font-medium">{r.email}</p>
          <p className="text-muted mt-1 mb-4 text-sm">Expires {formatDate(r.expires_at)}</p>
          <RevokeInvite id={r.id} />
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

export function RequestsView({ rows, view }: { rows: Request[]; view: ListView }) {
  return (
    <DataView
      label="Access requests"
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      searchText={(r) => [r.org_name, r.contact_name, r.email].join(" ")}
      columns={[
        {
          key: "organisation",
          header: "Organisation",
          sort: (r) => r.org_name,
          cell: (r) => (
            <>
              <span className="font-medium">{r.org_name}</span>
              {r.message && (
                <span className="text-muted block max-w-xs truncate text-xs" title={r.message}>
                  {r.message}
                </span>
              )}
            </>
          ),
        },
        {
          key: "contact",
          header: "Contact",
          sort: (r) => r.contact_name,
          cell: (r) => (
            <>
              {r.contact_name}
              <span className="text-muted block text-xs">{r.email}</span>
            </>
          ),
        },
        {
          key: "received",
          header: "Received",
          hideOnMobile: true,
          sort: (r) => r.created_at,
          cell: (r) => formatDate(r.created_at),
        },
        { key: "actions", header: "", align: "right", cell: (r) => <DeclineRequest id={r.id} /> },
      ]}
      card={(r) => (
        <>
          <p className="font-semibold">{r.org_name}</p>
          <p className="text-muted text-sm">
            {r.contact_name} · {r.email}
          </p>
          {r.message && <p className="mt-3 text-sm">{r.message}</p>}
          <div className="mt-4">
            <DeclineRequest id={r.id} />
          </div>
        </>
      )}
      empty={{ icon: Inbox, title: "All clear", description: "New requests will appear here." }}
    />
  );
}
