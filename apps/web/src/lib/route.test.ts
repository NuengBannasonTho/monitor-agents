import { describe, expect, it } from 'vitest';
import { parseRoute } from './route';

describe('parseRoute', () => {
  it('reads the page and, on settings, its section', () => {
    expect(parseRoute('')).toEqual({ page: 'office', section: null });
    expect(parseRoute('?page=agents&section=needs-you')).toEqual({
      page: 'agents',
      section: 'needs-you',
    });
    expect(parseRoute('?page=new-task&section=x')).toEqual({ page: 'new-task', section: null });
    expect(parseRoute('?page=custom-agents')).toEqual({ page: 'custom-agents', section: null });
    expect(parseRoute('?page=new-task')).toEqual({ page: 'new-task', section: null });
    expect(parseRoute('?page=settings&section=desktop')).toEqual({
      page: 'settings',
      section: 'desktop',
    });
  });

  it('falls back to the office for an unknown page, and reads the old ?settings=', () => {
    expect(parseRoute('?page=nope&mock')).toEqual({ page: 'office', section: null });
    expect(parseRoute('?settings=work-hours')).toEqual({ page: 'settings', section: 'work-hours' });
  });
});
