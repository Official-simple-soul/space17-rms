import { isDate } from "@/lib/data-view";
import { parseMoney } from "@/lib/format";
import type { TemplateField } from "./schema";

/** Answers as typed, before they are converted for saving. */
export type Answers = Record<string, string | boolean>;

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

/** One message per question that still needs attention. `files` holds the field of each uploaded file. */
export function answerErrors(
  fields: TemplateField[],
  answers: Answers,
  files: (string | null)[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const error = answerError(f, answers[f.key], files.filter((key) => key === f.key).length);
    if (error) errors[f.key] = error;
  }
  return errors;
}
