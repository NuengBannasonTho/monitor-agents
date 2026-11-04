import type { Agent } from '@agent-office/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { enteredNeedsYou } from './needsYou';

const STORAGE_KEY = 'agent-office:sound:v1';
const MIN_GAP_MS = 2_000;

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeEnabled(value: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
  } catch {
    // Storage unavailable: the toggle still works for this tab.
  }
}

/** Two short soft tones, generated on the fly (no audio files, no network). */
function chime(ctx: AudioContext): void {
  const start = ctx.currentTime;
  [880, 1174.66].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = start + i * 0.14;
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  });
}

/**
 * Optional chime when an agent starts waiting on you. Off by default. The audio
 * context is created from the toggle click, since browsers only allow sound
 * after a user gesture.
 */
export function useNeedsYouSound(agents: readonly Agent[]): {
  readonly enabled: boolean;
  readonly setEnabled: (value: boolean) => void;
} {
  const [enabled, setEnabledState] = useState(readEnabled);
  const ctxRef = useRef<AudioContext | null>(null);
  const previous = useRef<ReadonlySet<string> | null>(null);
  const lastPlayed = useRef(0);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    writeEnabled(value);
    if (value) {
      ctxRef.current ??= new AudioContext();
      void ctxRef.current.resume();
      chime(ctxRef.current); // audible confirmation
      lastPlayed.current = Date.now();
    }
  }, []);

  useEffect(() => {
    const { current, entered } = enteredNeedsYou(previous.current ?? new Set(), agents);
    const isFirstSnapshot = previous.current === null;
    previous.current = current;
    if (isFirstSnapshot || !enabled || entered.length === 0) return;
    const now = Date.now();
    if (now - lastPlayed.current < MIN_GAP_MS) return;
    // A remembered "on" from a previous visit needs one click on the page before
    // the browser lets the context start; resume() is a no-op until then.
    ctxRef.current ??= new AudioContext();
    void ctxRef.current.resume();
    chime(ctxRef.current);
    lastPlayed.current = now;
  }, [agents, enabled]);

  useEffect(
    () => () => {
      void ctxRef.current?.close();
    },
    [],
  );

  return { enabled, setEnabled };
}
