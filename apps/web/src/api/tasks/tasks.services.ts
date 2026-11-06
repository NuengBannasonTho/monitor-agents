import { TaskPlacesSchema } from '@agent-office/shared';
import type { StartTask, TaskPlaces } from '@agent-office/shared';
import type { Result } from '../../types/result/result.types';

const OLD_SERVER = 'Restart the server (pnpm start) to start agents from here.';

/** Orca's repos and worktrees, where a task can run. */
export async function fetchTaskPlaces(): Promise<Result<TaskPlaces>> {
  try {
    const response = await fetch('/api/tasks/places');
    if (!response.ok) return { ok: false, error: OLD_SERVER };
    const parsed = TaskPlacesSchema.safeParse(await response.json());
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: OLD_SERVER };
  } catch {
    return { ok: false, error: 'The server is not reachable.' };
  }
}

/** Starts Claude Code on the task; where it went (the worktree's name). */
export async function startTask(body: StartTask): Promise<Result<string>> {
  try {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const reply = (await response.json().catch(() => ({}))) as { error?: unknown; where?: unknown };
    if (!response.ok) {
      return {
        ok: false,
        error:
          typeof reply.error === 'string'
            ? reply.error
            : response.status === 404
              ? OLD_SERVER
              : 'Could not start it.',
      };
    }
    return { ok: true, value: typeof reply.where === 'string' ? reply.where : '' };
  } catch {
    return { ok: false, error: 'The server is not reachable.' };
  }
}
