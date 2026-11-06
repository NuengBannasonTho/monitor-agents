import { AnimateUIProvider } from '@animate-ui/react/provider';
import { AnimatePresence, MotionConfig } from 'motion/react';
import type { Agent } from '@agent-office/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useElementSize } from '../hooks/use-element-size';
import { setAgentHidden, setDesktopWalkers } from '../api/desktop/desktop.services';
import { useAgentStream } from '../api/agents/agents.hooks';
import { mockAgentCountFromUrl, useMockAgents } from '../mock/use-mock-agents';
import { SkinProvider } from '../skins/skin-context';
import { walkersHost } from './host';
import { openAgent } from './host';
import { Walker } from './walker';
import type { MenuAt } from './walker-menu';
import { WalkerMenu } from './walker-menu';
import styles from './walkers.module.css';

const params = new URLSearchParams(window.location.search);
/** ?walkers&mock walks the simulator's agents, for a look without a server. */
const USE_SIMULATOR = params.has('mock');
const MOCK_COUNT = mockAgentCountFromUrl(window.location.search, window.location.hash);
/** Inside the desktop app (not a browser preview). */
const IN_DESKTOP_APP = walkersHost() !== undefined;

/**
 * Lets clicks fall through the see-through strip to the apps underneath, except over a
 * banana. The desktop app forwards mouse moves even while letting clicks through.
 */
function useClickThrough(): void {
  useEffect(() => {
    const host = walkersHost();
    if (host === undefined) return;
    let through = true;
    const set = (next: boolean): void => {
      if (next === through) return;
      through = next;
      host.setClickThrough(next);
    };
    const onMove = (event: MouseEvent): void => {
      const over = event.target instanceof Element && event.target.closest('[data-walker]');
      set(over === null || over === false);
    };
    const onLeave = (): void => {
      set(true);
    };
    window.addEventListener('mousemove', onMove);
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, []);
}

/**
 * The desktop app keeps this page open for days; when the server comes back after a
 * restart (`pnpm start` rebuilds the web app), reload so it runs the new version.
 */
function useReloadOnServerRestart(status: 'connecting' | 'live' | 'offline'): void {
  const wasLive = useRef(false);
  const lost = useRef(false);
  useEffect(() => {
    if (!IN_DESKTOP_APP) return;
    if (status === 'live') {
      if (wasLive.current && lost.current) window.location.reload();
      wasLive.current = true;
      lost.current = false;
    } else if (status === 'offline' && wasLive.current) {
      lost.current = true;
    }
  }, [status]);
}

/**
 * Whether the bananas are out, as set in the dashboard or the 🍌 menu (kept by the server),
 * and the desktop app's window shown or hidden to match. With a server too old to keep the
 * setting, the 🍌 menu still toggles them here.
 */
function useShown(fromServer: boolean | undefined): {
  readonly shown: boolean;
  readonly hideAll: () => void;
} {
  const [local, setLocal] = useState(true);
  const shown = fromServer ?? local;
  const latest = useRef(shown);
  const serverKnows = fromServer !== undefined;

  useEffect(() => {
    latest.current = shown;
    walkersHost()?.setShown(shown);
  }, [shown]);

  useEffect(() => {
    const host = walkersHost();
    if (host === undefined) return;
    return host.onToggle(() => {
      const next = !latest.current;
      if (serverKnows) void setDesktopWalkers(next);
      else setLocal(next);
    });
  }, [serverKnows]);

  const hideAll = useCallback(() => {
    if (serverKnows) void setDesktopWalkers(false);
    else setLocal(false);
  }, [serverKnows]);

  return { shown, hideAll };
}

/**
 * Agents kept off the desktop (from the dashboard, or right-click → Hide this banana), and a
 * way to hide one. With a server too old to keep the list, they are hidden here only.
 */
function useHidden(fromServer: readonly string[] | undefined): {
  readonly hidden: ReadonlySet<string>;
  readonly hide: (agent: Agent) => void;
} {
  const [local, setLocal] = useState<ReadonlySet<string>>(() => new Set());
  const serverKnows = fromServer !== undefined;
  const hidden = useMemo(
    () => (fromServer === undefined ? local : new Set(fromServer)),
    [fromServer, local],
  );
  const hide = useCallback(
    (agent: Agent) => {
      if (serverKnows) void setAgentHidden(agent.id, true);
      else setLocal((current) => new Set(current).add(agent.id));
    },
    [serverKnows],
  );
  return { hidden, hide };
}

/**
 * The desktop walkers: every agent as a banana walking along the bottom of the screen,
 * busy ones bustling, ones waiting on you standing still with a "!". Shown by the desktop
 * app (apps/desktop) in a see-through strip; open /?walkers in a browser to preview it.
 */
export function Walkers() {
  const simulated = useMockAgents(MOCK_COUNT, USE_SIMULATOR);
  const stream = useAgentStream(!USE_SIMULATOR, IN_DESKTOP_APP ? 'desktop' : undefined);
  const agents = USE_SIMULATOR ? simulated : stream.agents;
  const ref = useRef<HTMLDivElement>(null);
  const size = useElementSize(ref);
  const { shown, hideAll } = useShown(stream.desktop?.walkers);
  useReloadOnServerRestart(stream.status);
  const { hidden, hide } = useHidden(stream.desktop?.hidden);
  const [menu, setMenu] = useState<MenuAt | null>(null);
  const openMenu = useCallback((agent: Agent, x: number, y: number) => {
    setMenu({ agent, x, y });
  }, []);
  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);
  useClickThrough();

  return (
    <MotionConfig reducedMotion="user">
      <AnimateUIProvider reducedMotion="user">
        <SkinProvider enabled={!USE_SIMULATOR}>
          <div ref={ref} className={styles.strip}>
            <AnimatePresence>
              {shown &&
                size !== null &&
                agents
                  .filter((agent) => !hidden.has(agent.id))
                  .map((agent) => (
                    <Walker key={agent.id} agent={agent} width={size.width} onMenu={openMenu} />
                  ))}
            </AnimatePresence>
            {shown && menu !== null && size !== null && (
              <WalkerMenu
                {...menu}
                width={size.width}
                height={size.height}
                onHide={hide}
                onOpen={(agent) => {
                  openAgent(agent.id);
                }}
                onHideAll={hideAll}
                onClose={closeMenu}
              />
            )}
          </div>
        </SkinProvider>
      </AnimateUIProvider>
    </MotionConfig>
  );
}
