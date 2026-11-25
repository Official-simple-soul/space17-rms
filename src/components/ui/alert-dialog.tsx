"use client";

import { AlertDialog as Primitive } from "radix-ui";
import { buttonStyles } from "./button";

type Props = {
  trigger: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
};

/** Accessible confirmation. Pass the confirming control as children. */
export function ConfirmDialog({ trigger, title, description, children }: Props) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-40 bg-black/50" />
        <Primitive.Content className="rounded-card border-line bg-surface text-ink fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 border p-6 text-left shadow-xl">
          <Primitive.Title className="text-lg font-semibold">{title}</Primitive.Title>
          <Primitive.Description className="text-muted mt-2 text-sm">
            {description}
          </Primitive.Description>
          <div className="mt-6 flex justify-end gap-3">
            <Primitive.Cancel className={buttonStyles({ variant: "outline" })}>
              Cancel
            </Primitive.Cancel>
            {children}
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
