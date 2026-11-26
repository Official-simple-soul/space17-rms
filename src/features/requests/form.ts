import { answerErrors, type Answers } from "@/features/templates/answers";
import type { TemplateField } from "@/features/templates/schema";
import { itemErrors, type ItemDraft } from "@/lib/line-items";

export type DraftErrors = {
  title?: string;
  purpose?: string;
  category?: string;
  department?: string;
  items: Record<string, string>;
  answers: Record<string, string>;
};

export function checkDraft(input: {
  title: string;
  purpose: string;
  categoryId: string;
  departmentId: string;
  items: ItemDraft[];
  fields: TemplateField[];
  answers: Answers;
  files: (string | null)[];
}): DraftErrors | null {
  const errors: DraftErrors = {
    items: itemErrors(input.items),
    answers: answerErrors(input.fields, input.answers, input.files),
  };
  if (input.title.trim().length < 3) errors.title = "Enter a title of at least 3 characters.";
  if (input.purpose.trim().length < 5) errors.purpose = "Say what this is for.";
  if (!input.categoryId) errors.category = "Choose a category.";
  if (!input.departmentId) errors.department = "Choose a department.";
  const clean =
    !errors.title &&
    !errors.purpose &&
    !errors.category &&
    !errors.department &&
    !Object.keys(errors.items).length &&
    !Object.keys(errors.answers).length;
  return clean ? null : errors;
}
