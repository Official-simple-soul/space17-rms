"use client";

import { useEffect } from "react";

/** Lets every `.lift` card's glow follow the pointer, with one listener. */
export function Spotlight() {
  useEffect(() => {
    if (!matchMedia("(hover: hover)").matches) return;
    let frame = 0;
    function move(event: PointerEvent) {
      const card = (event.target as Element | null)?.closest?.<HTMLElement>(".lift");
      if (!card) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = card.getBoundingClientRect();
        card.style.setProperty("--x", `${event.clientX - box.left}px`);
        card.style.setProperty("--y", `${event.clientY - box.top}px`);
      });
    }
    document.addEventListener("pointermove", move, { passive: true });
    return () => {
      document.removeEventListener("pointermove", move);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}
