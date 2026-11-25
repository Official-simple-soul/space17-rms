export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 font-semibold tracking-tight ${inverse ? "text-white" : "text-ink"}`}
    >
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
        <rect width="32" height="32" rx="8" fill={inverse ? "#fff" : "#0a0a0a"} />
        <rect x="8" y="8" width="7" height="16" rx="2" fill={inverse ? "#0a0a0a" : "#fff"} />
        <rect x="18" y="8" width="6" height="6" rx="2" fill="#a30d1a" />
        <rect x="18" y="17" width="6" height="7" rx="2" fill={inverse ? "#0a0a0a" : "#fff"} />
      </svg>
      space17{" "}
      <span className={inverse ? "font-normal text-neutral-400" : "text-muted font-normal"}>
        RMS
      </span>
    </span>
  );
}
