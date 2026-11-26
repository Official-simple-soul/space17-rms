import { Term } from "@/components/ui/term";
import { Files } from "@/features/files/components/files";
import type { Attachment } from "@/features/files/schema";
import { formatDate, formatMoney } from "@/lib/format";
import type { TemplateField } from "../schema";

/** Read-only answers to a template's questions, for use inside a definition list. */
export function TemplateAnswers({
  fields,
  data,
  files,
  filesBase,
  currency,
}: {
  fields: TemplateField[];
  data: Record<string, unknown>;
  files: Attachment[];
  filesBase: string;
  currency: string;
}) {
  const answer = (f: TemplateField) => {
    if (f.type === "file") {
      const mine = files.filter((a) => a.field_key === f.key);
      return mine.length ? <Files files={mine} base={filesBase} /> : "—";
    }
    const value = data[f.key];
    if (value === undefined || value === "") return f.type === "checkbox" ? "No" : "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (f.type === "money" && typeof value === "number") return formatMoney(value, currency);
    if (f.type === "date" && typeof value === "string") return formatDate(value);
    return String(value);
  };
  return fields.map((f) => (
    <Term key={f.key} label={f.label}>
      {answer(f)}
    </Term>
  ));
}
