"use client";

import { Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { finishTour } from "../actions";

export type TourStep = {
  /** Matches a `data-tour` attribute; without one, or if it isn't on screen, the step is centred. */
  target?: string;
  title: string;
  body: string;
};

const REPLAY = "rms:tour";
const GAP = 14;
const PAD = 8;

type Box = { top: number; left: number; width: number; height: number };

function findTarget(name?: string) {
  if (!name) return null;
  // The same place can appear twice (sidebar and phone bar); use the one that is showing.
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const box = el.getBoundingClientRect();
    if (box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

function measure(el: HTMLElement | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

/** Where the card goes: beside the sidebar, below or above the target, or docked on phones. */
function place(box: Box | null): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(360, vw - 32);
  if (!box) return { width, left: (vw - width) / 2, top: "50%", transform: "translateY(-50%)" };
  if (vw < 640) {
    const lower = box.top + box.height / 2 > vh / 2;
    return lower ? { left: 16, right: 16, top: 16 } : { left: 16, right: 16, bottom: 16 };
  }
  const clampX = (x: number) => Math.min(Math.max(x, 16), vw - width - 16);
  if (box.left < 280 && box.left + box.width + GAP + width < vw)
    return {
      width,
      left: box.left + box.width + GAP,
      top: Math.min(Math.max(box.top + box.height / 2 - 100, 16), vh - 260),
    };
  const left = clampX(box.left + box.width / 2 - width / 2);
  if (box.top + box.height + GAP + 240 < vh)
    return { width, left, top: box.top + box.height + GAP };
  return { width, left, bottom: vh - box.top + GAP };
}

/** A short first-visit walkthrough. Replay it with <TourButton />. */
export function GuidedTour({
  orgId,
  steps,
  autoStart,
}: {
  orgId: string;
  steps: TourStep[];
  autoStart: boolean;
}) {
  const [index, setIndex] = useState<number | null>(null);
  // Measured for a particular step, so a position from the previous step is never used.
  const [spot, setSpot] = useState<{ step: number; box: Box | null } | null>(null);
  const [, setTick] = useState(0);
  const next = useRef<HTMLButtonElement>(null);
  // Only the first, automatic showing is recorded; a replay changes nothing.
  const firstShowing = useRef(false);
  const titleId = useId();
  const step = index === null ? null : steps[index];

  // Let the page settle before starting.
  useEffect(() => {
    if (!autoStart) return;
    const timer = setTimeout(() => {
      firstShowing.current = true;
      setIndex(0);
    }, 700);
    return () => clearTimeout(timer);
  }, [autoStart]);

  useEffect(() => {
    const replay = () => setIndex(0);
    window.addEventListener(REPLAY, replay);
    return () => window.removeEventListener(REPLAY, replay);
  }, []);

  const close = useCallback(() => {
    setIndex(null);
    if (firstShowing.current) void finishTour(orgId).catch(() => {});
    firstShowing.current = false;
  }, [orgId]);

  // Bring each target into view, then follow it as the page scrolls or resizes.
  useEffect(() => {
    if (!step) return;
    const el = findTarget(step.target);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
    let frame = 0;
    const follow = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setSpot({ step: index!, box: measure(findTarget(step.target)) });
        setTick((n) => n + 1);
      });
    };
    follow();
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [step, index]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") setIndex((i) => (i! < steps.length - 1 ? i! + 1 : i));
      else if (e.key === "ArrowLeft") setIndex((i) => (i! > 0 ? i! - 1 : i));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, steps.length, close]);

  const ready = index !== null && spot?.step === index;
  // Focus moves to the card once it is shown at its place.
  useEffect(() => {
    if (ready) next.current?.focus({ preventScroll: true });
  }, [ready, index]);

  if (!step || index === null) return null;
  const last = index === steps.length - 1;
  const box = ready ? spot!.box : null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="animate-fade fixed inset-0 z-[60]"
    >
      {box ? (
        <div
          aria-hidden
          data-spot={step.target}
          className="pointer-events-none fixed rounded-2xl shadow-[0_0_0_9999px_rgb(10_10_10/0.55)] ring-2 ring-white/80 transition-all duration-500 ease-(--ease-out-soft)"
          style={box}
        >
          <span className="animate-halo absolute inset-0 rounded-2xl" />
        </div>
      ) : (
        <div aria-hidden className="bg-ink/55 absolute inset-0 backdrop-blur-[2px]" />
      )}
      <div
        key={index}
        // Shown once its position is known, so it doesn't jump.
        className={cn(
          "rounded-card fixed border border-white/70 bg-white/90 p-5 shadow-[0_30px_80px_-20px_rgb(60_10_15/0.45)] backdrop-blur-2xl",
          ready ? "animate-rise" : "invisible",
        )}
        style={place(box)}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-brand flex items-center gap-1.5 text-xs font-semibold">
            <Sparkles className="size-3.5" aria-hidden />
            {index + 1} of {steps.length}
          </p>
          <button
            type="button"
            onClick={close}
            aria-label="Close tour"
            className="text-muted hover:text-ink -m-1 rounded-lg p-1 transition-colors"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <h2 id={titleId} className="mt-2 text-lg font-semibold tracking-tight">
          {step.title}
        </h2>
        <p className="text-muted mt-1 text-sm leading-relaxed">{step.body}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.title}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index ? "bg-brand w-5" : i < index ? "bg-ink/40 w-1.5" : "bg-ink/15 w-1.5",
                )}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {index > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setIndex(index - 1)}>
                Back
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={close}>
                Skip
              </Button>
            )}
            <Button
              ref={next}
              variant="brand"
              size="sm"
              onClick={() => (last ? close() : setIndex(index + 1))}
            >
              {last ? "Done" : index === 0 ? "Show me" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Starts the tour again. */
export function TourButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      data-tour="tour-button"
      onClick={() => window.dispatchEvent(new Event(REPLAY))}
    >
      <Sparkles className="size-4" aria-hidden />
      Take the tour
    </Button>
  );
}
