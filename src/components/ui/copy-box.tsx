"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./button";

/** Text shown once, with a button to copy it. */
export function CopyBox({
  label,
  text,
  hint,
  testId,
}: {
  label: string;
  text: string;
  hint: string;
  testId?: string;
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied.");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it yourself.");
    }
  }
  return (
    <div className="rounded-control border-line border p-3">
      <p className="text-sm font-medium">{label}</p>
      <pre
        className="mt-1.5 max-h-40 overflow-auto text-xs break-all whitespace-pre-wrap"
        data-testid={testId}
      >
        {text}
      </pre>
      <p className="text-muted mt-2 text-xs">{hint}</p>
      <Button type="button" size="sm" variant="outline" className="mt-3" onClick={copy}>
        <Copy className="size-4" aria-hidden />
        Copy
      </Button>
    </div>
  );
}
