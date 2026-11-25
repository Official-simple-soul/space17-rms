"use client";

import { ActionForm } from "@/components/ui/action-form";
import { TextField } from "@/components/ui/field";
import { archiveRole, saveRole } from "../actions";

const SCOPES: Record<string, string> = {
  own: "Own items",
  category: "Assigned categories",
  department: "Their department",
  org: "Whole organisation",
};
type Permission = { key: string; description: string; allowed_scopes: string[] };
type Role = {
  id: string;
  name: string;
  systemKey: string | null;
  permissions: { key: string; scope: string }[];
};

export function RoleForm({
  orgId,
  slug,
  permissions,
  role,
}: {
  orgId: string;
  slug: string;
  permissions: Permission[];
  role?: Role;
}) {
  const groups = Object.entries(Object.groupBy(permissions, (p) => p.key.split(".")[0]));
  const grid = (disabled: boolean) => (
    <div className="space-y-6">
      {groups.map(([group, items]) => (
        <fieldset key={group} disabled={disabled}>
          <legend className="mb-2 text-sm font-semibold capitalize">
            {group === "org" ? "Organisation" : group}
          </legend>
          <ul className="divide-line rounded-control border-line divide-y border">
            {items?.map((p) => (
              <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <label htmlFor={`perm-${p.key}`} className="text-sm">
                  {p.description}
                </label>
                <select
                  id={`perm-${p.key}`}
                  name={`perm:${p.key}`}
                  defaultValue={role?.permissions.find((x) => x.key === p.key)?.scope ?? ""}
                  className="rounded-control border-line bg-surface h-10 w-full border px-3 text-sm disabled:bg-neutral-100 sm:w-52"
                >
                  <option value="">No access</option>
                  {p.allowed_scopes.map((s) => (
                    <option key={s} value={s}>
                      {SCOPES[s]}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </fieldset>
      ))}
    </div>
  );
  if (role?.systemKey === "admin") return grid(true);
  return (
    <ActionForm action={saveRole} submit={role ? "Save role" : "Create role"} className="space-y-6">
      {(state) => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={role?.id ?? ""} />
          <TextField
            label="Role name"
            name="name"
            defaultValue={role?.name}
            errors={state.fieldErrors?.name}
          />
          {grid(false)}
        </>
      )}
    </ActionForm>
  );
}

export function ArchiveRole({ orgId, slug, id }: { orgId: string; slug: string; id: string }) {
  return (
    <ActionForm
      action={archiveRole}
      submit="Archive role"
      variant="danger"
      className="mt-6 space-y-3"
      confirm={{ title: "Archive this role?" }}
    >
      {() => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={id} />
        </>
      )}
    </ActionForm>
  );
}
