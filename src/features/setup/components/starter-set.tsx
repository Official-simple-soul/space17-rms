"use client";

import { ActionForm } from "@/components/ui/action-form";
import { Card } from "@/components/ui/surface";
import { addStarterConfiguration } from "../actions";

export function StarterSet({ orgId }: { orgId: string }) {
  return (
    <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="max-w-xl">
        <h2 className="font-semibold">Start with common categories</h2>
        <p className="text-muted mt-1 text-sm">
          Adds Food and kitchen, Repairs and maintenance, Transport, Supplies, Health, School and
          learning, and Other. You can rename or archive any of them.
        </p>
      </div>
      <ActionForm
        action={addStarterConfiguration}
        submit="Add these"
        variant="outline"
        className="space-y-3"
      >
        {() => <input type="hidden" name="orgId" value={orgId} />}
      </ActionForm>
    </Card>
  );
}
