"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Password box with an animated show/hide eye. Hides again when the form is sent. */
export function PasswordInput({ className, ...props }: ComponentProps<"input">) {
  const [shown, setShown] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = input.current?.form;
    if (!form) return;
    const hide = () => setShown(false);
    form.addEventListener("submit", hide);
    return () => form.removeEventListener("submit", hide);
  }, []);

  function toggle() {
    const field = input.current;
    const caret = field?.selectionStart ?? null;
    setShown((value) => !value);
    // Keep typing where you left off.
    requestAnimationFrame(() => {
      if (!field || caret === null) return;
      field.focus();
      field.setSelectionRange(caret, caret);
    });
  }

  return (
    <div className="relative">
      <input
        ref={input}
        {...props}
        type={shown ? "text" : "password"}
        className={cn(className, "pr-12")}
      />
      <button
        type="button"
        onClick={toggle}
        onMouseDown={(event) => event.preventDefault()}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        aria-controls={props.id}
        title={shown ? "Hide password" : "Show password"}
        disabled={props.disabled}
        data-shown={shown || undefined}
        className="group text-muted hover:text-ink hover:bg-ink/[0.05] data-shown:text-brand absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-lg transition-[color,background-color,transform] duration-200 active:scale-90"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-5 overflow-visible"
          aria-hidden
        >
          {/* Lids open a little wider when the password is visible. */}
          <path
            d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z"
            className="origin-center transition-transform duration-300 ease-(--ease-spring) [transform-box:fill-box] group-data-shown:scale-y-110"
          />
          <circle
            cx="12"
            cy="12"
            r="3"
            className="origin-center scale-50 transition-transform duration-300 ease-(--ease-spring) [transform-box:fill-box] group-hover:scale-75 group-data-shown:scale-100 group-data-shown:fill-current/15"
          />
          {/* The slash draws away as the eye opens. */}
          <path
            d="M4 4l16 16"
            pathLength={1}
            strokeDasharray="1"
            className="transition-[stroke-dashoffset] duration-300 ease-(--ease-out-soft) group-data-shown:[stroke-dashoffset:1]"
          />
        </svg>
      </button>
    </div>
  );
}
