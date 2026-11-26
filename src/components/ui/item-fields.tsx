"use client";

import { Plus, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { blankItem, lineTotal, type ItemDraft } from "@/lib/line-items";
import { Button } from "./button";
import { TextField } from "./field";

/** Editable list of items with quantity and unit price. */
export function ItemFields({
  items,
  onChange: setItems,
  errors,
  currency,
}: {
  items: ItemDraft[];
  onChange: (update: (list: ItemDraft[]) => ItemDraft[]) => void;
  errors?: Record<string, string>;
  currency: string;
}) {
  const changeItem = (key: string, changes: Partial<ItemDraft>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...changes } : i)));
  return (
    <>
      <ul className="space-y-4">
        {items.map((item, i) => (
          <li key={item.key} className="rounded-control border-line border p-4">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_6rem_9rem]">
              <TextField
                label={`Item ${i + 1}`}
                name={`item:${item.key}`}
                maxLength={200}
                value={item.description}
                onChange={(e) => changeItem(item.key, { description: e.target.value })}
              />
              <TextField
                label="Quantity"
                name={`quantity:${item.key}`}
                inputMode="decimal"
                value={item.quantity}
                onChange={(e) => changeItem(item.key, { quantity: e.target.value })}
              />
              <TextField
                label={`Unit price, ${currency}`}
                name={`price:${item.key}`}
                inputMode="decimal"
                value={item.price}
                onChange={(e) => changeItem(item.key, { price: e.target.value })}
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm tabular-nums">{formatMoney(lineTotal(item), currency)}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Remove item ${i + 1}`}
                onClick={() => setItems((all) => all.filter((x) => x.key !== item.key))}
              >
                <Trash2 className="text-brand size-4" aria-hidden />
              </Button>
            </div>
            {errors?.[item.key] && (
              <p role="alert" className="text-brand-strong text-xs font-medium">
                {errors[item.key]}
              </p>
            )}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4"
        disabled={items.length >= 50}
        onClick={() => setItems((all) => [...all, blankItem()])}
      >
        <Plus className="size-4" aria-hidden />
        Add item
      </Button>
    </>
  );
}
