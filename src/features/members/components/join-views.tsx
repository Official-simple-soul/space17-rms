"use client";

import { Copy, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { DataView } from "@/components/ui/data-view";
import { TextField } from "@/components/ui/field";
import { FormDialog } from "@/components/ui/form-dialog";
import { Card } from "@/components/ui/surface";
import type { ListView } from "@/config/constants";
import { formatDate } from "@/lib/format";
import {
  approveJoinRequest,
  confirmJoinRequest,
  rejectJoinRequest,
  requestToJoin,
  setJoinCode,
} from "../join-actions";
import { RoleAndDepartment } from "./member-forms";

type Role = { id: string; name: string; needsDepartment: boolean };
type Department = { id: string; name: string };
type Row = { id: string; email: string; name: string; at: string };

function CodeForm({
  orgId,
  enabled,
  submit,
  confirm,
}: {
  orgId: string;
  enabled: boolean;
  submit: string;
  confirm?: { title: string; description: string };
}) {
  return (
    <ActionForm
      action={setJoinCode}
      submit={submit}
      variant="outline"
      size="sm"
      className="space-y-2"
      closeOnSuccess
      confirm={confirm}
    >
      {() => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="enabled" value={String(enabled)} />
        </>
      )}
    </ActionForm>
  );
}

export function JoinCodeCard({ orgId, code, url }: { orgId: string; code: string; url: string }) {
  return (
    <Card className="mb-6 p-5">
      <h2 className="font-semibold">Join code</h2>
      <p className="text-muted mt-1 text-sm">
        {code
          ? `Staff enter this code at ${url}. You approve each person before an account exists.`
          : "Off. Turn it on to let staff ask to join with a code you share."}
      </p>
      <div className="mt-4 flex flex-wrap items-start gap-2">
        {code && (
          <>
            <code className="rounded-control bg-neutral-100 px-4 py-2 text-lg font-semibold tracking-widest">
              {code}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(code);
                toast.success("Code copied");
              }}
            >
              <Copy className="size-4" aria-hidden />
              Copy
            </Button>
          </>
        )}
        <CodeForm
          key={code}
          orgId={orgId}
          enabled
          submit={code ? "New code" : "Turn on"}
          confirm={
            code
              ? { title: "Replace the code?", description: "The current code will stop working." }
              : undefined
          }
        />
        {code && <CodeForm orgId={orgId} enabled={false} submit="Turn off" />}
      </div>
    </Card>
  );
}

export function JoinRequestsView({
  rows,
  view,
  orgId,
  roles,
  departments,
}: {
  rows: Row[];
  view: ListView;
  orgId: string;
  roles: Role[];
  departments: Department[];
}) {
  const ids = (r: Row) => (
    <>
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="id" value={r.id} />
    </>
  );
  const actions = (r: Row) => (
    <div className="flex flex-wrap justify-end gap-2">
      <FormDialog
        label="Approve"
        ariaLabel={`Approve ${r.name}`}
        title={`Approve ${r.name}`}
        description={r.email}
        size="sm"
      >
        <ActionForm action={approveJoinRequest} submit="Approve" variant="brand" closeOnSuccess>
          {(state) => (
            <>
              {ids(r)}
              <RoleAndDepartment roles={roles} departments={departments} state={state} />
            </>
          )}
        </ActionForm>
      </FormDialog>
      <ActionForm
        action={rejectJoinRequest}
        submit="Reject"
        size="sm"
        variant="outline"
        className="space-y-2"
        closeOnSuccess
        confirm={{ title: `Reject ${r.name}?`, description: "They can ask again after 7 days." }}
      >
        {() => ids(r)}
      </ActionForm>
    </div>
  );
  return (
    <DataView
      label="Join requests"
      rows={rows}
      rowKey={(r) => r.id}
      initialView={view}
      searchText={(r) => `${r.name} ${r.email}`}
      columns={[
        {
          key: "name",
          header: "Name",
          sort: (r) => r.name,
          cell: (r) => (
            <span className="font-medium">
              {r.name}
              <span className="text-muted block text-xs font-normal break-all">{r.email}</span>
            </span>
          ),
        },
        {
          key: "at",
          header: "Asked",
          hideOnMobile: true,
          sort: (r) => r.at,
          cell: (r) => formatDate(r.at),
        },
        { key: "actions", header: "", align: "right", cell: actions },
      ]}
      card={(r) => (
        <>
          <p className="font-medium">{r.name}</p>
          <p className="text-muted mb-4 text-sm break-all">
            {r.email} · {formatDate(r.at)}
          </p>
          {actions(r)}
        </>
      )}
      empty={{
        icon: UserPlus,
        title: "No join requests",
        description: "People who use the join code will appear here.",
      }}
    />
  );
}

export function JoinCodeForm() {
  return (
    <ActionForm action={requestToJoin} submit="Ask to join" fullWidth once>
      {(state) => (
        <>
          <TextField
            label="Join code"
            name="code"
            autoComplete="off"
            maxLength={30}
            className="tracking-widest uppercase"
            errors={state.fieldErrors?.code}
          />
          <TextField
            label="Full name"
            name="name"
            autoComplete="name"
            errors={state.fieldErrors?.name}
          />
          <TextField
            label="Work email"
            name="email"
            type="email"
            autoComplete="email"
            errors={state.fieldErrors?.email}
          />
          <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        </>
      )}
    </ActionForm>
  );
}

export function ConfirmJoinForm({ token }: { token: string }) {
  return (
    <ActionForm action={confirmJoinRequest} submit="Confirm my email" fullWidth once>
      {() => <input type="hidden" name="token" value={token} />}
    </ActionForm>
  );
}
