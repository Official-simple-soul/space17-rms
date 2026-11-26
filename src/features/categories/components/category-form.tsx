"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { archiveCategory, saveCategory } from "../actions";
import { APPLIES_TO, type AppliesTo, type CategoryApprover } from "../schema";
import { uid } from "@/lib/uid";

type Option = { id: string; name: string };
type Category = {
  id: string;
  name: string;
  code: string;
  appliesTo: AppliesTo;
  requiresAccounting: boolean;
  templateId: string | null;
  workflowId: string | null;
  departmentIds: string[];
  approvers: CategoryApprover[];
};
type Props = {
  orgId: string;
  slug: string;
  category?: Category;
  departments: Option[];
  templates: Option[];
  workflows: Option[];
  roles: Option[];
  people: Option[];
};
type Row = { key: string; who: string; department: string };

const toRow = (a: CategoryApprover, i: number): Row => ({
  key: `a${i}`,
  who: a.membership_id ? `person:${a.membership_id}` : `role:${a.role_id}`,
  department: a.department_id ?? "",
});

function toApprover({ who, department }: Row): CategoryApprover {
  const [kind, id] = who.split(":");
  return {
    membership_id: kind === "person" ? id : null,
    role_id: kind === "role" ? id : null,
    department_id: department || null,
  };
}

export function CategoryForm({
  orgId,
  slug,
  category,
  departments,
  templates,
  workflows,
  roles,
  people,
}: Props) {
  const [applies, setApplies] = useState<AppliesTo>(category?.appliesTo ?? "both");
  const [approvers, setApprovers] = useState<Row[]>(() => category?.approvers.map(toRow) ?? []);
  const change = (key: string, changes: Partial<Row>) =>
    setApprovers((list) => list.map((a) => (a.key === key ? { ...a, ...changes } : a)));
  const known = new Set([
    "",
    ...roles.map((r) => `role:${r.id}`),
    ...people.map((p) => `person:${p.id}`),
  ]);

  return (
    <ActionForm
      action={saveCategory}
      submit={category ? "Save category" : "Create category"}
      className="space-y-7"
    >
      {(state) => (
        <>
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="id" value={category?.id ?? ""} />
          <input type="hidden" name="approvers" value={JSON.stringify(approvers.map(toApprover))} />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Name"
              name="name"
              defaultValue={category?.name}
              errors={state.fieldErrors?.name}
            />
            <TextField
              label="Code"
              name="code"
              maxLength={10}
              hint="Short and unique, such as TRV."
              className="uppercase"
              defaultValue={category?.code}
              errors={state.fieldErrors?.code}
            />
            <SelectField
              label="Used for"
              name="appliesTo"
              value={applies}
              onChange={(e) => setApplies(e.target.value as AppliesTo)}
            >
              {Object.entries(APPLIES_TO).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>

          {departments.length > 0 && (
            <fieldset>
              <legend className="text-sm font-semibold">Departments</legend>
              <p className="text-muted mt-1 mb-3 text-xs">
                Choose none to make it available to every department.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {departments.map((d) => (
                  <label key={d.id} className="flex items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      name="departments"
                      value={d.id}
                      defaultChecked={category?.departmentIds.includes(d.id)}
                      className="accent-brand size-4"
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {applies !== "expense" && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField
                  label="Request template"
                  name="templateId"
                  defaultValue={category?.templateId ?? ""}
                >
                  <option value="">Standard form only</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  label="Approval workflow"
                  name="workflowId"
                  defaultValue={category?.workflowId ?? ""}
                >
                  <option value="">One approval from its approvers</option>
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </SelectField>
              </div>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="requiresAccounting"
                  defaultChecked={category?.requiresAccounting ?? true}
                  className="accent-brand mt-0.5 size-4"
                />
                <span>
                  <span className="font-medium">Spending must be accounted for</span>
                  <span className="text-muted block text-xs">
                    Paid requests stay open until their expenses are reported.
                  </span>
                </span>
              </label>
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold">Approvers</legend>
                <p className="text-muted text-xs">
                  People whose role approves the whole organisation or department are included
                  already. Add those limited to assigned categories.
                </p>
                {state.fieldErrors?.approvers && (
                  <Notice tone="alert">{state.fieldErrors.approvers[0]}</Notice>
                )}
                {approvers.map((a, i) => (
                  <div
                    key={a.key}
                    className="rounded-control border-line grid items-end gap-3 border p-4 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    <SelectField
                      label={`Approver ${i + 1}`}
                      name={`ui:${a.key}:who`}
                      value={a.who}
                      onChange={(e) => change(a.key, { who: e.target.value })}
                    >
                      <option value="">Choose</option>
                      <optgroup label="Roles">
                        {roles.map((r) => (
                          <option key={r.id} value={`role:${r.id}`}>
                            {r.name}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="People">
                        {people.map((p) => (
                          <option key={p.id} value={`person:${p.id}`}>
                            {p.name}
                          </option>
                        ))}
                      </optgroup>
                      {!known.has(a.who) && <option value={a.who}>Can no longer approve</option>}
                    </SelectField>
                    <SelectField
                      label="For requests from"
                      name={`ui:${a.key}:department`}
                      value={a.department}
                      onChange={(e) => change(a.key, { department: e.target.value })}
                    >
                      <option value="">Any department</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </SelectField>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove approver ${i + 1}`}
                      onClick={() => setApprovers((list) => list.filter((x) => x.key !== a.key))}
                    >
                      <Trash2 className="text-brand size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setApprovers((list) => [...list, { key: uid(), who: "", department: "" }])
                  }
                >
                  <Plus className="size-4" aria-hidden />
                  Add approver
                </Button>
              </fieldset>
            </>
          )}
        </>
      )}
    </ActionForm>
  );
}

export function ArchiveCategory({ orgId, slug, id }: { orgId: string; slug: string; id: string }) {
  return (
    <ActionForm
      action={archiveCategory}
      submit="Archive category"
      variant="danger"
      className="space-y-3"
      confirm={{
        title: "Archive this category?",
        description: "Existing records keep it. It can't be chosen for new ones.",
      }}
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
