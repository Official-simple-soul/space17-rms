import { redirect } from "next/navigation";
import { getHomePath } from "@/lib/auth/home";
import { requireSession } from "@/lib/auth/session";

export default async function Home() {
  await requireSession();
  redirect(await getHomePath());
}
