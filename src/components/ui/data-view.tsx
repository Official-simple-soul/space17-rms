"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  LayoutGrid,
  List,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { LIST_VIEW_COOKIE, type ListView } from "@/config/constants";
import { paginate, parseSort, selectRows, type SortValue } from "@/lib/data-view";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { EmptyState } from "./surface";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sort?: (row: T) => SortValue;
  hideOnMobile?: boolean;
  align?: "right";
};
export type Filter<T> = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  /** Not needed when the server does the filtering. */
  match?: (row: T, value: string) => boolean;
};

/** Rows are already searched, filtered, sorted and cut to one page by the database. */
export type ServerPaging = { page: number; pageSize: number; total: number };

type Props<T> = {
  server?: ServerPaging;
  label: string;
  rows: T[];
  rowKey: (row: T) => string;
  columns: Column<T>[];
  card: (row: T) => React.ReactNode;
  searchText?: (row: T) => string;
  filters?: Filter<T>[];
  initialView: ListView;
  empty: { icon: LucideIcon; title: string; description: string };
};

function rememberView(value: ListView) {
  document.cookie = `${LIST_VIEW_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
}

const PAGE_SIZE = 20;
const control = "h-10 rounded-control border border-line bg-surface px-3 text-sm";

/** Standard list: search, filters and sorting live in the URL so a view can be shared. */
export function DataView<T>({
  server,
  label,
  rows,
  rowKey,
  columns,
  card,
  searchText,
  filters = [],
  initialView,
  empty,
}: Props<T>) {
  // Controls reflect a choice at once, while the server loads the matching page.
  const [search, setSearch] = useOptimistic(useSearchParams().toString());
  const params = new URLSearchParams(search);
  // Quick successive changes must build on each other, not on the last finished load.
  const latest = useRef(search);
  useEffect(() => {
    latest.current = search;
  }, [search]);
  const [view, setView] = useState(initialView);
  const router = useRouter();
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const query = params.get("q") ?? "";
  // What is typed can run ahead of the URL; follow the URL when something else changes it.
  const [draft, setDraft] = useState(query);
  const [synced, setSynced] = useState(query);
  if (query !== synced) {
    setSynced(query);
    if (query !== draft.trim() && !pending) setDraft(query);
  }
  const sort = parseSort(params.get("sort"));
  const sortable = columns.filter((c) => c.sort);
  const active = filters.flatMap((f) => {
    const value = params.get(f.key);
    return value && f.options.some((o) => o.value === value) ? [{ filter: f, value }] : [];
  });
  const found = server
    ? rows
    : selectRows(rows, {
        query,
        searchText: searchText ?? (() => ""),
        matches: active.map(
          ({ filter, value }) =>
            (row: T) =>
              filter.match?.(row, value) ?? true,
        ),
        sortBy: sortable.find((c) => c.key === sort?.key)?.sort,
        desc: sort?.desc,
      });
  const local = paginate(found, Number(params.get("page") ?? 1), PAGE_SIZE);
  const total = server?.total ?? found.length;
  const current = server?.page ?? local.current;
  const size = server?.pageSize ?? PAGE_SIZE;
  const pages = server ? Math.max(1, Math.ceil(total / size)) : local.pages;
  const items = server ? rows : local.items;
  const first = (current - 1) * size;
  const narrowed = Boolean(query) || active.length > 0;

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(latest.current);
    if (!("page" in changes)) next.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const url = next.size ? `?${next}` : window.location.pathname;
    latest.current = next.toString();
    if (server)
      start(() => {
        setSearch(next.toString());
        router.replace(url, { scroll: false });
      });
    else window.history.replaceState(null, "", url);
  }

  function changeQuery(value: string) {
    setDraft(value);
    clearTimeout(timer.current);
    if (server) timer.current = setTimeout(() => update({ q: value.trim() }), 300);
    else update({ q: value });
  }

  function clear() {
    clearTimeout(timer.current);
    setDraft("");
    update(Object.fromEntries([["q", ""], ...filters.map((f) => [f.key, ""])]));
  }

  function changeView(value: ListView) {
    setView(value);
    rememberView(value);
  }

  const toggle = (value: ListView, Icon: LucideIcon, name: string) => (
    <button
      type="button"
      aria-label={name}
      aria-pressed={view === value}
      title={name}
      onClick={() => changeView(value)}
      className={cn(
        "grid size-8 place-items-center rounded-md",
        view === value ? "bg-ink text-white" : "text-muted hover:text-ink",
      )}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );

  return (
    <section
      aria-label={label}
      aria-busy={pending}
      className="rounded-card border-line bg-surface border"
    >
      <div className="border-line flex flex-wrap items-center gap-2 border-b p-3 sm:p-4">
        <label className="relative w-full sm:w-44">
          <span className="sr-only">Search {label.toLowerCase()}</span>
          <Search
            className="text-muted pointer-events-none absolute top-3 left-3 size-4"
            aria-hidden
          />
          <input
            type="search"
            value={draft}
            onChange={(e) => changeQuery(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}`}
            className={cn(control, "w-full pl-9")}
          />
        </label>
        {filters.length > 0 && (
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            {filters.map((f) => (
              <select
                key={f.key}
                aria-label={`Filter by ${f.label.toLowerCase()}`}
                value={active.find((a) => a.filter.key === f.key)?.value ?? ""}
                onChange={(e) => update({ [f.key]: e.target.value })}
                className={cn(control, "w-full sm:w-40")}
              >
                <option value="">{f.label}: All</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ))}
          </div>
        )}
        <div className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto">
          {sortable.length > 0 && (
            <select
              aria-label="Sort"
              value={params.get("sort") ?? ""}
              onChange={(e) => update({ sort: e.target.value })}
              className={cn(control, "w-36")}
            >
              <option value="">Sort: Default</option>
              {sortable.flatMap((c) => [
                <option key={c.key} value={c.key}>
                  {c.header} ↑
                </option>,
                <option key={`-${c.key}`} value={`-${c.key}`}>
                  {c.header} ↓
                </option>,
              ])}
            </select>
          )}
          <div
            role="group"
            aria-label="Layout"
            className="rounded-control border-line flex border p-0.5"
          >
            {toggle("list", List, "List view")}
            {toggle("grid", LayoutGrid, "Grid view")}
          </div>
        </div>
      </div>

      {rows.length === 0 && !narrowed ? (
        <EmptyState {...empty} />
      ) : found.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="font-semibold">No matches</p>
          <p className="text-muted mt-1 mb-4 text-sm">Try a different search or filter.</p>
          <Button size="sm" variant="outline" onClick={clear}>
            Clear filters
          </Button>
        </div>
      ) : view === "grid" ? (
        <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((row) => (
            <li
              key={rowKey(row)}
              className="rounded-card border-line hover:border-ink border p-5 transition"
            >
              {card(row)}
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-line text-muted border-b bg-neutral-50 text-xs">
              <tr>
                {columns.map((c) => {
                  const direction =
                    sort?.key === c.key ? (sort.desc ? "descending" : "ascending") : undefined;
                  const Icon =
                    direction === "ascending" ? ArrowUp : direction ? ArrowDown : ChevronsUpDown;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={direction}
                      className={cn(
                        "px-5 py-3 font-medium whitespace-nowrap",
                        c.hideOnMobile && "hidden md:table-cell",
                        c.align && "text-right",
                      )}
                    >
                      {c.sort ? (
                        <button
                          type="button"
                          onClick={() =>
                            update({ sort: direction === "ascending" ? `-${c.key}` : c.key })
                          }
                          className="hover:text-ink inline-flex items-center gap-1"
                        >
                          {c.header}
                          <Icon className="size-3.5" aria-hidden />
                        </button>
                      ) : c.header ? (
                        c.header
                      ) : (
                        <span className="sr-only">Actions</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {items.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-neutral-50">
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-5 py-3.5",
                        c.hideOnMobile && "hidden md:table-cell",
                        c.align && "text-right",
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {found.length > 0 && (
        <footer className="border-line text-muted flex items-center justify-between gap-3 border-t px-5 py-3 text-sm">
          <p aria-live="polite">
            {first + 1}–{first + items.length} of {total}
          </p>
          {pages > 1 && (
            <div className="flex items-center gap-2">
              <span className="mr-1">
                Page {current} of {pages}
              </span>
              <Button
                size="icon"
                variant="outline"
                aria-label="Previous page"
                disabled={pending || current === 1}
                onClick={() => update({ page: String(current - 1) })}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label="Next page"
                disabled={pending || current === pages}
                onClick={() => update({ page: String(current + 1) })}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </div>
          )}
        </footer>
      )}
    </section>
  );
}
