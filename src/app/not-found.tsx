import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-brand text-sm font-semibold">404</p>
        <h1 className="mt-2 text-2xl font-semibold">We couldn&apos;t find that page</h1>
        <p className="text-muted mt-2 mb-6">It may have moved, or you may not have access.</p>
        <Link href="/" className={buttonStyles()}>
          Go home
        </Link>
      </div>
    </main>
  );
}
