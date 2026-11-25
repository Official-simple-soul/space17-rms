"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { Card, Notice } from "@/components/ui/surface";
import { TemplateFields } from "@/features/templates/components/template-fields";
import { formatMoney, parseMoney } from "@/lib/format";
import { useUnsavedWarning } from "@/lib/use-unsaved-warning";
import { saveDraft, submitRequest } from "../actions";
import {
  checkDraft,
  fromAnswers,
  lineTotal,
  parseQuantity,
  toAnswers,
  type DraftErrors,
  type ItemDraft,
} from "../form";
import type { Draft, RequestDetail } from "../schema";
import { FileUploader } from "./file-uploader";

type Option = { id: string; name: string };
type Step = { name: string; who: string; required: number };
type Props = {
  base: string;
  request: RequestDetail;
  categories: (Option & { departments: string[] })[];
  departments: Option[];
  initialSteps: Step[];
};

const AUTOSAVE_MS = 1200;
const blankItem = (): ItemDraft => ({
  key: crypto.randomUUID(),
  description: "",
  quantity: "1",
  price: "",
});

export function RequestEditor({ base, request, categories, departments, initialSteps }: Props) {
  const router = useRouter();
  const { fields, currency } = request;
  const [title, setTitle] = useState(request.title);
  const [purpose, setPurpose] = useState(request.purpose);
  const [categoryId, setCategoryId] = useState(request.category.id);
  const [departmentId, setDepartmentId] = useState(request.department?.id ?? "");
  const [neededBy, setNeededBy] = useState(request.needed_by ?? "");
  const [answers, setAnswers] = useState(() => toAnswers(fields, request.form_data));
  const [files, setFiles] = useState(request.attachments);
  const [items, setItems] = useState<ItemDraft[]>(() =>
    request.items.map((i) => ({
      key: i.id,
      description: i.description,
      quantity: i.quantity ? String(i.quantity) : "",
      price: i.unit_price_minor ? (i.unit_price_minor / 100).toFixed(2) : "",
    })),
  );
  const [steps, setSteps] = useState(initialSteps);
  const [checked, setChecked] = useState(false);
  const [problem, setProblem] = useState("");
  const [status, setStatus] = useState<"saved" | "saving" | "failed" | "stale">("saved");
  const [submitting, setSubmitting] = useState(false);

  const content: Omit<Draft, "lock"> = {
    orgId: request.org_id,
    id: request.id,
    categoryId,
    departmentId: departmentId || null,
    title,
    purpose,
    neededBy: neededBy || null,
    form: fromAnswers(fields, answers),
    items: items.map((i) => ({
      description: i.description.trim(),
      quantity: Math.min(parseQuantity(i.quantity) ?? 0, 100_000),
      unit_price_minor: Math.min(parseMoney(i.price) ?? 0, 100_000_000_000),
    })),
  };
  const serialised = JSON.stringify(content);
  const [saved, setSaved] = useState(serialised);
  const dirty = serialised !== saved;
  useUnsavedWarning(dirty);

  // Saves run one after another, each from the version the previous one produced.
  const latest = useRef(serialised);
  const stored = useRef(serialised);
  const category = useRef(request.category.id);
  const version = useRef(request.lock_version);
  const queue = useRef<Promise<boolean>>(Promise.resolve(true));
  useEffect(() => {
    latest.current = serialised;
  }, [serialised]);

  const save = useCallback((): Promise<boolean> => {
    queue.current = queue.current
      .catch(() => false)
      .then(async () => {
        const next = latest.current;
        if (next === stored.current) return true;
        setStatus("saving");
        const draft = JSON.parse(next) as Omit<Draft, "lock">;
        try {
          const result = await saveDraft({ ...draft, lock: version.current });
          if (!result.ok) {
            setProblem(result.message);
            setStatus(result.stale ? "stale" : "failed");
            return false;
          }
          const changedCategory = draft.categoryId !== category.current;
          category.current = draft.categoryId;
          version.current = result.version;
          stored.current = next;
          setSaved(next);
          setSteps(result.steps);
          setProblem("");
          setStatus("saved");
          // A new category may ask different questions.
          if (changedCategory) router.refresh();
          return true;
        } catch {
          setProblem("Your changes aren't saved yet. Check your connection.");
          setStatus("failed");
          return false;
        }
      });
    return queue.current;
  }, [router]);

  useEffect(() => {
    if (!dirty || status === "stale" || submitting) return;
    const timer = setTimeout(save, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [dirty, serialised, status, submitting, save]);

  const found = checkDraft({
    title,
    purpose,
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
    if (found) {
      return;
    }
    setSubmitting(true);
    setProblem("");
    try {
      if (!(await save())) return;
      const result = await submitRequest(request.id, version.current);
      if (result.ok) router.push(`${base}/${request.id}`);
      else {
        setProblem(result.message ?? "Something went wrong. Please try again.");
        // Saving again picks up the current questions if the form changed meanwhile.
        if (result.templateChanged) {
          stored.current = "";
          await save();
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

  const changeItem = (key: string, changes: Partial<ItemDraft>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...changes } : i)));
  const allowed = categories.find((c) => c.id === categoryId)?.departments ?? [];
  const choices = departments.filter((d) => allowed.includes(d.id));
  const total = items.reduce((sum, i) => sum + lineTotal(i), 0);
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
            <SelectField
              label="Category"
              name="category"
              value={categoryId}
              onChange={(e) => {
                const next = categories.find((c) => c.id === e.target.value);
                setCategoryId(e.target.value);
                if (next && !next.departments.includes(departmentId))
                  setDepartmentId(next.departments.length === 1 ? next.departments[0] : "");
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {!categories.some((c) => c.id === categoryId) && (
                <option value={categoryId}>{request.category.name} (no longer available)</option>
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
          <ul className="space-y-4">
            {items.map((item, i) => (
              <li key={item.key} className="rounded-control border-line border p-4">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_6rem_9rem]">
                  <TextField
                    label={`Item ${i + 1}`}
                    name={`item:${item.key}`}
                    maxLength={200}
                    value={item.description}
                    onChange={(e) => changeItem(item.key, { description: e.target.value })}
                  />
                  <TextField
                    label="Quantity"
                    name={`quantity:${item.key}`}
                    inputMode="decimal"
                    value={item.quantity}
                    onChange={(e) => changeItem(item.key, { quantity: e.target.value })}
                  />
                  <TextField
                    label={`Unit price, ${currency}`}
                    name={`price:${item.key}`}
                    inputMode="decimal"
                    value={item.price}
                    onChange={(e) => changeItem(item.key, { price: e.target.value })}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm tabular-nums">
                    {formatMoney(lineTotal(item), currency)}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove item ${i + 1}`}
                    onClick={() => setItems((all) => all.filter((x) => x.key !== item.key))}
                  >
                    <Trash2 className="text-brand size-4" aria-hidden />
                  </Button>
                </div>
                {errors?.items[item.key] && (
                  <p role="alert" className="text-brand-strong text-xs font-medium">
                    {errors.items[item.key]}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={items.length >= 50}
            onClick={() => setItems((all) => [...all, blankItem()])}
          >
            <Plus className="size-4" aria-hidden />
            Add item
          </Button>
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
                    requestId={request.id}
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
          <h2 className="mb-4 font-semibold">Attachments</h2>
          <FileUploader
            requestId={request.id}
            label="Add files"
            files={files}
            onChange={setFiles}
            before={save}
          />
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
        {(problem || errors) && (
          <Notice tone="alert">{problem || "Check the highlighted answers."}</Notice>
        )}
        {status === "stale" ? (
          <Button type="button" className="w-full" onClick={() => window.location.reload()}>
            Reload
          </Button>
        ) : (
          <Button type="submit" variant="brand" className="w-full" loading={submitting}>
            Submit request
          </Button>
        )}
        <div className="flex items-center justify-between gap-2 text-xs" aria-live="polite">
          <span className="text-muted">
            {status === "saving" ? "Saving…" : dirty ? "Not saved yet" : "Draft saved"}
          </span>
          {dirty && status === "failed" && (
            <button type="button" className="text-brand font-medium" onClick={() => void save()}>
              Try again
            </button>
          )}
        </div>
      </Card>
    </form>
  );
}
