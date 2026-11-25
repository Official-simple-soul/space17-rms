import { z } from "zod";

const saved = z.object({ id: z.uuid(), version: z.number() });
/** Result of publishing a versioned record. */
export const parseSaved = (value: unknown) => saved.parse(value);

/** Reads JSON sent in a hidden form field; invalid JSON becomes undefined and fails validation. */
export function readJson(value: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(String(value));
  } catch {
    return undefined;
  }
}
