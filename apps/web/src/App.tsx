import { AnimateUIProvider } from '@animate-ui/react/provider';
import { Tooltip } from '@animate-ui/react/primitives/radix-ui/tooltip';
import { MotionConfig } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './App.module.css';
import { Gallery } from './components/gallery/Gallery';
import { Header } from './components/header/Header';
import { Office } from './components/office/Office';
import { AgentPanel } from './components/panel/AgentPanel';
import { SkinProvider } from './skins/SkinContext';
import { useNeedsYouSound } from './sound/useNeedsYouSound';
import { unseenFinished, waitingOnYou } from './live/attention';
import { useAgentStream } from './live/useAgentStream';
import { useDesktopAlerts } from './live/useDesktopAlerts';
import { useSeenFinishes } from './live/useSeenFinishes';
import { useTabBadge } from './live/useTabBadge';
import { mockAgentCountFromUrl, useMockAgents } from './mock/useMockAgents';

const params = new URLSearchParams(window.location.search);
/**
 * Live data from the server by default. The in-browser simulator is only for the
 * static preview: build with VITE_DATA_SOURCE=mock, or open with ?mock / #mock.
 */
const USE_SIMULATOR =
  import.meta.env.VITE_DATA_SOURCE === 'mock' ||
  params.has('mock') ||
  window.location.hash === '#mock';
const MOCK_COUNT = mockAgentCountFromUrl(window.location.search, window.location.hash);
const SHOW_GALLERY = params.has('gallery') || window.location.hash === '#gallery';

export function App() {
  const simulated = useMockAgents(MOCK_COUNT, USE_SIMULATOR);
  const stream = useAgentStream(!USE_SIMULATOR);
  const agents = USE_SIMULATOR ? simulated : stream.agents;
  const source = USE_SIMULATOR ? 'preview' : stream.status;
  const sound = useNeedsYouSound(agents);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // If the selected agent disappears (removed by the sweeper later), the panel closes.
  const selected = useMemo(
    () => (selectedId === null ? null : (agents.find((a) => a.id === selectedId) ?? null)),
    [agents, selectedId],
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedId((current) => (current === id ? null : id));
  }, []);
  const open = useCallback((id: string) => {
    setSelectedId(id);
  }, []);
  const closePanel = useCallback(() => {
    setSelectedId(null);
  }, []);

  // What needs your attention: shown in the header, the tab and desktop notifications.
  const { seen, baseline, markSeen } = useSeenFinishes();
  const waiting = useMemo(() => waitingOnYou(agents), [agents]);
  const finished = useMemo(() => unseenFinished(agents, seen, baseline), [agents, seen, baseline]);
  const finishedIds = useMemo(() => new Set(finished.map((a) => a.id)), [finished]);
  useTabBadge(waiting.length, finished.length);
  const alerts = useDesktopAlerts(agents, open);
  // Opening an agent counts as reading its latest answer.
  useEffect(() => {
    if (selected !== null) markSeen(selected);
  }, [selected, markSeen]);

  return (
    // Both providers read the same `motion` runtime, so one reduced-motion setting covers
    // our own animations and every animate-ui primitive.
    <MotionConfig reducedMotion="user">
      <AnimateUIProvider reducedMotion="user">
        <SkinProvider enabled={!USE_SIMULATOR}>
          <Tooltip.Provider delayDuration={250} skipDelayDuration={150}>
            <div className={styles.app}>
              <Header
                waiting={waiting}
                finished={finished}
                onOpen={open}
                source={source}
                sound={sound}
                alerts={alerts}
              />
              <main className={styles.main}>
                {SHOW_GALLERY ? (
                  <Gallery />
                ) : (
                  <Office
                    agents={agents}
                    selectedId={selected?.id ?? null}
                    finishedIds={finishedIds}
                    waiting={waiting}
                    onSelect={toggleSelect}
                    onOpen={open}
                  />
                )}
              </main>
              <AgentPanel agent={selected} onClose={closePanel} />
            </div>
          </Tooltip.Provider>
        </SkinProvider>
      </AnimateUIProvider>
    </MotionConfig>
  );
}
