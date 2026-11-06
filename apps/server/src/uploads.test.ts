import { mkdtemp, readFile, rm, stat, utimes } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  UPLOAD_MAX_AGE_MS,
  UploadTooLarge,
  messageWithFiles,
  pruneUploads,
  safeFileName,
  saveUploads,
} from './uploads.js';

let root: string;
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'uploads-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const b64 = (text: string) => Buffer.from(text).toString('base64');

describe('uploads', () => {
  it('keeps names safe on disk and in an @path', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('Screen Shot 2026-11-05 at 10.00.png')).toBe(
      'Screen-Shot-2026-11-05-at-10.00.png',
    );
    expect(safeFileName('รายงาน ไตรมาส.pdf')).toBe('รายงาน-ไตรมาส.pdf');
    expect(safeFileName('.env')).toBe('env');
    expect(safeFileName('////')).toBe('file');
  });

  it('saves each file in a private folder, keeping both of two same-named files', async () => {
    const paths = await saveUploads(root, 'sess-1', [
      { name: 'a.txt', type: 'text/plain', data: b64('one') },
      { name: 'a.txt', type: 'text/plain', data: b64('two') },
    ]);
    expect(paths.map((p) => path.basename(p))).toEqual(['a.txt', 'a-2.txt']);
    expect(paths.every((p) => p.startsWith(path.join(root, 'sess-1')))).toBe(true);
    expect(await readFile(paths[1] ?? '', 'utf8')).toBe('two');
    expect((await stat(paths[0] ?? '')).mode & 0o777).toBe(0o600);
  });

  it('refuses an empty file', async () => {
    await expect(saveUploads(root, 's', [{ name: 'x', type: '', data: '' }])).rejects.toThrow(
      UploadTooLarge,
    );
  });

  it('points the agent at the files after the text', () => {
    expect(messageWithFiles('Fix this', ['/u/a.png'])).toBe('Fix this\n\n@/u/a.png');
    expect(messageWithFiles('', ['/u/a.png', '/u/b.pdf'])).toBe(
      'Have a look at these files: @/u/a.png @/u/b.pdf',
    );
    expect(messageWithFiles('Just text', [])).toBe('Just text');
  });

  it('clears uploads older than a week', async () => {
    const [kept] = await saveUploads(root, 's', [{ name: 'new.txt', type: '', data: b64('n') }]);
    const [old] = await saveUploads(root, 's', [{ name: 'old.txt', type: '', data: b64('o') }]);
    const oldDir = path.dirname(old ?? '');
    const longAgo = new Date(Date.now() - UPLOAD_MAX_AGE_MS - 60_000);
    await utimes(oldDir, longAgo, longAgo);
    await pruneUploads(root);
    await expect(stat(oldDir)).rejects.toThrow();
    expect((await stat(kept ?? '')).isFile()).toBe(true);
  });
});
