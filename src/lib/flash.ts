import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/config/env";
import { FLASH_COOKIE } from "./flash-cookie";

/** Redirects and shows a success message on the next page. */
export async function redirectWith(path: string, message: string): Promise<never> {
  // Read once by the browser, so it can't be httpOnly. Never put anything private in it.
  (await cookies()).set(FLASH_COOKIE, message, {
    maxAge: 30,
    sameSite: "lax",
    secure: env.appUrl.startsWith("https:"),
  });
  redirect(path);
}
