export function formatDate(value: string | Date, timeZone = "Africa/Lagos") {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
}

export function formatDateTime(value: string | Date, timeZone = "Africa/Lagos") {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

/** Amounts are stored in minor units, for example kobo. */
export function formatMoney(minor: number, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(minor / 100);
}

/** Reads a typed amount such as "12,500.50" into minor units; null when it isn't a valid amount. */
export function parseMoney(value: string): number | null {
  const text = value.trim().replace(/^₦\s*/, "");
  if (!/^(\d+|\d{1,3}(,\d{3})+)(\.\d{1,2})?$/.test(text)) return null;
  const [whole, part = ""] = text.replaceAll(",", "").split(".");
  const minor = Number(whole) * 100 + Number(part.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
}
