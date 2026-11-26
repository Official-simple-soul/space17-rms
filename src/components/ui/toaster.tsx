"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Toaster as Sonner, toast } from "sonner";
import { FLASH_COOKIE } from "@/lib/flash-cookie";

/** Shows the message left by an action that moved to another page, once. */
export function showFlash() {
  const entry = document.cookie.split("; ").find((c) => c.startsWith(`${FLASH_COOKIE}=`));
  if (!entry) return;
  document.cookie = `${FLASH_COOKIE}=; path=/; max-age=0`;
  try {
    toast.success(decodeURIComponent(entry.slice(FLASH_COOKIE.length + 1)));
  } catch {
    // A malformed cookie has nothing worth showing.
  }
}

export function Toaster() {
  const pathname = usePathname();
  useEffect(showFlash, [pathname]);
  return (
    <Sonner
      position="top-right"
      theme="light"
      closeButton
      duration={4500}
      // Clear of the mobile header.
      mobileOffset={{ top: 76, left: 12, right: 12 }}
      icons={{
        success: <CircleCheck className="size-5" aria-hidden />,
        error: <CircleAlert className="size-5" aria-hidden />,
      }}
      toastOptions={{
        classNames: {
          // Usable while a side panel is open.
          toast:
            "pointer-events-auto! rounded-control! gap-3! border! px-4! py-3.5! font-sans! shadow-[0_16px_40px_-12px_rgb(10_10_10/0.45)]! backdrop-blur-xl!",
          title: "text-sm! font-medium!",
          success: "bg-ink/90! text-white! border-white/10!",
          error: "bg-brand/95! text-white! border-white/15!",
          closeButton: "bg-white! text-ink! border-line!",
        },
      }}
    />
  );
}
