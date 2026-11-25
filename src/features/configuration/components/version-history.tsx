import { FormDialog } from "@/components/ui/form-dialog";
import { Card } from "@/components/ui/surface";
import { formatDate } from "@/lib/format";

/** Published versions, newest first. Each can be opened but never changed. */
export function VersionHistory({
  versions,
}: {
  versions: { version: number; publishedAt: string; content: React.ReactNode }[];
}) {
  return (
    <Card className="p-6">
      <h2 className="mb-3 text-sm font-semibold">Version history</h2>
      <ul className="divide-line divide-y">
        {versions.map((v, i) => (
          <li key={v.version} className="flex items-center justify-between gap-3 py-3 text-sm">
            <span>
              Version {v.version}
              <span className="text-muted block text-xs">
                {formatDate(v.publishedAt)}
                {i === 0 && " · Current"}
              </span>
            </span>
            <FormDialog
              label="View"
              ariaLabel={`View version ${v.version}`}
              title={`Version ${v.version}`}
              variant="outline"
              size="sm"
            >
              {v.content}
            </FormDialog>
          </li>
        ))}
      </ul>
    </Card>
  );
}
