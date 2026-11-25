import "server-only";
import { cookies } from "next/headers";
import { LIST_VIEW_COOKIE, type ListView } from "@/config/constants";

/** The viewer's last choice, read on the server so the page doesn't flicker. */
export async function getListView(): Promise<ListView> {
  return (await cookies()).get(LIST_VIEW_COOKIE)?.value === "grid" ? "grid" : "list";
}
