import { CustomAgentListSchema, CustomAgentSchema } from '@agent-office/shared';
import type {
  CustomAgent,
  CustomAgentList,
  DeleteCustomAgent,
  SaveCustomAgent,
} from '@agent-office/shared';

export type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

const OLD_SERVER = 'Restart the server (pnpm start) to manage custom agents from here.';

async function errorOf(response: Response, fallback: string): Promise<string> {
  const reply = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (typeof reply.error === 'string') return reply.error;
  return response.status === 404 ? OLD_SERVER : fallback;
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
    const reply = (await response.json()) as { agent?: unknown };
    const parsed = CustomAgentSchema.safeParse(reply.agent);
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
    const reply = (await response.json()) as { trashedTo?: unknown };
    return { ok: true, value: typeof reply.trashedTo === 'string' ? reply.trashedTo : '' };
  } catch {
    return { ok: false, error: 'The server is not reachable.' };
  }
}
