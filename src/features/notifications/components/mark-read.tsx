"use client";

import { useEffect } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { markAllRead, markRequestRead } from "../actions";

/** Opening a request clears its notifications. Runs in the browser so prefetching never does. */
export function MarkRead({ orgId, requestId }: { orgId: string; requestId: string }) {
  useEffect(() => {
    markRequestRead(orgId, requestId).catch(() => {});
  }, [orgId, requestId]);
  return null;
}

export function MarkAllRead({ orgId }: { orgId: string }) {
  return (
    <ActionForm
      action={markAllRead}
      submit="Mark all as read"
      variant="outline"
      className="space-y-2"
    >
      {() => <input type="hidden" name="orgId" value={orgId} />}
    </ActionForm>
  );
}
