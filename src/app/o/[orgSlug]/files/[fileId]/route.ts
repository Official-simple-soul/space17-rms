import { NextResponse } from "next/server";
import { getAttachment } from "@/features/requests/repository";
import { requireSession } from "@/lib/auth/session";
import { createDownloadUrl } from "@/lib/files/storage";

/** Checks access, then hands over a link that works for one minute. */
export async function GET(_: Request, { params }: RouteContext<"/o/[orgSlug]/files/[fileId]">) {
  await requireSession();
  const file = await getAttachment((await params).fileId);
  if (!file) return new NextResponse("Not found", { status: 404 });
  const inline = file.mime.startsWith("image/") || file.mime === "application/pdf";
  const response = NextResponse.redirect(
    await createDownloadUrl(file.storage_path, file.file_name, inline),
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
