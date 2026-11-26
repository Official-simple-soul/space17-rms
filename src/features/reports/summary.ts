type Line = { total_minor: number; category: string | null; evidence: string };

/** Totals shown at the top of a report. Coverage counts expenses, not money. */
export function summarise(lines: Line[]) {
  const byCategory = new Map<string, number>();
  for (const l of lines) {
    const name = l.category ?? "Uncategorised";
    byCategory.set(name, (byCategory.get(name) ?? 0) + l.total_minor);
  }
  const missing = lines.filter((l) => l.evidence === "missing").length;
  return {
    total: lines.reduce((sum, l) => sum + l.total_minor, 0),
    missing,
    // Rounded down, so 100% always means every expense.
    coverage: lines.length ? Math.floor(((lines.length - missing) / lines.length) * 100) : 100,
    categories: [...byCategory]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total),
  };
}
