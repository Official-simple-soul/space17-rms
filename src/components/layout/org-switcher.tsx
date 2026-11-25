"use client";

import { useRouter } from "next/navigation";

export function OrgSwitcher({
  current,
  organisations,
}: {
  current: string;
  organisations: { slug: string; name: string }[];
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Switch organisation"
      value={current}
      onChange={(e) => router.push(`/o/${e.target.value}`)}
      className="rounded-control h-11 w-full truncate border border-white/15 bg-white/5 px-3 text-sm font-medium text-white"
    >
      {organisations.map((o) => (
        <option key={o.slug} value={o.slug} className="text-ink">
          {o.name}
        </option>
      ))}
    </select>
  );
}
