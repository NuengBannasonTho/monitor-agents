import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, loadPrefs, savePrefs, withCostume, withMode } from './prefs';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}

describe('skin prefs', () => {
  it('defaults when storage is empty, missing, corrupt or throwing', () => {
    expect(loadPrefs(memoryStorage())).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(undefined)).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(memoryStorage({ 'agent-office:skin-prefs:v1': '{oops' }))).toEqual(
      DEFAULT_PREFS,
    );
    expect(
      loadPrefs({
        getItem: () => {
          throw new Error('SecurityError');
        },
      }),
    ).toEqual(DEFAULT_PREFS);
  });

  it('round-trips through storage', () => {
    const storage = memoryStorage();
    const prefs = withCostume(withMode(DEFAULT_PREFS, 'by-agent'), 'feat-auth', 'ninja');
    savePrefs(storage, prefs);
    expect(loadPrefs(storage)).toEqual(prefs);
  });

  it('clears a costume with null', () => {
    const p = withCostume(withCostume(DEFAULT_PREFS, 'a', 'king'), 'a', null);
    expect(p.costumeByDesk).toEqual({});
  });

  it('never throws when saving fails', () => {
    expect(() => {
      savePrefs(
        {
          setItem: () => {
            throw new Error('QuotaExceeded');
          },
        },
        DEFAULT_PREFS,
      );
    }).not.toThrow();
  });
});
