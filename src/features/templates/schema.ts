import { z } from "zod";

export const TEMPLATE_KINDS = {
  request: "Request",
  expense_report: "Expense report",
  narrative_report: "Narrative report",
} as const;
export type TemplateKind = keyof typeof TEMPLATE_KINDS;
export const templateKind = z.enum(["request", "expense_report", "narrative_report"]);

export const FIELD_TYPES = {
  short_text: "Short text",
  long_text: "Long text",
  number: "Number",
  money: "Money",
  date: "Date",
  dropdown: "Dropdown",
  checkbox: "Checkbox",
  file: "File",
} as const;
export type FieldType = keyof typeof FIELD_TYPES;

const options = z
  .array(z.string().trim().min(1).max(80))
  .min(2, "Dropdowns need at least two options.")
  .max(50)
  .refine((v) => new Set(v).size === v.length, "Dropdown options must be different.");

export const templateField = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
    label: z.string().trim().min(1, "Every field needs a label.").max(120),
    help: z.string().trim().max(200).optional(),
    type: z.enum(Object.keys(FIELD_TYPES) as [FieldType, ...FieldType[]]),
    required: z.boolean(),
    options: options.optional(),
  })
  .refine((f) => f.type !== "dropdown" || f.options, {
    message: "Dropdowns need at least two options.",
  })
  // Only meaningful values are stored, so an unchanged form doesn't publish a version.
  .transform(({ help, options: list, ...f }) => ({
    ...f,
    ...(help ? { help } : {}),
    ...(f.type === "dropdown" && list ? { options: list } : {}),
  }));
export type TemplateField = z.infer<typeof templateField>;

export const templateFields = z
  .array(templateField)
  .max(40, "A template can have up to 40 fields.")
  .refine((v) => new Set(v.map((f) => f.key)).size === v.length, "Field keys must be different.");
