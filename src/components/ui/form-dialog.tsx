"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { createContext, useContext, useState } from "react";
import { Button } from "./button";

const CloseContext = createContext<(() => void) | null>(null);
export const useCloseDialog = () => useContext(CloseContext);

type Props = {
  label: React.ReactNode;
  title: string;
  description?: string;
  variant?: "primary" | "brand" | "outline";
  size?: "sm" | "md";
  ariaLabel?: string;
  children: React.ReactNode;
};

/** A button that opens a side panel holding a form. */
export function FormDialog({
  label,
  title,
  description,
  variant = "primary",
  size,
  ariaLabel,
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant={variant} size={size} aria-label={ariaLabel}>
          {label}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className="bg-surface fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col text-left shadow-xl"
        >
          <header className="border-line flex items-start justify-between gap-4 border-b p-5">
            <div>
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="text-muted mt-1 text-sm">
                  {description}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="rounded-control grid size-9 shrink-0 place-items-center hover:bg-neutral-100"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </header>
          <div className="flex-1 overflow-y-auto p-5">
            <CloseContext.Provider value={() => setOpen(false)}>{children}</CloseContext.Provider>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
