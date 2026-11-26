"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { ItemFields } from "@/components/ui/item-fields";
import { announceProblem, SavePanel } from "@/components/ui/save-panel";
import { Card } from "@/components/ui/surface";
import { FileUploader } from "@/features/files/components/file-uploader";
import type { UploadInput } from "@/features/files/schema";
import { fromAnswers, toAnswers } from "@/features/templates/answers";
import { TemplateFields } from "@/features/templates/components/template-fields";
import { formatMoney } from "@/lib/format";
import { fromItemDrafts, lineTotal, toItemDrafts } from "@/lib/line-items";
import { useAutosave } from "@/lib/use-autosave";
import { saveDraft, startUpload, submitRequest } from "../actions";
import { checkDraft, type DraftErrors } from "../form";
import type { Draft, RequestDetail } from "../schema";

type Option = { id: string; name: string };
type Step = { name: string; who: string; required: number };
type Props = {
  orgId: string;
  base: string;
  currency: string;
  /** Null until the first save of a new request. */
  request: RequestDetail | null;
  categories: (Option & { departments: string[] })[];
  departments: Option[];
  initialSteps: Step[];
};

export function RequestEditor({
  orgId,
  base,
  currency,
  request,
  categories,
  departments,
  initialSteps,
}: Props) {
  const router = useRouter();
  const fields = request?.fields ?? [];
  const [title, setTitle] = useState(request?.title ?? "");
  const [purpose, setPurpose] = useState(request?.purpose ?? "");
  const [categoryId, setCategoryId] = useState(request?.category.id ?? "");
  const [departmentId, setDepartmentId] = useState(request?.department?.id ?? "");
  const [neededBy, setNeededBy] = useState(request?.needed_by ?? "");
  const [answers, setAnswers] = useState(() => toAnswers(fields, request?.form_data ?? {}));
  const [files, setFiles] = useState(request?.attachments ?? []);
  const [items, setItems] = useState(() => toItemDrafts(request?.items ?? []));
  const [steps, setSteps] = useState(initialSteps);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const content: Omit<Draft, "lock" | "id"> = {
    orgId,
    categoryId,
    departmentId: departmentId || null,
    title,
    purpose,
    neededBy: neededBy || null,
    form: fromAnswers(fields, answers),
    items: fromItemDrafts(items),
  };
  const id = useRef(request?.id ?? null);
  const category = useRef(request?.category.id ?? "");
  const { save, status, dirty, problem, setProblem, version } = useAutosave({
    content,
    version: request?.lock_version ?? null,
    // A request can't be stored without a category.
    paused: submitting || !categoryId,
    persist: (draft, lock) => saveDraft({ ...draft, id: id.current, lock }),
    onSaved: (result, draft) => {
      setSteps(result.steps);
      if (!id.current) {
        id.current = result.id;
        // Brings up the category's questions, and reloading now returns to this draft. It stays on
        // the same page, so what has been typed is kept.
        router.replace(`${base}/new?draft=${result.id}`, { scroll: false });
      } else if (draft.categoryId !== category.current) {
        // A new category may ask different questions.
        router.refresh();
      }
      category.current = draft.categoryId;
    },
  });

  const found = checkDraft({
    title,
    purpose,
    categoryId,
    departmentId,
    items,
    fields,
    answers,
    files: files.map((f) => f.field_key),
  });
  // After the first attempt, each error clears as soon as it is corrected.
  const errors: DraftErrors | null = checked ? found : null;

  async function submit() {
    setChecked(true);
    if (found) return announceProblem("Check the highlighted answers.");
    setSubmitting(true);
    setProblem("");
    try {
      if (!(await save())) return;
      // The chosen category's questions may not have appeared yet.
      if (request?.category.id !== categoryId) {
        setProblem("Check the questions for this category, then submit.");
        return;
      }
      const result = await submitRequest(id.current!, version.current!);
      if (result.ok) {
        toast.success("Request submitted.");
        router.push(`${base}/${id.current}`);
      } else {
        setProblem(result.message ?? "Something went wrong. Please try again.");
        // Saving again picks up the current questions if the form changed meanwhile.
        if (result.templateChanged) {
          await save(true);
          setProblem(result.message ?? "");
        }
        router.refresh();
      }
    } catch {
      setProblem("The request wasn't submitted. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const allowed = categories.find((c) => c.id === categoryId)?.departments ?? [];
  const choices = departments.filter((d) => allowed.includes(d.id));
  const total = items.reduce((sum, i) => sum + lineTotal(i), 0);
  const upload = (field: string | null, file: UploadInput) =>
    startUpload({ ...file, requestId: id.current!, field });
  const list = (message?: string) => (message ? [message] : undefined);

  return (
    <form
      noValidate
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="space-y-6">
        <Card className="space-y-5 p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              label="Category"
              name="category"
              value={categoryId}
              onChange={(e) => {
                const next = categories.find((c) => c.id === e.target.value);
                setCategoryId(e.target.value);
                if (next && !next.departments.includes(departmentId))
                  setDepartmentId(next.departments.length === 1 ? next.departments[0] : "");
                // Straight away, to bring up this category's questions and approvers.
                if (next) setTimeout(() => void save());
              }}
              hint={categoryId ? undefined : "Your draft is saved once you choose one."}
              errors={list(errors?.category)}
            >
              {!categoryId && <option value="">Choose a category</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {request && !categories.some((c) => c.id === request.category.id) && (
                <option value={request.category.id}>
                  {request.category.name} (no longer available)
                </option>
              )}
            </SelectField>
            <SelectField
              label="Department"
              name="department"
              value={choices.some((d) => d.id === departmentId) ? departmentId : ""}
              onChange={(e) => setDepartmentId(e.target.value)}
              errors={list(errors?.department)}
            >
              <option value="">Choose a department</option>
              {choices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </SelectField>
          </div>
          <TextField
            label="Title"
            name="title"
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            errors={list(errors?.title)}
          />
          <TextArea
            label="Purpose"
            name="purpose"
            maxLength={2000}
            hint="What it's for and why it's needed."
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            errors={list(errors?.purpose)}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Needed by (optional)"
              name="neededBy"
              type="date"
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold">Items</h2>
          <p className="text-muted mt-1 mb-4 text-sm">Leave empty if no money is needed.</p>
          <ItemFields
            items={items}
            onChange={setItems}
            errors={errors?.items}
            currency={currency}
          />
        </Card>

        {fields.length > 0 && (
          <Card className="p-6">
            <h2 className="mb-5 font-semibold">More details</h2>
            <TemplateFields
              fields={fields}
              controls={{
                values: answers,
                errors: errors?.answers ?? {},
                onChange: (key, value) => setAnswers((all) => ({ ...all, [key]: value })),
                renderFile: (f) => (
                  <FileUploader
                    start={(file) => upload(f.key, file)}
                    field={f.key}
                    label="Add file"
                    files={files}
                    onChange={setFiles}
                    before={save}
                  />
                ),
              }}
            />
          </Card>
        )}

        <Card className="p-6">
          <h2 className="font-semibold">Attachments (optional)</h2>
          <p className="text-muted mt-1 mb-4 text-sm">
            Anything else that supports your request, such as a photo of a damaged item, a letter or
            an event programme.
          </p>
          {categoryId ? (
            <FileUploader
              start={(file) => upload(null, file)}
              label="Add files"
              files={files}
              onChange={setFiles}
              before={save}
            />
          ) : (
            <p className="text-sm">Choose a category first, then add files.</p>
          )}
        </Card>
      </div>

      <Card className="space-y-5 p-6 lg:sticky lg:top-6">
        <div>
          <p className="text-muted text-sm">Total</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {formatMoney(total, currency)}
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Approval</h2>
          {!categoryId && (
            <p className="text-muted mt-2 text-sm">Choose a category to see who approves.</p>
          )}
          <ol aria-label="Expected approval steps" className="mt-3 space-y-3">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-semibold">
                  {i + 1}
                </span>
                <span>
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted block text-xs">
                    {s.who} · {s.required} needed
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <SavePanel
          submit="Submit request"
          submitting={submitting}
          problem={problem || (errors ? "Check the highlighted answers." : "")}
          status={status}
          dirty={dirty}
          onRetry={() => void save()}
        />
      </Card>
    </form>
  );
}
