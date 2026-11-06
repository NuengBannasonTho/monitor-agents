export type SendResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

async function post(url: string, body?: unknown): Promise<SendResult> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    if (response.ok) return { ok: true };
    const reply = (await response.json().catch(() => ({}))) as { error?: unknown };
    return {
      ok: false,
      error:
        typeof reply.error === 'string'
          ? reply.error
          : response.status === 404
            ? 'Restart the server (pnpm start) to type to agents from here.'
            : 'Could not send it.',
    };
  } catch {
    return { ok: false, error: 'The server is not reachable.' };
  }
}

/** A file's bytes as base64, for the trip to the server. */
function base64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = typeof reader.result === 'string' ? reader.result : '';
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('could not read the file'));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Types a message to an agent in its Orca terminal (through the server), with any files:
 * the server saves them and the message points the agent at them.
 */
export async function sendToAgent(
  agentId: string,
  text: string,
  files: readonly File[] = [],
): Promise<SendResult> {
  let encoded: { name: string; type: string; data: string }[];
  try {
    encoded = await Promise.all(
      files.map(async (f) => ({ name: f.name, type: f.type, data: await base64(f) })),
    );
  } catch {
    return { ok: false, error: 'Could not read one of the files.' };
  }
  return post(`/api/agents/${encodeURIComponent(agentId)}/send`, { text, files: encoded });
}

/** Stops what the agent is doing, like pressing Esc in its terminal. */
export function interruptAgent(agentId: string): Promise<SendResult> {
  return post(`/api/agents/${encodeURIComponent(agentId)}/interrupt`);
}
