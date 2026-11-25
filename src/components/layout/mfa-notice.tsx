import Link from "next/link";
import { Notice } from "@/components/ui/surface";

export function MfaNotice({ aal }: { aal: string }) {
  if (aal === "aal2") return null;
  return (
    <div className="mb-6">
      <Notice>
        Two-step verification is needed to save changes.{" "}
        <Link href="/account" className="font-medium underline">
          Set it up
        </Link>
      </Notice>
    </div>
  );
}
