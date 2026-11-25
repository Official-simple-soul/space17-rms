"use client";

import { ActionForm } from "@/components/ui/action-form";
import { SelectField, TextField } from "@/components/ui/field";
import { archiveDepartment, saveDepartment } from "../actions";

type Department = { id: string; name: string; code: string; parent_id: string | null };

export function DepartmentForm({
  orgId,
  departments,
  department,
}: {
  orgId: string;
  departments: Department[];
  department?: Department;
}) {
  return (
    <ActionForm
      action={saveDepartment}
      closeOnSuccess
      submit={department ? "Save" : "Add department"}
    >
      {(state) => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="id" value={department?.id ?? ""} />
          <TextField
            label="Name"
            name="name"
            defaultValue={department?.name}
            errors={state.fieldErrors?.name}
          />
          <TextField
            label="Code"
            name="code"
            defaultValue={department?.code}
            maxLength={10}
            hint="Short and unique, such as FIN."
            className="uppercase"
            errors={state.fieldErrors?.code}
          />
          <SelectField
            label="Part of (optional)"
            name="parentId"
            defaultValue={department?.parent_id ?? ""}
          >
            <option value="">Top level</option>
            {departments
              .filter((d) => d.id !== department?.id)
              .map((d) => (
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

export function ArchiveDepartment({ orgId, id }: { orgId: string; id: string }) {
  return (
    <ActionForm
      action={archiveDepartment}
      closeOnSuccess
      submit="Archive"
      variant="danger"
      className="mt-4 space-y-3"
      confirm={{ title: "Archive this department?" }}
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
