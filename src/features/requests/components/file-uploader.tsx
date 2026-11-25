"use client";

import { Paperclip, RotateCw, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { compressImage } from "@/lib/files/compress";
import { ACCEPT, formatSize } from "@/lib/files/types";
import { cn } from "@/lib/utils";
import { finishUpload, removeUpload, startUpload } from "../actions";
import type { Attachment } from "../schema";

type Upload = { key: string; file: File; error?: string };

export function FileUploader({
  requestId,
  field = null,
  label,
  files,
  onChange,
  before,
}: {
  requestId: string;
  field?: string | null;
  label: string;
  files: Attachment[];
  onChange: (update: (list: Attachment[]) => Attachment[]) => void;
  /** Runs first, so the draft the file belongs to is saved. */
  before: () => Promise<boolean>;
}) {
  const id = useId();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState("");
  const mine = files.filter((f) => f.field_key === field);

  async function send(key: string, original: File) {
    const fail = (message: string) =>
      setUploads((list) => list.map((u) => (u.key === key ? { ...u, error: message } : u)));
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, error: undefined } : u)));
    try {
      if (!(await before())) return fail("Save the request first, then retry.");
      const file = await compressImage(original);
      const started = await startUpload({
        requestId,
        field,
        name: file.name,
        type: file.type,
        size: file.size,
      });
      if (!started.ok) return fail(started.message);
      const sent = await fetch(started.url, {
        method: "PUT",
        body: file,
        headers: { "content-type": file.type },
      });
      if (!sent.ok) return fail("The upload didn't finish.");
      const done = await finishUpload(started.id);
      if (!done.ok) return fail(done.message);
      onChange((list) => [
        ...list,
        { id: started.id, name: file.name, mime: file.type, size: done.size, field_key: field },
      ]);
      setUploads((list) => list.filter((u) => u.key !== key));
    } catch {
      fail("The upload didn't finish. Check your connection.");
    }
  }

  function add(list: FileList | null) {
    const added = [...(list ?? [])].map((file) => ({ key: crypto.randomUUID(), file }));
    setUploads((current) => [...current, ...added]);
    for (const { key, file } of added) void send(key, file);
  }

  async function remove(file: Attachment) {
    setError("");
    const result = await removeUpload(file.id).catch(() => ({ ok: false, message: undefined }));
    if (result.ok) onChange((list) => list.filter((f) => f.id !== file.id));
    else setError(result.message ?? "The file couldn't be removed. Try again.");
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {mine.map((f) => (
          <li
            key={f.id}
            className="rounded-control border-line flex items-center gap-3 border py-1 pr-1 pl-3 text-sm"
          >
            <Paperclip className="text-muted size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{f.name}</span>
            <span className="text-muted shrink-0 text-xs">{formatSize(f.size)}</span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={`Remove ${f.name}`}
              onClick={() => remove(f)}
            >
              <Trash2 className="text-brand size-4" aria-hidden />
            </Button>
          </li>
        ))}
        {uploads.map((u) => (
          <li
            key={u.key}
            className={cn(
              "rounded-control flex min-h-12 items-center gap-3 border px-3 text-sm",
              u.error ? "border-brand/30 bg-brand-soft" : "border-line",
            )}
          >
            <span className="min-w-0 flex-1 py-2">
              <span className="block truncate">{u.file.name}</span>
              <span
                role={u.error ? "alert" : "status"}
                className={cn("text-xs", u.error ? "text-brand-strong" : "text-muted")}
              >
                {u.error ?? "Uploading…"}
              </span>
            </span>
            {u.error && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => send(u.key, u.file)}
                >
                  <RotateCw className="size-4" aria-hidden />
                  Retry
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setUploads((list) => list.filter((x) => x.key !== u.key))}
                >
                  Dismiss
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-brand-strong text-xs font-medium">
          {error}
        </p>
      )}
      <label
        htmlFor={id}
        className={cn(
          buttonStyles({ variant: "outline", size: "sm" }),
          "focus-within:outline-brand cursor-pointer focus-within:outline-2 focus-within:outline-offset-2",
        )}
      >
        <Paperclip className="size-4" aria-hidden />
        {label}
        <input
          id={id}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <p className="text-muted text-xs">PDF, photo, Word or Excel, up to 10 MB each.</p>
    </div>
  );
}
