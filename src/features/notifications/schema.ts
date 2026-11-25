import { z } from "zod";

const schema = z
  .object({
    number: z.string().nullish(),
    title: z.string(),
    requester: z.string(),
    actor: z.string().nullish(),
  })
  .partial();
export type NotificationPayload = z.infer<typeof schema>;
export const notificationPayload = (value: unknown): NotificationPayload =>
  schema.catch({}).parse(value);
