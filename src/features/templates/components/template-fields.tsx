import { SelectField, TextArea, TextField } from "@/components/ui/field";
import type { TemplateField } from "../schema";

type Controls = {
  values: Record<string, string | boolean>;
  errors: Record<string, string>;
  onChange: (key: string, value: string | boolean) => void;
  renderFile: (field: TemplateField) => React.ReactNode;
};

/** Renders a template's fields. Without controls it is a preview. */
export function TemplateFields({
  fields,
  disabled,
  controls,
}: {
  fields: TemplateField[];
  disabled?: boolean;
  controls?: Controls;
}) {
  if (!fields.length) return <p className="text-muted text-sm">No extra fields.</p>;
  return (
    <fieldset disabled={disabled} className="space-y-5">
      {fields.map((f) => {
        const label = `${f.label || "Untitled field"}${f.required ? " *" : ""}`;
        const error = controls?.errors[f.key];
        const base = {
          label,
          name: `field:${f.key}`,
          hint: f.help,
          errors: error ? [error] : undefined,
          "aria-required": f.required,
        };
        const control = controls && {
          value: String(controls.values[f.key] ?? ""),
          onChange: (e: { target: { value: string } }) => controls.onChange(f.key, e.target.value),
        };
        if (f.type === "file" && controls)
          return (
            <div key={f.key} role="group" aria-label={label} className="space-y-1.5">
              <p className="text-sm font-medium">{label}</p>
              {f.help && <p className="text-muted text-xs">{f.help}</p>}
              {controls.renderFile(f)}
              {error && (
                <p role="alert" className="text-brand-strong text-xs font-medium">
                  {error}
                </p>
              )}
            </div>
          );
        if (f.type === "long_text")
          return <TextArea key={f.key} {...base} maxLength={5000} {...control} />;
        if (f.type === "dropdown")
          return (
            <SelectField key={f.key} {...base} {...(control ?? { defaultValue: "" })}>
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
            <div key={f.key}>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name={base.name}
                  className="accent-brand mt-0.5 size-4"
                  {...(controls && {
                    checked: controls.values[f.key] === true,
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                      controls.onChange(f.key, e.target.checked),
                  })}
                />
                <span>
                  <span className="font-medium">{label}</span>
                  {f.help && <span className="text-muted block text-xs">{f.help}</span>}
                </span>
              </label>
              {error && (
                <p role="alert" className="text-brand-strong mt-1 text-xs font-medium">
                  {error}
                </p>
              )}
            </div>
          );
        return (
          <TextField
            key={f.key}
            {...base}
            type={f.type === "date" || f.type === "file" ? f.type : "text"}
            inputMode={f.type === "number" || f.type === "money" ? "decimal" : undefined}
            maxLength={f.type === "short_text" ? 200 : undefined}
            className={f.type === "file" ? "py-2" : undefined}
            {...(f.type === "file" ? {} : control)}
          />
        );
      })}
    </fieldset>
  );
}
