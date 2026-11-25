"use client";

import { AlertDialog } from "radix-ui";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action-state";
import { ConfirmDialog } from "./alert-dialog";
import { Button, buttonStyles } from "./button";
import { useCloseDialog } from "./form-dialog";
import { Notice } from "./surface";

type Action = (state: ActionState, data: FormData) => Promise<ActionState>;

type Props = {
  action: Action;
  submit: string;
  variant?: "primary" | "brand" | "outline" | "danger";
  className?: string;
  fullWidth?: boolean;
  /** Ask before submitting. */
  confirm?: { title: string; description?: string };
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
  const [held, setHeld] = useState<FormData | null>(null);
  const close = useCloseDialog();
  const handled = useRef(state);
  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    if (!state.ok || !closeOnSuccess) return;
    if (state.message) toast.success(state.message);
    close?.();
  }, [state, close, closeOnSuccess]);
  const send = (data: FormData) => startTransition(() => dispatch(data));
  return (
    <form
      className={className ?? "space-y-5"}
      noValidate
      // Submitting manually keeps typed values when validation fails.
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        if (confirm) setHeld(data);
        else send(data);
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
      {confirm && (
        <ConfirmDialog
          open={held !== null}
          onOpenChange={(open) => !open && setHeld(null)}
          {...confirm}
        >
          <AlertDialog.Action
            type="button"
            className={buttonStyles({ variant: "brand" })}
            onClick={() => held && send(held)}
          >
            {submit}
          </AlertDialog.Action>
        </ConfirmDialog>
      )}
    </form>
  );
}
