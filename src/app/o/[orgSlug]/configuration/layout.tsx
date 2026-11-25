import { MfaNotice } from "@/features/configuration/components/configuration-header";
import { requireConfiguration } from "@/lib/auth/configuration";

export default async function ConfigurationLayout({
  children,
  params,
}: LayoutProps<"/o/[orgSlug]/configuration">) {
  const { session } = await requireConfiguration((await params).orgSlug);
  return (
    <>
      <MfaNotice aal={session.aal} />
      {children}
    </>
  );
}
