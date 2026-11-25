import { createHash, timingSafeEqual } from "node:crypto";
import { deliverEmails } from "@/features/notifications/deliver";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Called every few minutes by the host's scheduler with the CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  if (!secret || !timingSafeEqual(digest(given), digest(`Bearer ${secret}`)))
    return new Response("Not found", { status: 404 });
  return Response.json(await deliverEmails());
}
