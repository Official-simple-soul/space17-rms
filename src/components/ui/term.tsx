import { cn } from "@/lib/utils";

/** A labelled value inside a definition list. */
export function Term({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-muted text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm break-words whitespace-pre-wrap">{children}</dd>
    </div>
  );
}
