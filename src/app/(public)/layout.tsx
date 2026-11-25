import { Check } from "lucide-react";
import { Logo } from "@/components/layout/logo";

const POINTS = [
  "Requests routed to the right approver",
  "Every naira backed by evidence",
  "Monthly reports without the chase",
];

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="bg-ink hidden flex-col justify-between p-12 text-white lg:flex">
        <Logo inverse />
        <div className="max-w-lg">
          <p className="text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
            From request to report, all accounted for.
          </p>
          <ul className="mt-10 space-y-4 text-neutral-300">
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
        <p className="text-sm text-neutral-400">Access is by invitation.</p>
      </aside>
      <main className="flex flex-col p-6 sm:p-10">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="m-auto w-full max-w-sm py-10">{children}</div>
      </main>
    </div>
  );
}
