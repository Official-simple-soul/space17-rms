import { NextResponse } from "next/server";
import { getAttachment } from "@/features/files/repository";
import { requireSession } from "@/lib/auth/session";
import { createDownloadUrl } from "@/lib/files/storage";

/** Checks access, then hands over a link that works for one minute. */
export async function GET(_: Request, { params }: RouteContext<"/o/[orgSlug]/files/[fileId]">) {
  await requireSession();
  const file = await getAttachment((await params).fileId);
  if (!file) return new NextResponse("Not found", { status: 404 });
  const inline = file.mime.startsWith("image/") || file.mime === "application/pdf";
  return new NextResponse(null, {
    status: 307,
    headers: {
      Location: await createDownloadUrl(file.storage_path, file.file_name, inline),
      "Cache-Control": "private, no-store",
    },
  });
}
