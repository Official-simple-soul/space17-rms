"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { ItemFields } from "@/components/ui/item-fields";
import { announceProblem, SavePanel } from "@/components/ui/save-panel";
import { Card } from "@/components/ui/surface";
import { FileUploader } from "@/features/files/components/file-uploader";
import type { Attachment, UploadInput } from "@/features/files/schema";
import { formatMoney } from "@/lib/format";
import { blankItem, fromItemDrafts, lineTotal, toItemDrafts } from "@/lib/line-items";
import { useAutosave } from "@/lib/use-autosave";
import { cn } from "@/lib/utils";
import { saveExpense, startExpenseFile, submitExpense } from "../actions";
import { checkExpense } from "../form";
import { FUNDING, PROOF, type ExpenseDetail, type FileKind } from "../schema";

type Option = { id: string; name: string };
type Props = {
  orgId: string;
  base: string;
  currency: string;
  today: string;
  /** Null until the first save of a new expense. */
  expense: ExpenseDetail | null;
  linkedRequestId?: string;
  categories: (Option & { departments: string[] })[];
  departments: Option[];
  requests: {
    id: string;
    number: string;
    title: string;
    department_id: string;
    category_id: string;
  }[];
};

export function ExpenseEditor({
  orgId,
  base,
  currency,
  today,
  expense,
  linkedRequestId = "",
  categories,
  departments,
  requests,
}: Props) {
  const router = useRouter();
  const linked = requests.find((r) => r.id === linkedRequestId);
  const mine = departments.filter((d) => categories.some((c) => c.departments.includes(d.id)));
  const usable = (categoryId: string) => categories.some((c) => c.id === categoryId);
  const [description, setDescription] = useState(expense?.description ?? "");
  const [date, setDate] = useState(expense ? (expense.date ?? "") : today);
  const [departmentId, setDepartmentId] = useState(
    expense?.department?.id ?? linked?.department_id ?? (mine.length === 1 ? mine[0].id : ""),
  );
  const [categoryId, setCategoryId] = useState(
    expense?.category?.id ?? (linked && usable(linked.category_id) ? linked.category_id : ""),
  );
  const [requestId, setRequestId] = useState(expense?.request?.id ?? linked?.id ?? "");
  const [seller, setSeller] = useState(expense?.seller ?? "");
  const [location, setLocation] = useState(expense?.location ?? "");
  const [phone, setPhone] = useState(expense?.phone ?? "");
  const [funding, setFunding] = useState<keyof typeof FUNDING>(expense?.funding ?? "department");
  const [noReceipt, setNoReceipt] = useState(expense?.no_receipt ?? false);
  const [reason, setReason] = useState(expense?.no_receipt_reason ?? "");
  const [items, setItems] = useState(() =>
    expense?.items.length ? toItemDrafts(expense.items) : [blankItem()],
  );
  const [files, setFiles] = useState<Attachment[]>(expense?.attachments ?? []);
  const [proof, setProof] = useState<keyof typeof PROOF>("purchase_photo");
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const id = useRef(expense?.id ?? null);
  const { save, status, dirty, problem, setProblem, version } = useAutosave({
    content: {
      orgId,
      categoryId: categoryId || null,
      departmentId: departmentId || null,
      requestId: requestId || null,
      date: date || null,
      description,
      seller,
      location,
      phone,
      funding,
      noReceipt,
      reason,
      items: fromItemDrafts(items),
    },
    version: expense?.lock_version ?? null,
    paused: submitting,
    persist: (draft, lock) => saveExpense({ ...draft, id: id.current, lock }),
    onSaved: (result) => {
      if (id.current) return;
      id.current = result.id;
      // Reloading now returns to this draft instead of starting another. It stays on the same page,
      // so the form and any upload in progress are kept.
      window.history.replaceState(null, "", `${base}/new?draft=${result.id}`);
    },
  });

  const receipts = files.filter((f) => f.field_key === "vendor_receipt").length;
  const found = checkExpense(
    {
      description,
      date,
      categoryId,
      departmentId,
      seller,
      phone,
      noReceipt,
      reason,
      items,
      receipts,
    },
    today,
  );
  const errors = checked ? found : null;

  async function submit() {
    setChecked(true);
    if (found) return announceProblem("Check the highlighted answers.");
    setSubmitting(true);
    setProblem("");
    try {
      if (!(await save(id.current === null))) return;
      const result = await submitExpense(id.current!, version.current!);
      if (result.ok) {
        toast.success("Expense submitted.");
        router.push(`${base}/${id.current}`);
      } else setProblem(result.message ?? "Something went wrong. Please try again.");
    } catch {
      setProblem("The expense wasn't submitted. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const upload = (kind: FileKind, file: UploadInput) =>
    startExpenseFile({ ...file, expenseId: id.current!, kind });
  const choices = categories.filter((c) => !departmentId || c.departments.includes(departmentId));
  const linkable = requests.filter((r) => !departmentId || r.department_id === departmentId);
  const list = (message?: string) => (message ? [message] : undefined);

  function changeDepartment(next: string) {
    setDepartmentId(next);
    if (!categories.find((c) => c.id === categoryId)?.departments.includes(next)) setCategoryId("");
    if (requests.find((r) => r.id === requestId)?.department_id !== next) setRequestId("");
  }

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
          <fieldset>
            <legend className="mb-3 font-semibold">Receipt</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { value: false, label: "I have a receipt" },
                { value: true, label: "No receipt available" },
              ].map((o) => (
                <label
                  key={o.label}
                  className={cn(
                    "rounded-control has-focus-visible:outline-brand flex min-h-12 cursor-pointer items-center gap-3 border px-4 text-sm font-medium has-focus-visible:outline-2",
                    noReceipt === o.value ? "border-ink ring-ink/10 ring-3" : "border-line",
                  )}
                >
                  <input
                    type="radio"
                    name="receipt"
                    className="accent-brand size-4"
                    checked={noReceipt === o.value}
                    onChange={() => setNoReceipt(o.value)}
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
          {noReceipt ? (
            <>
              <TextArea
                label="Why is there no receipt?"
                name="reason"
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                errors={list(errors?.reason)}
              />
              <div className="space-y-3">
                <SelectField
                  label="Supporting evidence (optional)"
                  name="proof"
                  value={proof}
                  onChange={(e) => setProof(e.target.value as keyof typeof PROOF)}
                >
                  {Object.entries(PROOF).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
                {Object.keys(PROOF)
                  .filter((k) => k === proof || files.some((f) => f.field_key === k))
                  .map((k) => (
                    <FileUploader
                      key={k}
                      label={`Add ${PROOF[k as keyof typeof PROOF].toLowerCase()}`}
                      field={k}
                      files={files}
                      onChange={setFiles}
                      before={() => save(id.current === null)}
                      start={(file) => upload(k as FileKind, file)}
                    />
                  ))}
              </div>
            </>
          ) : null}
          {(!noReceipt || receipts > 0) && (
            <FileUploader
              label="Add receipt"
              field="vendor_receipt"
              files={files}
              onChange={setFiles}
              before={() => save(id.current === null)}
              start={(file) => upload("vendor_receipt", file)}
            />
          )}
          {errors?.receipt && (
            <p role="alert" className="text-brand-strong text-xs font-medium">
              {errors.receipt}
            </p>
          )}
        </Card>

        <Card className="space-y-5 p-6">
          <TextField
            label="What was it for?"
            name="description"
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            errors={list(errors?.description)}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Date of purchase"
              name="date"
              type="date"
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              errors={list(errors?.date)}
            />
            <SelectField
              label="Department"
              name="department"
              value={mine.some((d) => d.id === departmentId) ? departmentId : ""}
              onChange={(e) => changeDepartment(e.target.value)}
              errors={list(errors?.department)}
            >
              <option value="">Choose a department</option>
              {mine.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Category"
              name="category"
              value={choices.some((c) => c.id === categoryId) ? categoryId : ""}
              onChange={(e) => setCategoryId(e.target.value)}
              errors={list(errors?.category)}
            >
              <option value="">Choose a category</option>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Paid with"
              name="funding"
              value={funding}
              onChange={(e) => setFunding(e.target.value as keyof typeof FUNDING)}
              hint={
                funding === "personal"
                  ? "You'll be repaid after the report is approved."
                  : undefined
              }
            >
              {Object.entries(FUNDING).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            {(linkable.length > 0 || requestId) && (
              <SelectField
                label="For a request (optional)"
                name="request"
                value={requestId}
                onChange={(e) => setRequestId(e.target.value)}
              >
                <option value="">Not linked</option>
                {linkable.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number} {r.title}
                  </option>
                ))}
                {requestId && !linkable.some((r) => r.id === requestId) && (
                  <option value={requestId}>
                    {expense?.request?.number ?? "Request"} (no longer available)
                  </option>
                )}
              </SelectField>
            )}
          </div>
        </Card>

        <Card className="space-y-5 p-6">
          <h2 className="font-semibold">Seller</h2>
          <TextField
            label="Seller's name or description"
            name="seller"
            maxLength={120}
            value={seller}
            onChange={(e) => setSeller(e.target.value)}
            errors={list(errors?.seller)}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Location (optional)"
              name="location"
              maxLength={160}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
            <TextField
              label="Phone (optional)"
              name="phone"
              type="tel"
              maxLength={20}
              hint="Leave blank if unknown."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              errors={list(errors?.phone)}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 font-semibold">Items</h2>
          <ItemFields
            items={items}
            onChange={setItems}
            errors={errors?.items}
            currency={currency}
          />
          {errors?.list && (
            <p role="alert" className="text-brand-strong mt-3 text-xs font-medium">
              {errors.list}
            </p>
          )}
        </Card>
      </div>

      <Card className="space-y-5 p-6 lg:sticky lg:top-6">
        <div>
          <p className="text-muted text-sm">Total</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {formatMoney(
              items.reduce((sum, i) => sum + lineTotal(i), 0),
              currency,
            )}
          </p>
        </div>
        <SavePanel
          submit="Submit expense"
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
