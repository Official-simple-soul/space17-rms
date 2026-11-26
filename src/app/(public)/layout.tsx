import { Check } from "lucide-react";
import { Logo } from "@/components/layout/logo";

const POINTS = [
  "Requests routed to the right approver",
  "Every naira backed by evidence",
  "Monthly reports without the chase",
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="glass-dark relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex">
        <div
          aria-hidden
          className="aurora-blob -right-40 -bottom-40 size-[44rem] [--blob:rgb(163_13_26/0.5)]"
          style={{ animationDuration: "20s" }}
        />
        <Logo inverse />
        <div className="animate-rise relative max-w-lg">
          <p className="text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
            From request to report, all accounted for.
          </p>
          <ul className="stagger mt-10 space-y-4 text-neutral-300">
            {POINTS.map((point) => (
              <li key={point} className="flex items-center gap-3">
                <span className="bg-brand grid size-6 place-items-center rounded-full text-white">
                  <Check className="size-3.5" aria-hidden />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-neutral-400">Access is by invitation.</p>
      </aside>
      <main className="flex flex-col p-6 sm:p-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="rounded-card glass animate-rise m-auto w-full max-w-md border p-6 sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
