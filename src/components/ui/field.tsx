import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { PasswordInput } from "./password-input";

const control =
  "w-full rounded-control border border-ink/10 bg-white/70 px-3.5 text-base shadow-[inset_0_1px_2px_rgb(10_10_10/0.04)] outline-none transition duration-200 placeholder:text-neutral-400 hover:border-ink/20 focus:border-brand/50 focus:bg-white focus:ring-4 focus:ring-brand/10 aria-invalid:border-brand sm:text-sm";

type Base = { label: string; name: string; hint?: string; errors?: string[] };
type FieldProps<T extends "input" | "textarea" | "select"> = Base &
  Omit<ComponentProps<T>, "name" | "id">;

function Wrapper({
  id,
  label,
  hint,
  errors,
  children,
}: Base & { id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {errors?.length ? (
        <p id={`${id}-hint`} role="alert" className="text-brand-strong text-xs font-medium">
          {errors[0]}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-muted text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function controlProps(id: string, { name, hint, errors }: Base) {
  return {
    id,
    name,
    "aria-invalid": errors?.length ? true : undefined,
    "aria-describedby": hint || errors?.length ? `${id}-hint` : undefined,
  };
}

export function TextField({ label, name, hint, errors, className, ...props }: FieldProps<"input">) {
  const base = { label, name, hint, errors };
  const id = useId();
  return (
    <Wrapper id={id} {...base}>
      {props.type === "password" ? (
        <PasswordInput
          className={cn(control, "h-11", className)}
          {...controlProps(id, base)}
          {...props}
        />
      ) : (
        <input className={cn(control, "h-11", className)} {...controlProps(id, base)} {...props} />
      )}
    </Wrapper>
  );
}

export function TextArea({
  label,
  name,
  hint,
  errors,
  className,
  ...props
}: FieldProps<"textarea">) {
  const base = { label, name, hint, errors };
  const id = useId();
  return (
    <Wrapper id={id} {...base}>
      <textarea
        className={cn(control, "min-h-24 py-2.5", className)}
        {...controlProps(id, base)}
        {...props}
      />
    </Wrapper>
  );
}

export function SelectField({
  label,
  name,
  hint,
  errors,
  className,
  children,
  ...props
}: FieldProps<"select">) {
  const base = { label, name, hint, errors };
  const id = useId();
  return (
    <Wrapper id={id} {...base}>
      <select className={cn(control, "h-11", className)} {...controlProps(id, base)} {...props}>
        {children}
      </select>
    </Wrapper>
  );
}
