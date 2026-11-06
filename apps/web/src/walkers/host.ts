/** What the desktop app (apps/desktop) lends the walkers page; absent in a normal browser. */
interface WalkersHost {
  /** True lets clicks fall through to the apps underneath; false catches them. */
  setClickThrough(through: boolean): void;
  /** Opens the dashboard in your browser, at this agent. */
  openAgent(agentId: string): void;
  /** Shows or hides the whole strip (hidden, it draws nothing at all). */
  setShown(shown: boolean): void;
  /** Called when "Show walkers" is picked in the 🍌 menu; returns an unsubscribe. */
  onToggle(callback: () => void): () => void;
}

declare global {
  interface Window {
    readonly walkersHost?: WalkersHost;
  }
}

export function walkersHost(): WalkersHost | undefined {
  return window.walkersHost;
}

/** Opens an agent's details: through the desktop app, or in a new tab when previewing. */
export function openAgent(agentId: string): void {
  const host = walkersHost();
  if (host !== undefined) host.openAgent(agentId);
  else window.open(`/?agent=${encodeURIComponent(agentId)}`, '_blank', 'noopener');
}
