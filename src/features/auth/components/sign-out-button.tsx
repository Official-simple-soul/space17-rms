"use client";

import { LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { ConfirmDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { signOut } from "../actions";

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="brand" loading={pending}>
      Sign out
    </Button>
  );
}

export function SignOutButton({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <ConfirmDialog
      title="Sign out?"
      description="You'll need to sign in again to continue."
      trigger={
        <Button
          type="button"
          variant="brand"
          size={compact ? "icon" : "md"}
          className={className}
          aria-label={compact ? "Sign out" : undefined}
        >
          <LogOut className="size-4" aria-hidden />
          {!compact && "Sign out"}
        </Button>
      }
    >
      <form action={signOut}>
        <ConfirmButton />
      </form>
    </ConfirmDialog>
  );
}
