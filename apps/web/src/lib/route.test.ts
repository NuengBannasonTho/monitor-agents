import { describe, expect, it } from 'vitest';
import { parseRoute } from './route';

describe('parseRoute', () => {
  it('reads the page and, on settings, its section', () => {
    expect(parseRoute('')).toEqual({
      page: 'assistant',
      section: null,
      helper: null,
    });
    expect(parseRoute('?page=office')).toEqual({
      page: 'office',
      section: null,
      helper: null,
    });
    expect(parseRoute('?page=agents&section=needs-you')).toEqual({
      page: 'agents',
      section: 'needs-you',
      helper: null,
    });
    expect(parseRoute('?page=new-task&section=x')).toEqual({
      page: 'new-task',
      section: null,
      helper: null,
    });
    expect(parseRoute('?page=custom-agents')).toEqual({
      page: 'custom-agents',
      section: null,
      helper: null,
    });
    expect(parseRoute('?page=new-task')).toEqual({
      page: 'new-task',
      section: null,
      helper: null,
    });
    expect(parseRoute('?page=new-task&helper=user%0Areviewer.md')).toEqual({
      page: 'new-task',
      section: null,
      helper: 'user\nreviewer.md',
    });
    expect(parseRoute('?page=settings&section=desktop')).toEqual({
      page: 'settings',
      section: 'desktop',
      helper: null,
    });
  });

  it('falls back to MON MANG for an unknown page, and reads the old ?settings=', () => {
    expect(parseRoute('?page=nope&mock')).toEqual({
      page: 'assistant',
      section: null,
      helper: null,
    });
    expect(parseRoute('?settings=work-hours')).toEqual({
      page: 'settings',
      section: 'work-hours',
      helper: null,
    });
  });
});
