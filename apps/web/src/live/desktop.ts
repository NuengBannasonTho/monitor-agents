import type { DesktopPatch } from '@agent-office/shared';

/** Changes the desktop setting; the server tells every page (and the desktop app) the outcome. */
async function patchDesktop(patch: DesktopPatch): Promise<boolean> {
  try {
    const response = await fetch('/api/desktop', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** Turns all the bananas on the desktop on or off. */
export function setDesktopWalkers(walkers: boolean): Promise<boolean> {
  return patchDesktop({ walkers });
}

/** Keeps one agent's banana off the desktop, or lets it back on. */
export function setAgentHidden(id: string, hidden: boolean): Promise<boolean> {
  return patchDesktop({ agent: { id, hidden } });
}
