import { AssistantChatResponseSchema } from '@agent-office/shared';
import type { AssistantChatRequest, AssistantChatResponse } from '@agent-office/shared';
import type { Result } from './customAgents';

/** One planning turn. Starting work uses the existing task endpoint after review. */
export async function askAssistant(
  body: AssistantChatRequest,
): Promise<Result<AssistantChatResponse>> {
  try {
    const response = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await response.json()) as unknown;
    if (!response.ok) {
      const error =
        typeof json === 'object' && json !== null && 'error' in json ? json.error : null;
      return {
        ok: false,
        error: typeof error === 'string' ? error : 'The assistant could not answer.',
      };
    }
    const parsed = AssistantChatResponseSchema.safeParse(json);
    return parsed.success
      ? { ok: true, value: parsed.data }
      : { ok: false, error: 'The assistant returned an unreadable answer.' };
  } catch {
    return { ok: false, error: 'The server is not reachable.' };
  }
}
