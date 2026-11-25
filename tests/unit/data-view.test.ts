import { expect, it } from "vitest";
import { paginate, parseSort, selectRows } from "@/lib/data-view";

const rows = [{ n: "beta 10" }, { n: "Alpha" }, { n: "beta 2" }];
const base = { query: "", searchText: (r: { n: string }) => r.n, matches: [] };

it("searches every word and applies filters", () => {
  expect(selectRows(rows, { ...base, query: "10 BETA" })).toEqual([rows[0]]);
  expect(selectRows(rows, { ...base, matches: [(r) => r.n.startsWith("b")] })).toHaveLength(2);
});
it("sorts naturally in both directions without changing the source", () => {
  expect(selectRows(rows, { ...base, sortBy: (r) => r.n }).map((r) => r.n)).toEqual([
    "Alpha",
    "beta 2",
    "beta 10",
  ]);
  expect(selectRows(rows, { ...base, sortBy: (r) => r.n, desc: true })[0].n).toBe("beta 10");
  expect(rows[0].n).toBe("beta 10");
});
it("parses sort and clamps pages", () => {
  expect(parseSort("-name")).toEqual({ key: "name", desc: true });
  expect(paginate([1, 2, 3], 9, 2)).toMatchObject({ current: 2, pages: 2, items: [3] });
  expect(paginate([1], NaN, 2).current).toBe(1);
});
