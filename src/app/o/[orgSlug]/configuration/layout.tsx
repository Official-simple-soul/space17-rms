import { MfaNotice } from "@/components/layout/mfa-notice";
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
