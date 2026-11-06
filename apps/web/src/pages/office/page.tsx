import type { Agent, CustomAgent } from '@agent-office/shared';
import { useEffect, useState } from 'react';
import { fetchCustomAgents } from '../../api/custom-agents/custom-agents.services';
import { CustomAgentsIcon, NewTaskIcon } from '../../components/icons';
import { AssistantsDialog } from '../../components/office/assistants-dialog';
import { Office } from '../../components/office/office';
import { Button } from '../../components/ui/button';
import { Page } from '../../components/ui/page';
import { navigate } from '../../lib/route';

export interface OfficePageProps {
  readonly agents: readonly Agent[];
  readonly selectedId: string | null;
  /** Agents whose finished turn you have not opened yet. */
  readonly finishedIds: ReadonlySet<string>;
  /** Agents waiting on you, longest wait first. */
  readonly waiting: readonly Agent[];
  readonly onSelect: (id: string) => void;
  readonly onOpen: (id: string) => void;
  /** No server: saved helpers are not fetched. */
  readonly preview: boolean;
}

/**
 * The pixel office: busy agents at their desks, waiting ones at Base Camp. Assistants picks
 * a saved helper (or Claude Code, Codex) for a new task.
 */
export function OfficePage({
  agents,
  selectedId,
  finishedIds,
  waiting,
  onSelect,
  onOpen,
  preview,
}: OfficePageProps): React.JSX.Element {
  const [showAssistants, setShowAssistants] = useState(false);
  const [helpers, setHelpers] = useState<readonly CustomAgent[]>([]);

  useEffect(() => {
    if (preview) return;
    let live = true;
    const handleRefresh = (): void => {
      void fetchCustomAgents().then((result) => {
        if (live && result.ok)
          setHelpers(result.value.agents.filter((agent) => agent.problem === null));
      });
    };
    handleRefresh();
    window.addEventListener('focus', handleRefresh);
    return () => {
      live = false;
      window.removeEventListener('focus', handleRefresh);
    };
  }, [preview]);

  return (
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
        selectedId={selectedId}
        finishedIds={finishedIds}
        waiting={waiting}
        onSelect={onSelect}
        onOpen={onOpen}
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
  );
}
