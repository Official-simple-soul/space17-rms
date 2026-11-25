import { z } from "zod";
import { password } from "@/features/auth";

const name = z.string().trim().min(2, "Enter at least 2 characters.").max(120);
export const token = z.string().regex(/^[a-f0-9]{64}$/);
export const registerSchema = z.object({ token, fullName: name, password });
export const acceptSchema = z.object({
  token,
  name,
  slug: z
    .string()
    .trim()
    .min(3, "Use at least 3 characters.")
    .max(48)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single hyphens."),
});
export const organisationSchema = z.object({
  orgId: z.uuid(),
  slug: z.string(),
  name,
  timezone: z.string().min(1),
  fiscalMonth: z.coerce.number().int().min(1).max(12),
});
export const accessRequestSchema = z.object({
  orgName: name,
  contactName: name,
  email: z.email("Enter a valid email address.").max(254),
  message: z.string().trim().max(1000).default(""),
  website: z.string().optional(),
});
