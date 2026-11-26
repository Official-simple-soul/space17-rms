"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { moveItem, RowControls } from "@/components/ui/row-controls";
import { Card, Notice } from "@/components/ui/surface";
import type { ActionState } from "@/lib/action-state";
import { formatMoney, parseMoney } from "@/lib/format";
import { useUnsavedWarning } from "@/lib/use-unsaved-warning";
import { archiveWorkflow, saveWorkflow } from "../actions";
import { stepsForAmount } from "../rules";
import { WORKFLOW_SUBJECTS, type WorkflowStep, type WorkflowSubject } from "../schema";
import { uid } from "@/lib/uid";

type Option = { id: string; name: string };
export type ApproverOptions = Record<WorkflowSubject, { roles: Option[]; people: Option[] }>;
type Workflow = {
  id: string;
  name: string;
  subject: WorkflowSubject;
  version: number;
  steps: WorkflowStep[];
};
/** Amount and approvals are kept as typed until they are read. */
type Draft = Omit<WorkflowStep, "min_amount_minor" | "required_approvals"> & {
  key: string;
  amount: string;
  approvals: string;
};

const toDraft = (s: WorkflowStep, i: number): Draft => ({
  ...s,
  key: `s${i}`,
  amount: s.min_amount_minor === null ? "" : (s.min_amount_minor / 100).toFixed(2),
  approvals: String(s.required_approvals),
});

function toStep(d: Draft) {
  return {
    name: d.name.trim(),
    approver_type: d.approver_type,
    role_id: d.approver_type === "role" ? d.role_id : null,
    membership_id: d.approver_type === "member" ? d.membership_id : null,
    // An unreadable amount becomes 0, which validation rejects, rather than "always".
    min_amount_minor: d.amount.trim() ? (parseMoney(d.amount) ?? 0) : null,
    required_approvals: d.approver_type === "member" ? 1 : Number(d.approvals),
  };
}

const blank = (subject: WorkflowSubject, key: string): Draft => ({
  key,
  name: "",
  approver_type: subject === "request" ? "category_approvers" : "role",
  role_id: null,
  membership_id: null,
  amount: "",
  approvals: "1",
});

export function WorkflowEditor({
  orgId,
  slug,
  currency,
  options,
  workflow,
}: {
  orgId: string;
  slug: string;
  currency: string;
  options: ApproverOptions;
  workflow?: Workflow;
}) {
  const [subject, setSubject] = useState<WorkflowSubject>(workflow?.subject ?? "request");
  const [steps, setSteps] = useState<Draft[]>(
    () => workflow?.steps.map(toDraft) ?? [{ ...blank("request", "s0"), name: "Approval" }],
  );
  const [version, setVersion] = useState(workflow?.version ?? 0);
  const draft = JSON.stringify(steps.map(toStep));
  const [saved, setSaved] = useState(draft);
  const [sample, setSample] = useState("100,000");
  useUnsavedWarning(draft !== saved);
  const { roles, people } = options[subject];

  const change = (index: number, changes: Partial<Draft>) =>
    setSteps((list) => list.map((s, i) => (i === index ? { ...s, ...changes } : s)));

  function changeSubject(next: WorkflowSubject) {
    setSubject(next);
    setSteps((list) =>
      list.map((s) => ({
        ...s,
        approver_type:
          next === "report" && s.approver_type === "category_approvers" ? "role" : s.approver_type,
        role_id: null,
        membership_id: null,
      })),
    );
  }

  async function save(state: ActionState, form: FormData) {
    const result = await saveWorkflow(state, form);
    if (result.ok) {
      setSaved(String(form.get("steps")));
      setVersion(Number(result.data?.version));
    }
    return result;
  }

  const who = (s: Draft) =>
    s.approver_type === "category_approvers"
      ? "Category approvers"
      : ((s.approver_type === "role" ? roles : people).find(
          (o) => o.id === (s.approver_type === "role" ? s.role_id : s.membership_id),
        )?.name ?? "No one chosen");
  const amount = parseMoney(sample);
  const applied =
    amount === null
      ? null
      : stepsForAmount(
          steps.map((s) => ({ ...s, min_amount_minor: toStep(s).min_amount_minor })),
          amount,
        );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card className="p-6">
        <ActionForm action={save} submit={workflow ? "Publish changes" : "Create workflow"}>
          {(state) => (
            <>
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={workflow?.id ?? ""} />
              <input type="hidden" name="expected" value={version} />
              <input type="hidden" name="steps" value={draft} />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Workflow name"
                  name="name"
                  defaultValue={workflow?.name}
                  errors={state.fieldErrors?.name}
                />
                {workflow ? (
                  <input type="hidden" name="subject" value={subject} />
                ) : (
                  <SelectField
                    label="Used for"
                    name="subject"
                    value={subject}
                    onChange={(e) => changeSubject(e.target.value as WorkflowSubject)}
                  >
                    {Object.entries(WORKFLOW_SUBJECTS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </SelectField>
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold">Steps</h2>
                <p className="text-muted mt-1 text-xs">
                  Each step must finish before the next begins.
                </p>
              </div>
              {state.fieldErrors?.steps && (
                <Notice tone="alert">{state.fieldErrors.steps[0]}</Notice>
              )}
              <ol className="space-y-4">
                {steps.map((s, i) => (
                  <li key={s.key} className="rounded-control border-line border p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-muted text-xs font-medium">Step {i + 1}</span>
                      <RowControls
                        name={s.name || `step ${i + 1}`}
                        index={i}
                        count={steps.length}
                        onMove={(by) => setSteps((list) => moveItem(list, i, by))}
                        onRemove={() => setSteps((list) => list.filter((_, x) => x !== i))}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        label="Step name"
                        name={`ui:${s.key}:name`}
                        value={s.name}
                        maxLength={60}
                        onChange={(e) => change(i, { name: e.target.value })}
                      />
                      <SelectField
                        label="Approved by"
                        name={`ui:${s.key}:type`}
                        value={s.approver_type}
                        onChange={(e) =>
                          change(i, { approver_type: e.target.value as Draft["approver_type"] })
                        }
                      >
                        {subject === "request" && (
                          <option value="category_approvers">Category approvers</option>
                        )}
                        <option value="role">Anyone with a role</option>
                        <option value="member">One person</option>
                      </SelectField>
                      {s.approver_type === "role" && (
                        <SelectField
                          label="Role"
                          name={`ui:${s.key}:role`}
                          value={s.role_id ?? ""}
                          hint={roles.length ? undefined : "No role can approve these yet."}
                          onChange={(e) => change(i, { role_id: e.target.value || null })}
                        >
                          <option value="">Choose a role</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                          {s.role_id && !roles.some((r) => r.id === s.role_id) && (
                            <option value={s.role_id}>Role that can no longer approve</option>
                          )}
                        </SelectField>
                      )}
                      {s.approver_type === "member" && (
                        <SelectField
                          label="Person"
                          name={`ui:${s.key}:member`}
                          value={s.membership_id ?? ""}
                          hint={people.length ? undefined : "No one can approve these yet."}
                          onChange={(e) => change(i, { membership_id: e.target.value || null })}
                        >
                          <option value="">Choose a person</option>
                          {people.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                          {s.membership_id && !people.some((p) => p.id === s.membership_id) && (
                            <option value={s.membership_id}>
                              Person who can no longer approve
                            </option>
                          )}
                        </SelectField>
                      )}
                      <TextField
                        label={`From amount, ${currency} (optional)`}
                        name={`ui:${s.key}:amount`}
                        inputMode="decimal"
                        value={s.amount}
                        hint="Leave empty to apply to every amount."
                        errors={
                          s.amount.trim() && !parseMoney(s.amount)
                            ? ["Enter an amount above zero, such as 50,000."]
                            : undefined
                        }
                        onChange={(e) => change(i, { amount: e.target.value })}
                      />
                      {s.approver_type !== "member" && (
                        <TextField
                          label="Approvals needed"
                          name={`ui:${s.key}:approvals`}
                          type="number"
                          min={1}
                          max={10}
                          value={s.approvals}
                          onChange={(e) => change(i, { approvals: e.target.value })}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              <Button
                type="button"
                variant="outline"
                disabled={steps.length >= 10}
                onClick={() => setSteps((list) => [...list, blank(subject, uid())])}
              >
                <Plus className="size-4" aria-hidden />
                Add step
              </Button>
              <hr className="border-line" />
            </>
          )}
        </ActionForm>
      </Card>
      <Card className="space-y-5 p-6 lg:sticky lg:top-6">
        <h2 className="text-sm font-semibold">Test an amount</h2>
        <TextField
          label={`Sample amount, ${currency}`}
          name="sample"
          inputMode="decimal"
          value={sample}
          onChange={(e) => setSample(e.target.value)}
          errors={amount === null ? ["Enter an amount, such as 100,000."] : undefined}
        />
        {applied && amount !== null && (
          <div>
            <p className="text-muted mb-3 text-xs">
              {formatMoney(amount, currency)} needs {applied.length}{" "}
              {applied.length === 1 ? "step" : "steps"}
            </p>
            <ol aria-label="Steps for this amount" className="space-y-3">
              {applied.map((s, i) => (
                <li key={s.key} className="flex gap-3 text-sm">
                  <span className="bg-ink grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <span>
                    <span className="font-medium">{s.name || "Unnamed step"}</span>
                    <span className="text-muted block text-xs">
                      {who(s)} · {s.approver_type === "member" ? 1 : s.approvals || "?"} needed
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </Card>
    </div>
  );
}

export function ArchiveWorkflow({ orgId, slug, id }: { orgId: string; slug: string; id: string }) {
  return (
    <ActionForm
      action={archiveWorkflow}
      submit="Archive workflow"
      variant="danger"
      className="space-y-3"
      confirm={{
        title: "Archive this workflow?",
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
