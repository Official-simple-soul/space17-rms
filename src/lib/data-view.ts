export type SortValue = string | number;
export type SortState = { key: string; desc: boolean } | null;

export function parseSort(value: string | null): SortState {
  if (!value) return null;
  const desc = value.startsWith("-");
  return { key: desc ? value.slice(1) : value, desc };
}

type Options<T> = {
  query: string;
  searchText: (row: T) => string;
  matches: ((row: T) => boolean)[];
  sortBy?: (row: T) => SortValue;
  desc?: boolean;
};

export function selectRows<T>(rows: T[], { query, searchText, matches, sortBy, desc }: Options<T>) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const found = rows.filter((row) => {
    const text = searchText(row).toLowerCase();
    return words.every((w) => text.includes(w)) && matches.every((match) => match(row));
  });
  if (!sortBy) return found;
  return [...found].sort((a, b) => {
    const x = sortBy(a);
    const y = sortBy(b);
    const order =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), "en", { sensitivity: "base", numeric: true });
    return desc ? -order : order;
  });
}

export function paginate<T>(rows: T[], page: number, size: number) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, Number.isInteger(page) ? page : 1), pages);
  return {
    pages,
    current,
    start: (current - 1) * size,
    items: rows.slice((current - 1) * size, current * size),
  };
}
