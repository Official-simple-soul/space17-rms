/** Allows only same-site paths, preventing open redirects. */
export function safePath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  try {
    const url = new URL(value, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return fallback;
    const path = url.pathname + url.search;
    return path.startsWith("//") ? fallback : path;
  } catch {
    return fallback;
  }
}
