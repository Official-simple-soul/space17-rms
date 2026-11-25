import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const [{ data: profile }, { data: admin }, { data: aal }] = await Promise.all([
    supabase.rpc("my_profile").maybeSingle(),
    supabase.from("platform_admins").select("user_id").maybeSingle(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  return {
    userId: data.user.id,
    email: data.user.email ?? "",
    name: profile?.full_name || data.user.email || "",
    phone: profile?.phone ?? "",
    isPlatformAdmin: Boolean(admin),
    aal: aal?.currentLevel ?? "aal1",
    nextAal: aal?.nextLevel ?? "aal1",
  };
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  // A user with a verified factor must always complete it.
  if (session.nextAal === "aal2" && session.aal !== "aal2") redirect("/mfa");
  return session;
}

export async function requirePlatformAdmin() {
  const session = await requireSession();
  if (!session.isPlatformAdmin) notFound();
  if (session.aal !== "aal2") redirect("/mfa");
  return session;
}

export const listMyOrganisations = cache(async () => {
  const { data, error } = await (await createClient()).rpc("my_organisations");
  if (error) throw new Error("Could not load organisations");
  return data.map((o) => ({
    ...o,
    isOpen: o.status !== "suspended" && o.membership_status === "active",
  }));
});

export const getOrganisationContext = cache(async (slug: string) => {
  const session = await requireSession();
  const list = await listMyOrganisations();
  const current = list.find((o) => o.slug === slug);
  if (!current) notFound();
  if (!current.isOpen) redirect("/");
  const { data: permissions } = await (
    await createClient()
  ).rpc("my_permissions", { p_org: current.id });
  return {
    session,
    organisation: current,
    organisations: list.filter((o) => o.isOpen),
    permissions: permissions ?? [],
    can: (key: string) => (permissions ?? []).some((p) => p.permission_key === key),
  };
});
