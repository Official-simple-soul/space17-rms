import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { LAST_ORG_COOKIE } from "@/config/constants";
import { env } from "@/config/env";

const PUBLIC = [
  "/sign-in",
  "/forgot-password",
  "/request-access",
  "/invite",
  "/join",
  "/auth",
  "/api/jobs",
];

/** Refreshes the session and does an optimistic redirect. Pages and the database still authorise. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = path === "/" ? "" : `?next=${encodeURIComponent(path)}`;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  const slug = path.match(/^\/o\/([a-z0-9-]+)/)?.[1];
  if (slug)
    response.cookies.set(LAST_ORG_COOKIE, slug, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.appUrl.startsWith("https"),
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  return response;
}

export const config = {
  matcher: ["/((?!local-storage/|_next/static|_next/image|icon.svg|.*\\.(?:png|svg|jpg|webp)$).*)"],
};
