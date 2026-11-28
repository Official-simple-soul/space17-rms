import { z } from "zod";

export const chatMessage = z.object({
  id: z.number(),
  author: z.string(),
  title: z.string().nullable(),
  mine: z.boolean(),
  body: z.string(),
  question: z.boolean(),
  at: z.string(),
});

/** open: waiting for an answer; answered; resolved (report lines only). */
export const threadStatus = z.enum(["open", "answered", "resolved"]);

export const thread = z.object({ status: threadStatus, messages: z.array(chatMessage) });
export type Thread = z.infer<typeof thread>;

export const messageInput = z.object({
  body: z.string().trim().min(1, "Write a message.").max(2000),
  question: z.literal("on").optional(),
});
