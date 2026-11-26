import { formatSize } from "@/lib/files/types";
import { Thumbnail } from "./thumbnail";
import type { Attachment } from "../schema";

export function Files({ files, base }: { files: Attachment[]; base: string }) {
  return (
    <ul className="space-y-2">
      {files.map((f) => (
        <li key={f.id}>
          <a
            href={`${base}/${f.id}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-control border-line flex min-h-11 items-center gap-3 border px-3 py-2 text-sm hover:border-black"
          >
            <Thumbnail src={`${base}/${f.id}`} mime={f.mime} />
            <span className="min-w-0 flex-1 truncate">{f.name}</span>
            <span className="text-muted shrink-0 text-xs">{formatSize(f.size)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
