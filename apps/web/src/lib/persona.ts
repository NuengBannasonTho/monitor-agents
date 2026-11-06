import { AssistantPersonaSchema, DEFAULT_PERSONA, isRecord } from '@agent-office/shared';
import type { AssistantPersona } from '@agent-office/shared';
import { useSyncExternalStore } from 'react';

/** MON MANG's personality, kept in this browser and sent with every message. */
const STORAGE_KEY = 'agent-office:assistant-persona:v1';

const listeners = new Set<() => void>();

function read(): AssistantPersona {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_PERSONA;
    const stored: unknown = JSON.parse(raw);
    const parsed = AssistantPersonaSchema.safeParse({
      ...DEFAULT_PERSONA,
      ...(isRecord(stored) ? stored : {}),
    });
    return parsed.success ? parsed.data : DEFAULT_PERSONA;
  } catch {
    return DEFAULT_PERSONA;
  }
}

let current: AssistantPersona = typeof window === 'undefined' ? DEFAULT_PERSONA : read();

export function getPersona(): AssistantPersona {
  return current;
}

/** Changes some of it; anything that would not be valid is left as it was. */
export function setPersona(patch: Partial<AssistantPersona>): AssistantPersona {
  const parsed = AssistantPersonaSchema.safeParse({ ...current, ...patch });
  if (!parsed.success) return current;
  current = parsed.data;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage unavailable: the change lasts for this tab.
  }
  for (const listener of listeners) listener();
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePersona(): AssistantPersona {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => DEFAULT_PERSONA,
  );
}
