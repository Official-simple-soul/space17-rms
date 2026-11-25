"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-[60dvh] place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-muted mt-2 mb-6">Your data is safe. Try loading the page again.</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
