"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { moveItem, RowControls } from "@/components/ui/row-controls";
import { Card, Notice } from "@/components/ui/surface";
import type { ActionState } from "@/lib/action-state";
import { useUnsavedWarning } from "@/lib/use-unsaved-warning";
import { archiveTemplate, saveTemplate } from "../actions";
import { FIELD_TYPES, TEMPLATE_KINDS, type FieldType, type TemplateField } from "../schema";
import { TemplateFields } from "./template-fields";
import { uid } from "@/lib/uid";

type Template = {
  id: string;
  name: string;
  kind: string;
  version: number;
  fields: TemplateField[];
};

const newKey = () => `f_${uid().slice(0, 12)}`;

export function TemplateEditor({
  orgId,
  slug,
  template,
}: {
  orgId: string;
  slug: string;
  template?: Template;
}) {
  const [fields, setFields] = useState(template?.fields ?? []);
  const [version, setVersion] = useState(template?.version ?? 0);
  const [saved, setSaved] = useState(() => JSON.stringify(fields));
  const draft = JSON.stringify(fields);
  useUnsavedWarning(draft !== saved);

  const change = (index: number, changes: Partial<TemplateField>) =>
    setFields((list) => list.map((f, i) => (i === index ? { ...f, ...changes } : f)));

  async function save(state: ActionState, form: FormData) {
    const result = await saveTemplate(state, form);
    if (result.ok) {
      setSaved(String(form.get("fields")));
      setVersion(Number(result.data?.version));
    }
    return result;
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card className="p-6">
        <ActionForm action={save} submit={template ? "Publish changes" : "Create template"}>
          {(state) => (
            <>
              <input type="hidden" name="orgId" value={orgId} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="id" value={template?.id ?? ""} />
              <input type="hidden" name="expected" value={version} />
              <input type="hidden" name="fields" value={draft} />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Template name"
                  name="name"
                  defaultValue={template?.name}
                  errors={state.fieldErrors?.name}
                />
                {template ? (
                  <input type="hidden" name="kind" value={template.kind} />
                ) : (
                  <SelectField label="Used for" name="kind" defaultValue="request">
                    {Object.entries(TEMPLATE_KINDS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </SelectField>
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold">Fields</h2>
                <p className="text-muted mt-1 text-xs">
                  Extra questions. Title, purpose, department and items are already included.
                </p>
              </div>
              {state.fieldErrors?.fields && (
                <Notice tone="alert">{state.fieldErrors.fields[0]}</Notice>
              )}
              <ol className="space-y-4">
                {fields.map((f, i) => {
                  const name = f.label || `field ${i + 1}`;
                  return (
                    <li key={f.key} className="rounded-control border-line border p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="text-muted text-xs font-medium">Field {i + 1}</span>
                        <RowControls
                          name={name}
                          index={i}
                          count={fields.length}
                          onMove={(by) => setFields((list) => moveItem(list, i, by))}
                          onRemove={() => setFields((list) => list.filter((_, x) => x !== i))}
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextField
                          label="Label"
                          name={`ui:${f.key}:label`}
                          value={f.label}
                          maxLength={120}
                          onChange={(e) => change(i, { label: e.target.value })}
                        />
                        <SelectField
                          label="Type"
                          name={`ui:${f.key}:type`}
                          value={f.type}
                          onChange={(e) => {
                            const type = e.target.value as FieldType;
                            change(i, {
                              type,
                              options: type === "dropdown" ? (f.options ?? []) : undefined,
                            });
                          }}
                        >
                          {Object.entries(FIELD_TYPES).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </SelectField>
                      </div>
                      <div className="mt-4 space-y-4">
                        {f.type === "dropdown" && (
                          <TextArea
                            label="Options, one per line"
                            name={`ui:${f.key}:options`}
                            defaultValue={f.options?.join("\n")}
                            onChange={(e) =>
                              change(i, {
                                options: e.target.value
                                  .split("\n")
                                  .map((o) => o.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        )}
                        <TextField
                          label="Help text (optional)"
                          name={`ui:${f.key}:help`}
                          value={f.help ?? ""}
                          maxLength={200}
                          onChange={(e) => change(i, { help: e.target.value })}
                        />
                        <label className="flex items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            checked={f.required}
                            onChange={(e) => change(i, { required: e.target.checked })}
                            className="accent-brand size-4"
                          />
                          Required
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <Button
                type="button"
                variant="outline"
                disabled={fields.length >= 40}
                onClick={() =>
                  setFields((list) => [
                    ...list,
                    { key: newKey(), label: "", type: "short_text", required: false },
                  ])
                }
              >
                <Plus className="size-4" aria-hidden />
                Add field
              </Button>
              <hr className="border-line" />
            </>
          )}
        </ActionForm>
      </Card>
      <Card className="p-6 lg:sticky lg:top-6">
        <h2 className="mb-5 text-sm font-semibold">Preview</h2>
        <TemplateFields fields={fields} />
      </Card>
    </div>
  );
}

export function ArchiveTemplate({ orgId, slug, id }: { orgId: string; slug: string; id: string }) {
  return (
    <ActionForm
      action={archiveTemplate}
      submit="Archive template"
      variant="danger"
      className="space-y-3"
      confirm={{
        title: "Archive this template?",
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
