import { describe, expect, it } from 'vitest';
import { loadConfig, withLocalNames } from './config.js';

describe('withLocalNames', () => {
  it('allows both names of this machine', () => {
    expect(withLocalNames('http://127.0.0.1:4778')).toEqual([
      'http://127.0.0.1:4778',
      'http://localhost:4778',
    ]);
    expect(withLocalNames('http://localhost:4778/')).toEqual([
      'http://localhost:4778',
      'http://127.0.0.1:4778',
    ]);
  });

  it('leaves any other host alone', () => {
    expect(withLocalNames('http://example.test:4778')).toEqual(['http://example.test:4778']);
  });
});

describe('loadConfig', () => {
  it('lets the dev server in under either name', () => {
    const config = loadConfig({ AGENT_OFFICE_DEV_ORIGIN: 'http://127.0.0.1:4778' });
    expect(config.allowedOrigins).toEqual([
      'http://127.0.0.1:4777',
      'http://localhost:4777',
      'http://127.0.0.1:4778',
      'http://localhost:4778',
    ]);
  });
});
