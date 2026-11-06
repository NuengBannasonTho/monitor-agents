import { AnimateUIProvider } from '@animate-ui/react/provider';
import type { CustomAgent } from '@agent-office/shared';
import { Tooltip } from '@animate-ui/react/primitives/radix-ui/tooltip';
import { MotionConfig } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './App.module.css';
import { Gallery } from './components/gallery/Gallery';
import { AgentsPage } from './components/agents/AgentsPage';
import { CustomAgentsPage } from './components/customAgents/CustomAgentsPage';
import { Office } from './components/office/Office';
import { AssistantsDialog } from './components/office/AssistantsDialog';
import { AssistantPage } from './components/assistant/AssistantPage';
import { AgentPanel } from './components/panel/AgentPanel';
import { SettingsPage } from './components/settings/SettingsPage';
import { NewTaskPage } from './components/tasks/NewTaskPage';
import { UsagePage } from './components/usage/UsagePage';
import { Sidebar } from './components/sidebar/Sidebar';
import { navigate, useRoute } from './lib/route';
import { CustomAgentsIcon, NewTaskIcon } from './components/icons';
import { Button } from './components/ui/Button';
import { Page } from './components/ui/Page';
import { SkinProvider } from './skins/SkinContext';
import { useNeedsYouSound } from './sound/useNeedsYouSound';
import { unseenFinished, waitingOnYou } from './live/attention';
import { useAgentStream } from './live/useAgentStream';
import { fetchCustomAgents } from './live/customAgents';
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
  // /?page=… picks what fills the space beside the sidebar; none is the office.
  const route = useRoute();
  const [showAssistants, setShowAssistants] = useState(false);
  const [helpers, setHelpers] = useState<readonly CustomAgent[]>([]);
  useEffect(() => {
    if (route.page !== 'office' || USE_SIMULATOR) return;
    let live = true;
    const refresh = () => {
      void fetchCustomAgents().then((result) => {
        if (live && result.ok)
          setHelpers(result.value.agents.filter((agent) => agent.problem === null));
      });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      live = false;
      window.removeEventListener('focus', refresh);
    };
  }, [route.page]);
  // /?agent=<id> (from a banana on the desktop) opens straight to that agent.
  const [selectedId, setSelectedId] = useState<string | null>(() => params.get('agent'));

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
              <Sidebar
                agents={agents}
                waiting={waiting}
                finished={finished}
                onOpen={open}
                source={source}
              />
              <main className={styles.main}>
                {SHOW_GALLERY ? (
                  <Gallery />
                ) : route.page === 'assistant' ? (
                  <AssistantPage
                    preview={USE_SIMULATOR}
                    agents={agents}
                    onOpen={open}
                    sound={sound}
                    alerts={alerts}
                  />
                ) : route.page === 'settings' ? (
                  <SettingsPage
                    section={route.section}
                    sound={sound}
                    alerts={alerts}
                    desktop={USE_SIMULATOR ? null : stream.desktop}
                    agents={agents}
                  />
                ) : route.page === 'agents' ? (
                  <AgentsPage
                    agents={agents}
                    filter={route.section}
                    selectedId={selected?.id ?? null}
                    finishedIds={finishedIds}
                    onOpen={open}
                  />
                ) : route.page === 'usage' ? (
                  <UsagePage
                    section={route.section}
                    agents={agents}
                    onOpen={open}
                    preview={USE_SIMULATOR}
                  />
                ) : route.page === 'new-task' ? (
                  <NewTaskPage preview={USE_SIMULATOR} helper={route.helper} />
                ) : route.page === 'custom-agents' ? (
                  <CustomAgentsPage preview={USE_SIMULATOR} />
                ) : (
                  <Page
                    trail={['Office']}
                    fill
                    actions={
                      <>
                        <Button
                          size="sm"
                          icon={<CustomAgentsIcon size={16} />}
                          onClick={() => {
                            setShowAssistants(true);
                          }}
                        >
                          Assistants
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={<NewTaskIcon size={16} />}
                          onClick={() => {
                            navigate('new-task');
                          }}
                        >
                          New task
                        </Button>
                      </>
                    }
                  >
                    <Office
                      agents={agents}
                      selectedId={selected?.id ?? null}
                      finishedIds={finishedIds}
                      waiting={waiting}
                      onSelect={toggleSelect}
                      onOpen={open}
                    />
                    {showAssistants && (
                      <AssistantsDialog
                        helpers={helpers}
                        onClose={() => {
                          setShowAssistants(false);
                        }}
                        onAssignHelper={(helper) => {
                          setShowAssistants(false);
                          navigate('new-task', null, `${helper.scope}\n${helper.file}`);
                        }}
                        onAssignProvider={(provider) => {
                          setShowAssistants(false);
                          navigate('new-task', null, `@provider:${provider}`);
                        }}
                      />
                    )}
                  </Page>
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
