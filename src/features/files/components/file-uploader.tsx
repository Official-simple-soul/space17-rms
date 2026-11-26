"use client";

import { Camera, Paperclip, RotateCw, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button, buttonStyles } from "@/components/ui/button";
import { compressImage } from "@/lib/files/compress";
import { ACCEPT, formatSize } from "@/lib/files/types";
import { cn } from "@/lib/utils";
import { finishUpload, removeUpload } from "../actions";
import { Thumbnail } from "./thumbnail";
import type { Attachment, UploadInput, UploadStart } from "../schema";
import { uid } from "@/lib/uid";

type Upload = { key: string; file: File; preview: string; error?: string };

export function FileUploader({
  field = null,
  label,
  files,
  onChange,
  before,
  start,
}: {
  field?: string | null;
  label: string;
  files: Attachment[];
  onChange: (update: (list: Attachment[]) => Attachment[]) => void;
  /** Runs first, so the record the file belongs to is saved. */
  before?: () => Promise<boolean>;
  /** Asks the feature that owns the record for permission to upload. */
  start: (file: UploadInput) => Promise<UploadStart>;
}) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState("");
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const fileUrl = (file: string) => `/o/${orgSlug}/files/${file}`;
  // Photos just chosen are shown from the device, without downloading them again.
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const created = useRef<string[]>([]);
  useEffect(() => {
    const urls = created;
    return () => urls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  const mine = files.filter((f) => f.field_key === field);

  async function send({ key, file: original, preview }: Upload) {
    const fail = (message: string) => {
      setUploads((list) => list.map((u) => (u.key === key ? { ...u, error: message } : u)));
      toast.error(`${original.name} wasn't added.`, { description: message });
    };
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, error: undefined } : u)));
    try {
      if (before && !(await before())) return fail("Your changes couldn't be saved yet. Retry.");
      const file = await compressImage(original);
      const started = await start({ name: file.name, type: file.type, size: file.size });
      if (!started.ok) return fail(started.message);
      const sent = await fetch(started.url, {
        method: "PUT",
        body: file,
        headers: { "content-type": file.type },
      });
      if (!sent.ok) return fail("The upload didn't finish.");
      const done = await finishUpload(started.id);
      if (!done.ok) return fail(done.message);
      setPreviews((all) => ({ ...all, [started.id]: preview }));
      onChange((list) => [
        ...list,
        { id: started.id, name: file.name, mime: file.type, size: done.size, field_key: field },
      ]);
      setUploads((list) => list.filter((u) => u.key !== key));
      toast.success("File added.");
    } catch {
      fail("The upload didn't finish. Check your connection.");
    }
  }

  function add(list: FileList | null) {
    const added = [...(list ?? [])].map((file) => {
      const preview = URL.createObjectURL(file);
      created.current.push(preview);
      return { key: uid(), file, preview };
    });
    setUploads((current) => [...current, ...added]);
    for (const upload of added) void send(upload);
  }

  async function remove(file: Attachment) {
    setError("");
    const result = await removeUpload(file.id).catch(() => ({ ok: false, message: undefined }));
    if (result.ok) {
      onChange((list) => list.filter((f) => f.id !== file.id));
      toast.success("File removed.");
    } else {
      const message = result.message ?? "The file couldn't be removed. Try again.";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {mine.map((f) => (
          <li
            key={f.id}
            className="rounded-control border-line flex items-center gap-3 border py-2 pr-1 pl-3 text-sm"
          >
            <Thumbnail src={previews[f.id] ?? fileUrl(f.id)} mime={f.mime} />
            <a
              href={fileUrl(f.id)}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate hover:underline"
            >
              {f.name}
            </a>
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
            <Thumbnail src={u.preview} mime={u.file.type} />
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
                <Button type="button" size="sm" variant="outline" onClick={() => send(u)}>
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
      <div className="flex flex-wrap gap-2">
        {/* Opens the camera directly, on phones and tablets only. */}
        <Picker
          className="hidden pointer-coarse:inline-flex"
          accept="image/*"
          capture="environment"
          onPick={add}
        >
          <Camera className="size-4" aria-hidden />
          Take photo
          <span className="sr-only">: {label}</span>
        </Picker>
        <Picker accept={ACCEPT} multiple onPick={add}>
          <Paperclip className="size-4" aria-hidden />
          {label}
        </Picker>
      </div>
      <p className="text-muted text-xs">PDF, photo, Word or Excel, up to 10 MB each.</p>
    </div>
  );
}

function Picker({
  onPick,
  className,
  children,
  ...input
}: {
  accept: string;
  multiple?: boolean;
  capture?: "environment";
  onPick: (files: FileList | null) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        buttonStyles({ variant: "outline", size: "sm" }),
        "focus-within:outline-brand cursor-pointer focus-within:outline-2 focus-within:outline-offset-2",
        className,
      )}
    >
      {children}
      <input
        type="file"
        {...input}
        className="sr-only"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
