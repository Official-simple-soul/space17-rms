import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/config/env";
import { safePath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safePath(request.nextUrl.searchParams.get("next"));
  if (code) {
    const { error } = await (await createClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, env.appUrl));
  }
  return NextResponse.redirect(new URL("/forgot-password", env.appUrl));
}
