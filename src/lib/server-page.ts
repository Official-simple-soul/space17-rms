import "server-only";
import { z } from "zod";

export const PAGE_SIZE = 20;
export type Query = Record<string, string | string[] | undefined>;
export const isId = (value: unknown): value is string => z.uuid().safeParse(value).success;
export const text = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";

/** Loads the requested page, falling back to the first when it no longer exists. */
export async function loadPage<T extends { total: number }>(
  query: Query,
  load: (range: { p_limit: number; p_offset: number }) => Promise<T[]>,
) {
  const get = (page: number) => load({ p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE });
  let page = Math.min(Math.max(1, Number.parseInt(text(query.page), 10) || 1), 100_000);
  let rows = await get(page);
  if (!rows.length && page > 1) {
    page = 1;
    rows = await get(page);
  }
  return { rows, server: { page, pageSize: PAGE_SIZE, total: rows[0]?.total ?? 0 } };
}
