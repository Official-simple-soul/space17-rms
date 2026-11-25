import { SelectField, TextArea, TextField } from "@/components/ui/field";
import type { TemplateField } from "../schema";

/** Renders a template's fields. Also used to preview them while editing. */
export function TemplateFields({
  fields,
  disabled,
}: {
  fields: TemplateField[];
  disabled?: boolean;
}) {
  if (!fields.length) return <p className="text-muted text-sm">No extra fields.</p>;
  return (
    <fieldset disabled={disabled} className="space-y-5">
      {fields.map((f) => {
        const label = `${f.label || "Untitled field"}${f.required ? " *" : ""}`;
        const base = { label, name: `field:${f.key}`, hint: f.help, required: f.required };
        if (f.type === "long_text") return <TextArea key={f.key} {...base} />;
        if (f.type === "dropdown")
          return (
            <SelectField key={f.key} {...base} defaultValue="">
              <option value="">Choose…</option>
              {f.options?.map((o, i) => (
                <option key={i} value={o}>
                  {o}
                </option>
              ))}
            </SelectField>
          );
        if (f.type === "checkbox")
          return (
            <label key={f.key} className="flex items-start gap-3 text-sm">
              <input type="checkbox" name={base.name} className="accent-brand mt-0.5 size-4" />
              <span>
                <span className="font-medium">{label}</span>
                {f.help && <span className="text-muted block text-xs">{f.help}</span>}
              </span>
            </label>
          );
        return (
          <TextField
            key={f.key}
            {...base}
            type={f.type === "date" || f.type === "file" ? f.type : "text"}
            inputMode={f.type === "number" || f.type === "money" ? "decimal" : undefined}
            className={f.type === "file" ? "py-2" : undefined}
          />
        );
      })}
    </fieldset>
  );
}
