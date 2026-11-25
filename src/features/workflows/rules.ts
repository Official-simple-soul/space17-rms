/** A step without a threshold always applies; others apply from their amount upwards. */
export function stepsForAmount<T extends { min_amount_minor: number | null }>(
  steps: T[],
  amountMinor: number,
): T[] {
  return steps.filter((s) => s.min_amount_minor === null || amountMinor >= s.min_amount_minor);
}
