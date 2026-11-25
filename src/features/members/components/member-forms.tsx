"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import type { ActionState } from "@/lib/action-state";
import {
  acceptInvitation,
  grantRole,
  inviteMany,
  inviteMember,
  registerFromInvitation,
  revokeInvitation,
  revokeRole,
  setDepartments,
  setStatus,
} from "../actions";

type Role = { id: string; name: string; needsDepartment: boolean };
type Department = { id: string; name: string };

function InviteResult({ state }: { state: ActionState }) {
  const links = state.data?.links;
  const errors = state.data?.errors;
  return (
    <>
      {errors && (
        <Notice tone="alert">
          <span className="whitespace-pre-line">{errors}</span>
        </Notice>
      )}
      {links && (
        <div className="rounded-control border-line border p-3">
          <pre className="max-h-40 overflow-auto text-xs" data-testid="join-links">
            {links}
          </pre>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={async () => {
              await navigator.clipboard.writeText(links);
              toast.success("Copied");
            }}
          >
            <Copy className="size-4" aria-hidden />
            Copy
          </Button>
        </div>
      )}
    </>
  );
}

function RoleAndDepartment({
  roles,
  departments,
  state,
}: {
  roles: Role[];
  departments: Department[];
  state: ActionState;
}) {
  const [roleId, setRoleId] = useState("");
  const needs = roles.find((r) => r.id === roleId)?.needsDepartment;
  return (
    <>
      <SelectField
        label="Role"
        name="roleId"
        value={roleId}
        onChange={(e) => setRoleId(e.target.value)}
        errors={state.fieldErrors?.roleId}
      >
        <option value="">Choose a role</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label={needs ? "Department" : "Department (optional)"}
        name="departmentId"
        defaultValue=""
      >
        <option value="">None</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </SelectField>
    </>
  );
}

export function InviteForm({
  orgId,
  roles,
  departments,
}: {
  orgId: string;
  roles: Role[];
  departments: Department[];
}) {
  return (
    <ActionForm action={inviteMember} submit="Create invitation" variant="brand">
      {(state) => (
        <>
          <InviteResult state={state} />
          <input type="hidden" name="orgId" value={orgId} />
          <TextField label="Email" name="email" type="email" errors={state.fieldErrors?.email} />
          <RoleAndDepartment roles={roles} departments={departments} state={state} />
        </>
      )}
    </ActionForm>
  );
}

export function BulkInviteForm({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState("");
  return (
    <ActionForm action={inviteMany} submit="Check and invite" variant="outline">
      {(state) => (
        <>
          <InviteResult state={state} />
          <input type="hidden" name="orgId" value={orgId} />
          <TextArea
            label="One person per line"
            name="rows"
            value={rows}
            onChange={(e) => setRows(e.target.value)}
            placeholder="ada@example.com, Staff, FIN"
            hint="Email, role, department code. Up to 100 people."
            className="font-mono"
            errors={state.fieldErrors?.rows}
          />
          <label className="block text-sm font-medium">
            Or choose a CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="text-muted mt-1.5 block w-full text-sm"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setRows(await file.text());
              }}
            />
          </label>
        </>
      )}
    </ActionForm>
  );
}

export function RevokeInvitation({ orgId, id }: { orgId: string; id: string }) {
  return (
    <ActionForm
      action={revokeInvitation}
      size="sm"
      submit="Revoke"
      variant="outline"
      className="space-y-2"
      confirm={{ title: "Revoke this invitation?", description: "The link will stop working." }}
    >
      {() => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="id" value={id} />
        </>
      )}
    </ActionForm>
  );
}

export function GrantRoleForm({
  orgId,
  memberId,
  roles,
  departments,
}: {
  orgId: string;
  memberId: string;
  roles: Role[];
  departments: Department[];
}) {
  return (
    <ActionForm action={grantRole} submit="Add role">
      {(state) => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="memberId" value={memberId} />
          <RoleAndDepartment roles={roles} departments={departments} state={state} />
          <TextField
            label="Ends on (optional)"
            name="until"
            type="date"
            hint="Use an end date to add a deputy head of department."
            errors={state.fieldErrors?.until}
          />
        </>
      )}
    </ActionForm>
  );
}

export function RevokeRole({ orgId, grantId }: { orgId: string; grantId: string }) {
  return (
    <ActionForm
      action={revokeRole}
      submit="Remove"
      variant="outline"
      className="space-y-2"
      confirm={{ title: "Remove this role?", description: "Access ends immediately." }}
    >
      {() => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="grantId" value={grantId} />
        </>
      )}
    </ActionForm>
  );
}

export function DepartmentsForm({
  orgId,
  memberId,
  departments,
  selected,
  primary,
}: {
  orgId: string;
  memberId: string;
  departments: Department[];
  selected: string[];
  primary: string | null;
}) {
  return (
    <ActionForm action={setDepartments} submit="Save departments">
      {() => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="memberId" value={memberId} />
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Belongs to</legend>
            {departments.map((d) => (
              <label key={d.id} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  name="departments"
                  value={d.id}
                  defaultChecked={selected.includes(d.id)}
                  className="accent-ink size-4"
                />
                {d.name}
              </label>
            ))}
          </fieldset>
          <SelectField label="Main department" name="primary" defaultValue={primary ?? ""}>
            <option value="">None</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </SelectField>
        </>
      )}
    </ActionForm>
  );
}

export function StatusForm({
  orgId,
  slug,
  memberId,
  status,
  to,
  label,
}: {
  orgId: string;
  slug: string;
  memberId: string;
  status: string;
  to: "active" | "suspended" | "left";
  label: string;
}) {
  return (
    <ActionForm
      action={setStatus}
      submit={label}
      variant={to === "active" ? "outline" : "danger"}
      className="space-y-3"
      confirm={
        to === "left"
          ? {
              title: "Remove this person?",
              description: "Their roles, departments and approver assignments will be cleared.",
            }
          : { title: `${label} this person?` }
      }
    >
      {() => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="status" value={to} />
          <TextField label={`Reason to ${label.toLowerCase()}`} name="reason" key={status} />
        </>
      )}
    </ActionForm>
  );
}

export function JoinRegisterForm({ token, email }: { token: string; email: string }) {
  return (
    <ActionForm action={registerFromInvitation} submit="Create account and join" fullWidth>
      {(state) => (
        <>
          <input type="hidden" name="token" value={token} />
          <TextField
            label="Email"
            name="email"
            value={email}
            readOnly
            autoComplete="username"
            className="bg-neutral-100"
          />
          <TextField
            label="Full name"
            name="fullName"
            autoComplete="name"
            errors={state.fieldErrors?.fullName}
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            hint="At least 10 characters."
            errors={state.fieldErrors?.password}
          />
        </>
      )}
    </ActionForm>
  );
}

export function JoinForm({ token }: { token: string }) {
  return (
    <ActionForm action={acceptInvitation} submit="Join organisation" fullWidth>
      {() => <input type="hidden" name="token" value={token} />}
    </ActionForm>
  );
}
