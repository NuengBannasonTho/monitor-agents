import { z } from 'zod';
import { OrcaRepoSchema } from './tasks.js';

export const AssistantChatRequestSchema = z.object({
  message: z.string().trim().min(1).max(4_000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4_000),
      }),
    )
    .max(12)
    .default([]),
});
export type AssistantChatRequest = z.infer<typeof AssistantChatRequestSchema>;

export const AssistantChatResponseSchema = z.object({
  reply: z.string().min(1).max(4_000),
  matches: z.array(OrcaRepoSchema).max(8),
  draft: z
    .object({
      task: z.string().min(1).max(20_000),
      provider: z.enum(['claude', 'codex']),
      repoId: z.string().nullable(),
    })
    .nullable(),
});
export type AssistantChatResponse = z.infer<typeof AssistantChatResponseSchema>;
