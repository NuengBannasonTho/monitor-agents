import {
  CustomAgentListSchema,
  CustomAgentSchema,
  isRecord,
  stringField,
} from '@agent-office/shared';
import type {
  CustomAgent,
  CustomAgentList,
  DeleteCustomAgent,
  SaveCustomAgent,
} from '@agent-office/shared';
import type { Result } from '../../types/result/result.types';

const OLD_SERVER = 'Restart the server (pnpm start) to manage custom agents from here.';

async function errorOf(response: Response, fallback: string): Promise<string> {
  const reply: unknown = await response.json().catch(() => null);
  return stringField(reply, 'error') ?? (response.status === 404 ? OLD_SERVER : fallback);
}

/** Your agents and those of every project an agent is working in. */
export async function fetchCustomAgents(): Promise<Result<CustomAgentList>> {
  try {
    const response = await fetch('/api/custom-agents');
    if (!response.ok) return { ok: false, error: await errorOf(response, 'Could not load them.') };
    const parsed = CustomAgentListSchema.safeParse(await response.json());
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: OLD_SERVER };
  } catch {
    return { ok: false, error: 'The server is not reachable.' };
  }
}

/** Creates (no file) or updates an agent file; the agent as saved. */
export async function saveCustomAgent(body: SaveCustomAgent): Promise<Result<CustomAgent>> {
  try {
    const response = await fetch('/api/custom-agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return { ok: false, error: await errorOf(response, 'Could not save it.') };
    const reply: unknown = await response.json();
    const parsed = CustomAgentSchema.safeParse(isRecord(reply) ? reply.agent : undefined);
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: OLD_SERVER };
  } catch {
    return { ok: false, error: 'The server is not reachable.' };
  }
}

/** Moves an agent file to the trash; where it went. */
export async function deleteCustomAgent(body: DeleteCustomAgent): Promise<Result<string>> {
  try {
    const response = await fetch('/api/custom-agents', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return { ok: false, error: await errorOf(response, 'Could not delete it.') };
    const reply: unknown = await response.json();
    return { ok: true, value: stringField(reply, 'trashedTo') ?? '' };
  } catch {
    return { ok: false, error: 'The server is not reachable.' };
  }
}
