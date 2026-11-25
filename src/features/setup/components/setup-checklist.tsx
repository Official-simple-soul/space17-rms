import { Check, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/surface";

type Step = { label: string; done: boolean; href: string };

export function SetupChecklist({ steps }: { steps: Step[] }) {
  return (
    <Card className="mt-6">
      <div className="border-line border-b p-5">
        <h2 className="font-semibold">Set up your organisation</h2>
        <p className="text-muted mt-1 text-sm">
          {steps.filter((s) => s.done).length} of {steps.length} complete
        </p>
      </div>
      <ol className="divide-line divide-y">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-center gap-4 px-5 py-4 text-sm">
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${step.done ? "bg-ink text-white" : "border-line border"}`}
            >
              {step.done ? <Check className="size-4" aria-label="Done" /> : i + 1}
            </span>
            <span className={`flex-1 ${step.done ? "text-muted" : "font-medium"}`}>
              {step.label}
            </span>
            {!step.done && (
              <Link href={step.href} className="text-brand font-medium">
                Start<span className="sr-only">: {step.label}</span>
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

const SHOWN = 8;

export function SetupWarnings({ warnings }: { warnings: { text: string; href: string }[] }) {
  if (!warnings.length) return null;
  return (
    <Card className="mt-6">
      <div className="border-line flex items-center gap-3 border-b p-5">
        <TriangleAlert className="text-brand size-5" aria-hidden />
        <h2 className="font-semibold">
          {warnings.length} {warnings.length === 1 ? "thing needs" : "things need"} attention
        </h2>
      </div>
      <ul className="divide-line divide-y">
        {warnings.slice(0, SHOWN).map((w) => (
          <li key={w.text} className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
            <span>{w.text}</span>
            <Link href={w.href} className="text-brand shrink-0 font-medium">
              Fix<span className="sr-only">: {w.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      {warnings.length > SHOWN && (
        <p className="text-muted border-line border-t px-5 py-3 text-sm">
          And {warnings.length - SHOWN} more. They&apos;ll appear as you fix these.
        </p>
      )}
    </Card>
  );
}
