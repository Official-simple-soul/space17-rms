"use client";

import { Paperclip } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

/** A small preview of a photo, or a paperclip for anything that can't be shown. */
export function Thumbnail({ src, mime }: { src?: string; mime: string }) {
  const [failed, setFailed] = useState<string>();
  return src && mime.startsWith("image/") && failed !== src ? (
    <Image
      src={src}
      alt=""
      width={56}
      height={56}
      unoptimized
      className="border-line size-14 shrink-0 rounded-lg border object-cover"
      onError={() => setFailed(src)}
    />
  ) : (
    <Paperclip className="text-muted size-4 shrink-0" aria-hidden />
  );
}
