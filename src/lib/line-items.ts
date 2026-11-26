import { parseMoney } from "./format";
import { uid } from "./uid";

/** One item as typed, before it is converted for saving. */
export type ItemDraft = { key: string; description: string; quantity: string; price: string };

export const blankItem = (): ItemDraft => ({
  key: uid(),
  description: "",
  quantity: "1",
  price: "",
});

export const toItemDrafts = (
  items: { id: string; description: string; quantity: number; unit_price_minor: number }[],
): ItemDraft[] =>
  items.map((i) => ({
    key: i.id,
    description: i.description,
    quantity: i.quantity ? String(i.quantity) : "",
    price: i.unit_price_minor ? (i.unit_price_minor / 100).toFixed(2) : "",
  }));

export const fromItemDrafts = (items: ItemDraft[]) =>
  items.map((i) => ({
    description: i.description.trim(),
    quantity: Math.min(parseQuantity(i.quantity) ?? 0, 100_000),
    unit_price_minor: Math.min(parseMoney(i.price) ?? 0, 100_000_000_000),
  }));

export function parseQuantity(value: string): number | null {
  const text = value.trim().replaceAll(",", "");
  return /^\d{1,6}(\.\d{1,3})?$/.test(text) ? Number(text) : null;
}

/** Matches the database: quantity × price, rounded to the nearest minor unit. */
export function lineTotal(item: Pick<ItemDraft, "quantity" | "price">): number {
  const thousandths = BigInt(Math.round((parseQuantity(item.quantity) ?? 0) * 1000));
  return Number((thousandths * BigInt(parseMoney(item.price) ?? 0) + BigInt(500)) / BigInt(1000));
}

export function itemErrors(items: ItemDraft[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const i of items) {
    if (i.description.trim().length < 2) errors[i.key] = "Describe this item.";
    else if (!parseQuantity(i.quantity) || parseQuantity(i.quantity)! > 100_000)
      errors[i.key] = "Enter a quantity above zero.";
    else if (!parseMoney(i.price) || parseMoney(i.price)! > 100_000_000_000)
      errors[i.key] = "Enter a unit price above zero, such as 1,500.";
  }
  return errors;
}
