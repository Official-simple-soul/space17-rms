"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action-state";
import { Button } from "./button";
import { useCloseDialog } from "./form-dialog";
import { Notice } from "./surface";

type Action = (state: ActionState, data: FormData) => Promise<ActionState>;

type Props = {
  action: Action;
  submit: string;
  variant?: "primary" | "brand" | "outline" | "danger";
  className?: string;
  fullWidth?: boolean;
  confirm?: string;
  /** Inside a side panel: close it and show the message as a toast. */
  closeOnSuccess?: boolean;
  size?: "sm" | "md";
  children?: (state: ActionState) => React.ReactNode;
};

/** Standard server-action form: pending state, errors and success message. */
export function ActionForm({
  action,
  submit,
  variant = "primary",
  className,
  fullWidth,
  confirm,
  closeOnSuccess,
  size,
  children,
}: Props) {
  const [state, dispatch, pending] = useActionState(action, {});
  const close = useCloseDialog();
  const handled = useRef(state);
  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    if (!state.ok || !closeOnSuccess) return;
    if (state.message) toast.success(state.message);
    close?.();
  }, [state, close, closeOnSuccess]);
  return (
    <form
      className={className ?? "space-y-5"}
      noValidate
      // Submitting manually keeps typed values when validation fails.
      onSubmit={(event) => {
        event.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const data = new FormData(event.currentTarget);
        startTransition(() => dispatch(data));
      }}
    >
      {state.message && <Notice tone={state.ok ? "neutral" : "alert"}>{state.message}</Notice>}
      {children?.(state)}
      <Button
        type="submit"
        variant={variant}
        size={size}
        loading={pending}
        className={fullWidth ? "w-full" : undefined}
      >
        {submit}
      </Button>
    </form>
  );
}
