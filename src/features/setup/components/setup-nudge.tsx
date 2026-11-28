"use client";

import { ArrowDown } from "lucide-react";

/** Points to the setup checklist while steps are left: scrolls to it and makes it glow briefly. */
export function SetupNudge({ left }: { left: number }) {
  function show() {
    const setup = document.getElementById("setup");
    if (!setup) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    setup.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    // Restart the glow each time.
    setup.classList.remove("attention-flash");
    void setup.offsetWidth;
    setup.classList.add("attention-flash");
    setup.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
  }
  return (
    <button
      type="button"
      onClick={show}
      className="glass group inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-transform duration-200 hover:-translate-y-0.5 active:scale-95"
    >
      <span className="relative flex size-2.5" aria-hidden>
        <span className="bg-brand absolute inset-0 animate-ping rounded-full opacity-60" />
        <span className="bg-brand relative size-2.5 rounded-full" />
      </span>
      Finish setting up
      <span className="text-muted">
        · {left} {left === 1 ? "step" : "steps"} left
      </span>
      <ArrowDown
        className="text-muted size-4 transition-transform group-hover:translate-y-0.5"
        aria-hidden
      />
    </button>
  );
}
