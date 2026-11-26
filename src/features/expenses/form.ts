import { isDate } from "@/lib/data-view";
import { itemErrors, type ItemDraft } from "@/lib/line-items";

export type ExpenseForm = {
  description: string;
  date: string;
  categoryId: string;
  departmentId: string;
  seller: string;
  phone: string;
  noReceipt: boolean;
  reason: string;
  items: ItemDraft[];
  /** Files already uploaded as the vendor's receipt. */
  receipts: number;
};
export type ExpenseErrors = Partial<
  Record<
    | "description"
    | "date"
    | "category"
    | "department"
    | "seller"
    | "phone"
    | "reason"
    | "receipt"
    | "list",
    string
  >
> & { items: Record<string, string> };

/** Mirrors the database's checks so problems show beside the answer; null when ready to submit. */
export function checkExpense(f: ExpenseForm, today: string): ExpenseErrors | null {
  const errors: ExpenseErrors = { items: itemErrors(f.items) };
  if (f.description.trim().length < 3) errors.description = "Say what was bought.";
  if (!isDate(f.date)) errors.date = "Choose the date of purchase.";
  else if (f.date > today) errors.date = "The date can't be in the future.";
  else if (Date.parse(today) - Date.parse(f.date) > 366 * 86_400_000)
    errors.date = "Choose a date within the last year.";
  if (!f.categoryId) errors.category = "Choose a category.";
  if (!f.departmentId) errors.department = "Choose a department.";
  if (f.seller.trim().length < 2) errors.seller = "Say who you bought from.";
  if (f.phone.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(f.phone.trim()))
    errors.phone = "Check the number, or leave it blank.";
  if (!f.items.length) errors.list = "Add at least one item.";
  if (f.noReceipt) {
    if (f.reason.trim().length < 5) errors.reason = "Say why there is no receipt.";
    if (f.receipts) errors.receipt = "Remove the receipt, or choose I have a receipt.";
  } else if (!f.receipts) errors.receipt = "Add the receipt.";
  const clean = Object.keys(errors).length === 1 && !Object.keys(errors.items).length;
  return clean ? null : errors;
}
