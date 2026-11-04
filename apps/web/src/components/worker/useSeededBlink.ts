import { useEffect, useState } from 'react';
import { hashString, seededRandom } from '../../lib/seed';

const MIN_INTERVAL_MS = 3000;
const MAX_INTERVAL_MS = 6000;
const BLINK_MS = 140;

/**
 * Returns true while the eyes are closed. Intervals are random in [3 s, 6 s] but
 * driven by a PRNG seeded from `seed`, so each agent has its own stable rhythm.
 */
export function useSeededBlink(seed: string, enabled: boolean): boolean {
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const next = seededRandom(hashString(`blink:${seed}`));
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (): void => {
      const wait = MIN_INTERVAL_MS + next() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
      timer = setTimeout(() => {
        setClosed(true);
        timer = setTimeout(() => {
          setClosed(false);
          schedule();
        }, BLINK_MS);
      }, wait);
    };

    schedule();
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      setClosed(false);
    };
  }, [seed, enabled]);

  return enabled && closed;
}
