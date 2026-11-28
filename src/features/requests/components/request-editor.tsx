"use client";

import {
  Banknote,
  ChevronDown,
  Package,
  TriangleAlert,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { SelectField, TextArea, TextField } from "@/components/ui/field";
import { ItemFields } from "@/components/ui/item-fields";
import { announceProblem, SavePanel } from "@/components/ui/save-panel";
import { Card } from "@/components/ui/surface";
import { FileUploader } from "@/features/files/components/file-uploader";
import type { UploadInput } from "@/features/files/schema";
import { formatMoney } from "@/lib/format";
import {
  blankItem,
  fromItemDrafts,
  lineTotal,
  toItemDrafts,
  type ItemDraft,
} from "@/lib/line-items";
import { uid } from "@/lib/uid";
import { cn } from "@/lib/utils";
import { useAutosave } from "@/lib/use-autosave";
import { saveDraft, startUpload, submitRequest } from "../actions";
import { checkDraft, type DraftErrors } from "../form";
import {
  PROVISIONS,
  type Draft,
  type Provision,
  type RequestDetail,
  type RequestOptions,
} from "../schema";

type Props = {
  orgId: string;
  base: string;
  currency: string;
  /** Null until the first save of a new request. */
  request: RequestDetail | null;
  options: RequestOptions;
};

const SINGLE = "single";

/** One amount is enough for most requests; a breakdown is there for those who want it. */
function startingItems(request: RequestDetail | null) {
  const items = toItemDrafts(request?.items ?? []);
  const single = items.length === 0 || (items.length === 1 && Number(items[0].quantity) === 1);
  return { itemised: !single, items, amount: single ? (items[0]?.price ?? "") : "" };
}

function joinNames(names: string[]) {
  if (names.length <= 2) return names.join(" or ");
  return `${names.slice(0, 2).join(", ")} or ${names.length - 2} other${names.length > 3 ? "s" : ""}`;
}

export function RequestEditor({ orgId, base, currency, request, options }: Props) {
  const router = useRouter();
  const departments = options.departments;
  const start = useState(() => startingItems(request))[0];
  const [title, setTitle] = useState(request?.title ?? "");
  const [purpose, setPurpose] = useState(request?.purpose ?? "");
  const [departmentId, setDepartmentId] = useState(
    request?.department?.id ?? (departments.length === 1 ? departments[0].id : ""),
  );
  const [categoryId, setCategoryId] = useState(request?.category?.id ?? "");
  const [neededBy, setNeededBy] = useState(request?.needed_by ?? "");
  const [supplier, setSupplier] = useState(request?.supplier ?? "");
  const [provision, setProvision] = useState<Provision | "">(request?.provision ?? "");
  const [itemised, setItemised] = useState(start.itemised);
  const [amount, setAmount] = useState(start.amount);
  const [list, setList] = useState<ItemDraft[]>(start.items);
  const [files, setFiles] = useState(request?.attachments ?? []);
  const [saved, setSaved] = useState(Boolean(request));
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // With one amount, the request itself is the only item.
  const items: ItemDraft[] = itemised
    ? list
    : amount.trim()
      ? [{ key: SINGLE, description: title.trim(), quantity: "1", price: amount }]
      : [];
  const content: Omit<Draft, "lock" | "id"> = {
    orgId,
    departmentId: departmentId || null,
    categoryId: categoryId || null,
    title,
    purpose,
    neededBy: neededBy || null,
    supplier,
    provision: provision || null,
    items: fromItemDrafts(items),
  };
  const id = useRef(request?.id ?? null);
  const { save, status, dirty, problem, setProblem, version } = useAutosave({
    content,
    version: request?.lock_version ?? null,
    // Nothing is stored until there is something to keep.
    paused: submitting || (!saved && !title.trim()),
    persist: (draft, lock) => saveDraft({ ...draft, id: id.current, lock }),
    onSaved: (result) => {
      if (id.current) return;
      id.current = result.id;
      setSaved(true);
      // Reloading now returns to this draft; staying on the page keeps what has been typed.
      router.replace(`${base}/new?draft=${result.id}`, { scroll: false });
    },
  });

  const found = checkDraft({ title, purpose, provision, departmentId, items, itemised });
  // After the first attempt, each error clears as soon as it is corrected.
  const errors: DraftErrors | null = checked ? found : null;
  const department = departments.find((d) => d.id === departmentId);
  const nobody = department && department.approvers.length === 0;

  async function submit() {
    setChecked(true);
    if (found) return announceProblem("Check the highlighted answers.");
    setSubmitting(true);
    setProblem("");
    try {
      if (!(await save())) return;
      const result = await submitRequest(id.current!, version.current!);
      if (result.ok) {
        toast.success("Request sent.");
        router.push(`${base}/${id.current}`);
      } else {
        setProblem(result.message ?? "Something went wrong. Please try again.");
        router.refresh();
      }
    } catch {
      setProblem("The request wasn't sent. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function listSeparately() {
    // Starts with one row, carrying over what was typed.
    setList(
      items.length
        ? items.map((i) => ({ ...i, key: uid() }))
        : [{ ...blankItem(), description: title.trim() }],
    );
    setItemised(true);
  }

  function useOneAmount() {
    const total = list.reduce((sum, i) => sum + lineTotal(i), 0);
    setAmount(total ? (total / 100).toFixed(2) : "");
    setItemised(false);
  }

  const total = items.reduce((sum, i) => sum + lineTotal(i), 0);
  const upload = (field: string | null, file: UploadInput) =>
    startUpload({ ...file, requestId: id.current!, field });
  // Files need a draft to belong to, so the first one saves it.
  const beforeUpload = async () => (title.trim() ? save() : false);
  const one = (message?: string) => (message ? [message] : undefined);
  const extrasUsed = Boolean(categoryId || neededBy || supplier || files.some((f) => f.field_key));

  if (!departments.length && !request)
    return (
      <Card className="p-6 text-sm">
        You&apos;re not in a department yet, so you can&apos;t ask for anything. Ask an admin to add
        you to one.
      </Card>
    );

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
            label="What do you need?"
            name="title"
            maxLength={120}
            placeholder="For example, rice for the kitchen"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            errors={one(errors?.title)}
          />
          <TextArea
            label="Why do you need it?"
            name="purpose"
            maxLength={2000}
            className="min-h-20"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            errors={one(errors?.purpose)}
          />
          <ProvisionChoice value={provision} onChange={setProvision} error={errors?.provision} />
          {itemised ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">{AMOUNT[provision || "money"].list}</p>
              <ItemFields
                items={list}
                onChange={setList}
                errors={errors?.items}
                currency={currency}
              />
              {errors?.amount && (
                <p role="alert" className="text-brand-strong text-xs font-medium">
                  {errors.amount}
                </p>
              )}
              {list.length <= 1 && (
                <button
                  type="button"
                  onClick={useOneAmount}
                  className="text-sm font-medium underline"
                >
                  Use one amount instead
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <TextField
                label={AMOUNT[provision || "money"].label}
                name="amount"
                inputMode="decimal"
                placeholder="For example, 25,000"
                hint={AMOUNT[provision || "money"].hint}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                errors={one(errors?.amount)}
              />
              <button type="button" onClick={listSeparately} className="text-sm underline">
                List items separately
              </button>
            </div>
          )}
          {departments.length > 1 && (
            <SelectField
              label="Which department is this for?"
              name="department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              errors={one(errors?.department)}
            >
              <option value="">Choose a department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </SelectField>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold">Add a photo (optional)</h2>
          <p className="text-muted mt-1 mb-4 text-sm">
            Anything that helps, such as a photo of what is broken or a list.
          </p>
          <FileUploader
            start={(file) => upload(null, file)}
            label="Add photo or file"
            files={files}
            onChange={setFiles}
            before={beforeUpload}
          />
          {!title.trim() && (
            <p className="text-muted mt-2 text-xs">Say what you need first, then add files.</p>
          )}
        </Card>

        <details open={extrasUsed} className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <ChevronDown
              className="size-4 transition-transform group-open:rotate-180"
              aria-hidden
            />
            More options
          </summary>
          <Card className="mt-4 space-y-5 p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Needed by"
                name="neededBy"
                type="date"
                value={neededBy}
                onChange={(e) => setNeededBy(e.target.value)}
              />
              {options.categories.length > 0 && (
                <SelectField
                  label="Category"
                  name="category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="">None</option>
                  {options.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  {request?.category &&
                    !options.categories.some((c) => c.id === request.category!.id) && (
                      <option value={request.category.id}>
                        {request.category.name} (no longer used)
                      </option>
                    )}
                </SelectField>
              )}
            </div>
            <TextField
              label="Where to buy it"
              name="supplier"
              maxLength={120}
              hint="A shop or seller, if you have one in mind."
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
            <div>
              <p className="text-sm font-medium">Quotation</p>
              <p className="text-muted mt-1 mb-3 text-xs">
                The seller&apos;s price, such as a quote or proforma invoice. A photo is fine.
              </p>
              <FileUploader
                start={(file) => upload("quotation", file)}
                field="quotation"
                label="Add quotation"
                files={files}
                onChange={setFiles}
                before={beforeUpload}
              />
            </div>
          </Card>
        </details>
      </div>

      <Card className="space-y-5 p-6 lg:sticky lg:top-6">
        <div>
          <p className="text-muted text-sm">Total</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
            {formatMoney(total, currency)}
          </p>
        </div>
        {department &&
          (nobody ? (
            <p className="text-brand-strong flex gap-2 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              No one can approve requests for {department.name} yet. Ask an admin to choose a head
              for it.
            </p>
          ) : (
            <p className="flex gap-2 text-sm">
              <UserCheck className="text-muted mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="font-medium">{joinNames(department.approvers)}</span> will approve
                this.
              </span>
            </p>
          ))}
        <SavePanel
          submit="Send request"
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

const AMOUNT = {
  money: {
    label: "How much do you need?",
    list: "What will it cost?",
    hint: "Your best guess is fine.",
  },
  provide: {
    label: "Roughly what does it cost? (optional)",
    list: "What does it cost? (optional)",
    hint: "Helps whoever approves it. Leave empty if you don't know.",
  },
} as const;

const ICONS: Record<Provision, LucideIcon> = {
  provide: Package,
  money: Banknote,
};

/** How the request should be met, as three large choices. */
function ProvisionChoice({
  value,
  onChange,
  error,
}: {
  value: Provision | "";
  onChange: (value: Provision) => void;
  error?: string;
}) {
  return (
    <fieldset className="space-y-2" aria-invalid={error ? true : undefined}>
      <legend className="mb-1.5 text-sm font-medium">How should we get it to you?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(Object.keys(PROVISIONS) as Provision[]).map((key) => {
          const Icon = ICONS[key];
          const chosen = value === key;
          return (
            <label
              key={key}
              className={cn(
                "rounded-control flex cursor-pointer gap-3 border p-3 transition-all duration-200 sm:flex-col sm:gap-2",
                chosen
                  ? "border-brand/50 ring-brand/10 bg-white ring-4"
                  : "border-ink/10 hover:border-ink/20 bg-white/60 hover:bg-white/80",
              )}
            >
              <input
                type="radio"
                name="provision"
                value={key}
                checked={chosen}
                onChange={() => onChange(key)}
                className="sr-only"
              />
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-xl transition-colors",
                  chosen ? "bg-brand text-white" : "bg-ink/[0.05] text-muted",
                )}
              >
                <Icon className="size-4.5" aria-hidden />
              </span>
              <span>
                <span className="block text-sm font-medium">{PROVISIONS[key].label}</span>
                <span className="text-muted block text-xs">{PROVISIONS[key].hint}</span>
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-brand-strong text-xs font-medium">
          {error}
        </p>
      )}
    </fieldset>
  );
}
