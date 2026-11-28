import { itemErrors, lineTotal, type ItemDraft } from "@/lib/line-items";
import type { Provision } from "./schema";

export type DraftErrors = {
  title?: string;
  purpose?: string;
  provision?: string;
  department?: string;
  amount?: string;
  items: Record<string, string>;
};

/** The few things a request needs before it can be sent, worded for anyone. */
export function checkDraft(input: {
  title: string;
  purpose: string;
  provision: Provision | "";
  departmentId: string;
  items: ItemDraft[];
  /** Items listed one by one, rather than a single amount. */
  itemised: boolean;
}): DraftErrors | null {
  const errors: DraftErrors = { items: input.itemised ? itemErrors(input.items) : {} };
  if (input.title.trim().length < 2) errors.title = "Say what you need.";
  if (input.purpose.trim().length < 2) errors.purpose = "Say why you need it.";
  if (!input.provision) errors.provision = "Choose how you'd like it.";
  if (!input.departmentId) errors.department = "Choose a department.";
  // A provided item needs no amount; an estimate helps.
  const total = input.items.reduce((sum, i) => sum + lineTotal(i), 0);
  if (input.provision !== "provide") {
    if (!input.itemised && total <= 0) errors.amount = "Enter how much it will cost.";
    if (input.itemised && !input.items.length) errors.amount = "Add at least one item.";
  }
  const clean =
    !errors.title &&
    !errors.purpose &&
    !errors.provision &&
    !errors.department &&
    !errors.amount &&
    !Object.keys(errors.items).length;
  return clean ? null : errors;
}
