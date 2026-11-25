import type { TemplateField } from "@/features/templates/schema";
import { isDate } from "@/lib/data-view";
import { parseMoney } from "@/lib/format";

/** What is typed, before it is converted for saving. */
export type Answers = Record<string, string | boolean>;
export type ItemDraft = { key: string; description: string; quantity: string; price: string };

export function parseQuantity(value: string): number | null {
  const text = value.trim().replaceAll(",", "");
  return /^\d{1,6}(\.\d{1,3})?$/.test(text) ? Number(text) : null;
}

/** Matches the database: quantity × price, rounded to the nearest minor unit. */
export function lineTotal(item: Pick<ItemDraft, "quantity" | "price">): number {
  const thousandths = BigInt(Math.round((parseQuantity(item.quantity) ?? 0) * 1000));
  return Number((thousandths * BigInt(parseMoney(item.price) ?? 0) + BigInt(500)) / BigInt(1000));
}

export function toAnswers(fields: TemplateField[], data: Record<string, unknown>): Answers {
  return Object.fromEntries(
    fields.flatMap((f): [string, string | boolean][] => {
      const value = data[f.key];
      if (typeof value === "boolean") return [[f.key, value]];
      if (typeof value === "number")
        return [[f.key, f.type === "money" ? (value / 100).toFixed(2) : String(value)]];
      return typeof value === "string" ? [[f.key, value]] : [];
    }),
  );
}

/** Readable values are stored typed; anything else is kept as text so a draft loses nothing. */
export function fromAnswers(fields: TemplateField[], answers: Answers) {
  const data: Record<string, string | number | boolean> = {};
  for (const f of fields) {
    const value = answers[f.key];
    if (value === undefined || value === "" || f.type === "file") continue;
    if (f.type === "money") data[f.key] = parseMoney(String(value)) ?? value;
    else if (f.type === "number" && /^-?\d{1,15}(\.\d+)?$/.test(String(value).trim()))
      data[f.key] = Number(value);
    else data[f.key] = value;
  }
  return data;
}

function answerError(f: TemplateField, value: string | boolean | undefined, files: number) {
  const blank =
    f.type === "file"
      ? files === 0
      : value === undefined || value === false || !String(value).trim();
  if (blank) return f.required ? (f.type === "file" ? "Add a file." : "This is required.") : null;
  const text = String(value).trim();
  switch (f.type) {
    case "short_text":
      return text.length > 200 ? "Use up to 200 characters." : null;
    case "number":
      return /^-?\d{1,15}(\.\d+)?$/.test(text) ? null : "Enter a number.";
    case "money":
      return parseMoney(text) === null ? "Enter an amount, such as 12,500." : null;
    case "date":
      return isDate(text) ? null : "Enter a date.";
    case "dropdown":
      return f.options?.includes(text) ? null : "Choose an option.";
    default:
      return null;
  }
}

export type DraftErrors = {
  title?: string;
  purpose?: string;
  department?: string;
  items: Record<string, string>;
  answers: Record<string, string>;
};

export function checkDraft(input: {
  title: string;
  purpose: string;
  departmentId: string;
  items: ItemDraft[];
  fields: TemplateField[];
  answers: Answers;
  files: (string | null)[];
}): DraftErrors | null {
  const errors: DraftErrors = { items: {}, answers: {} };
  if (input.title.trim().length < 3) errors.title = "Enter a title of at least 3 characters.";
  if (input.purpose.trim().length < 5) errors.purpose = "Say what this is for.";
  if (!input.departmentId) errors.department = "Choose a department.";
  for (const i of input.items) {
    if (i.description.trim().length < 2) errors.items[i.key] = "Describe this item.";
    else if (!parseQuantity(i.quantity) || parseQuantity(i.quantity)! > 100_000)
      errors.items[i.key] = "Enter a quantity above zero.";
    else if (!parseMoney(i.price) || parseMoney(i.price)! > 100_000_000_000)
      errors.items[i.key] = "Enter a unit price above zero, such as 1,500.";
  }
  for (const f of input.fields) {
    const files = input.files.filter((key) => key === f.key).length;
    const error = answerError(f, input.answers[f.key], files);
    if (error) errors.answers[f.key] = error;
  }
  const clean =
    !errors.title &&
    !errors.purpose &&
    !errors.department &&
    !Object.keys(errors.items).length &&
    !Object.keys(errors.answers).length;
  return clean ? null : errors;
}
