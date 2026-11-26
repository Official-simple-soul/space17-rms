"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  name: string;
  length?: number;
  errors?: string[];
  hint?: string;
  /** Sends the form as soon as every digit is in. */
  autoSubmit?: boolean;
  /** A new value each time the code is rejected, such as the form's result. */
  rejection?: object;
};

/**
 * A one-time code shown as separate boxes. One real input sits on top, so paste,
 * SMS autofill and password managers work as usual.
 */
export function CodeField({
  label,
  name,
  length = 6,
  errors,
  hint,
  autoSubmit = true,
  rejection,
}: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const sent = useRef("");
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const failure = rejection ?? (errors?.length ? errors : undefined);
  const invalid = Boolean(failure);
  const half = Math.ceil(length / 2);

  // A rejected code shakes the boxes and is selected, ready to type over.
  const [seen, setSeen] = useState(failure);
  if (failure !== seen) {
    setSeen(failure);
    if (failure) setAttempt((n) => n + 1);
  }
  useEffect(() => {
    if (!failure) return;
    sent.current = "";
    input.current?.focus();
    input.current?.select();
  }, [failure]);

  function change(raw: string) {
    const next = raw.replace(/\D/g, "").slice(0, length);
    setValue(next);
    if (autoSubmit && next.length === length && sent.current !== next) {
      sent.current = next;
      requestAnimationFrame(() => input.current?.form?.requestSubmit());
    }
  }

  // The caret always sits at the end; boxes are filled in order.
  const toEnd = () => {
    const field = input.current;
    if (field && field.selectionStart === field.selectionEnd)
      field.setSelectionRange(field.value.length, field.value.length);
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <div
          key={attempt}
          aria-hidden
          className={cn("flex items-center gap-1.5 sm:gap-2", attempt > 0 && "animate-shake")}
        >
          {Array.from({ length }, (_, i) => {
            const digit = value[i];
            const active = focused && (i === value.length || (i === length - 1 && !!digit));
            return (
              <Fragment key={i}>
                {i === half && <span className="bg-ink/15 h-0.5 w-2.5 shrink-0 rounded-full" />}
                <div
                  className={cn(
                    "grid h-13 min-w-0 flex-1 place-items-center rounded-xl border text-xl font-semibold tabular-nums shadow-[inset_0_1px_2px_rgb(10_10_10/0.04)] transition-all duration-200 ease-(--ease-out-soft)",
                    active
                      ? "border-brand/60 ring-brand/10 -translate-y-0.5 bg-white ring-4"
                      : digit
                        ? "border-ink/20 bg-white/90"
                        : "border-ink/10 bg-white/60",
                    invalid && !active && "border-brand/50",
                  )}
                >
                  {digit ? (
                    <span className="animate-digit">{digit}</span>
                  ) : (
                    active && <span className="bg-brand animate-caret h-6 w-0.5 rounded-full" />
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
        <input
          ref={input}
          id={id}
          name={name}
          value={value}
          onChange={(event) => change(event.target.value)}
          onFocus={() => {
            setFocused(true);
            requestAnimationFrame(toEnd);
          }}
          onBlur={() => setFocused(false)}
          onClick={toEnd}
          onKeyUp={toEnd}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d*"
          maxLength={length}
          autoFocus
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={errors?.length || hint ? `${id}-hint` : undefined}
          className="absolute inset-0 size-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
        />
      </div>
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
