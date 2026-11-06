import type { AssistantAction, AssistantPersona } from '@agent-office/shared';
import { setPersona } from '../../lib/persona';
import type { Page } from '../../lib/route';
import { navigate } from '../../lib/route';
import { setThemeChoice } from '../../lib/theme';
import { saveCustomAgent } from '../../api/custom-agents/custom-agents.services';
import { setDesktopWalkers } from '../../api/desktop/desktop.services';
import { interruptAgent, sendToAgent } from '../../api/agents/agents.services';

/** What became of an action; kept with the message, so a reload shows it too. */
export interface Outcome {
  readonly ok: boolean;
  readonly note: string;
}

/** What the page lends the actions that change it. */
export interface ActionDeps {
  readonly onOpen: (id: string) => void;
  readonly setSound: (on: boolean) => void;
  readonly setAlerts: (on: boolean) => void;
}

export const PAGE_LABEL: Readonly<Record<Page, string>> = {
  assistant: 'MON MANG',
  office: 'Office',
  agents: 'Agents',
  'new-task': 'New task',
  usage: 'Usage',
  'custom-agents': 'Custom agents',
  settings: 'Settings',
};

export const SWITCH_LABEL = {
  sound: 'Sound',
  alerts: 'Desktop alerts',
  walkers: 'Bananas on the desktop',
} as const;

const done = (note: string): Outcome => ({ ok: true, note });
const failed = (note: string): Outcome => ({ ok: false, note });

/** The fields a persona action sets (null keeps what is there). */
export function personaPatch(
  action: Extract<AssistantAction, { type: 'persona' }>,
): Partial<AssistantPersona> {
  const patch: Partial<AssistantPersona> = {};
  if (action.style !== null) patch.style = action.style;
  if (action.voice !== null) patch.voice = action.voice;
  if (action.language !== null) patch.language = action.language;
  if (action.emoji !== null) patch.emoji = action.emoji;
  if (action.callMe !== null) patch.callMe = action.callMe;
  if (action.notes !== null) patch.notes = action.notes;
  if (action.color !== null) patch.color = action.color;
  return patch;
}

/** Carries out every action but starting a task (its card picks where first). */
export async function runAction(action: AssistantAction, deps: ActionDeps): Promise<Outcome> {
  switch (action.type) {
    case 'theme':
      setThemeChoice(action.theme);
      return done(
        action.theme === 'system' ? 'Following the system theme' : `Switched to ${action.theme}`,
      );
    case 'switch': {
      const label = SWITCH_LABEL[action.setting];
      if (action.setting === 'sound') deps.setSound(action.on);
      else if (action.setting === 'alerts') deps.setAlerts(action.on);
      else if (!(await setDesktopWalkers(action.on)))
        return failed('The server did not take the change.');
      return done(`${label} ${action.on ? 'on' : 'off'}`);
    }
    case 'persona':
      setPersona(personaPatch(action));
      return done('Personality updated');
    case 'open-agent':
      deps.onOpen(action.agentId);
      return done('Opened');
    case 'open-page':
      navigate(action.page, action.section);
      return done(`Opened ${PAGE_LABEL[action.page]}`);
    case 'send': {
      const result = await sendToAgent(action.agentId, action.text);
      return result.ok ? done('Sent') : failed(result.error);
    }
    case 'stop': {
      const result = await interruptAgent(action.agentId);
      return result.ok ? done('Stopped') : failed(result.error);
    }
    case 'custom-agent': {
      const result = await saveCustomAgent({ scope: 'user', agent: action.agent });
      return result.ok ? done(`Saved as ${result.value.path}`) : failed(result.error);
    }
    case 'start-task':
      return failed('Start it from its card.');
  }
}

/** One line per action for the conversation MON MANG reads back: what became of it. */
export function actionLog(
  actions: readonly AssistantAction[],
  outcomes: Readonly<Record<number, Outcome>> | undefined,
): string {
  return actions
    .map((action, i) => {
      const outcome = outcomes?.[i];
      const state =
        outcome === undefined
          ? 'waiting for the user'
          : outcome.ok
            ? `done (${outcome.note})`
            : `failed (${outcome.note})`;
      return `${action.type}: ${state}`;
    })
    .join('; ');
}
