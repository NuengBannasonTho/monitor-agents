import { AssistantChatResponseSchema, stringField } from '@agent-office/shared';
import type { AssistantChatRequest, AssistantChatResponse } from '@agent-office/shared';
import type { Result } from '../../types/result/result.types';

/**
 * One answer from MON MANG; the dashboard carries out its actions. Aborting the signal drops
 * the answer (and the server stops working on it).
 */
export async function askAssistant(
  body: AssistantChatRequest,
  signal?: AbortSignal,
): Promise<Result<AssistantChatResponse>> {
  try {
    const response = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      ...(signal === undefined ? {} : { signal }),
    });
    const json: unknown = await response.json();
    if (!response.ok) {
      return { ok: false, error: stringField(json, 'error') ?? 'The assistant could not answer.' };
    }
    const parsed = AssistantChatResponseSchema.safeParse(json);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, error: 'The assistant returned an unreadable answer.' };
  } catch {
    return { ok: false, error: 'The server is not reachable.' };
  }
}
