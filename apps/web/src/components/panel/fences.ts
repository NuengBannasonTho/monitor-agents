export type Segment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'code'; readonly code: string; readonly lang: string };

const FENCE = /^(`{3,}|~{3,})\s*([\w+#.-]*)[^\n]*$/;

/**
 * Splits Markdown-ish prose into text and fenced code blocks (```lang ... ```). A fence
 * left open (the text was cut short) runs to the end. Blank text between blocks is dropped.
 */
export function splitFences(text: string): Segment[] {
  const segments: Segment[] = [];
  let prose: string[] = [];
  let code: string[] | null = null;
  let fence = '';
  let lang = 'text';

  const flushProse = (): void => {
    const joined = prose.join('\n').trim();
    if (joined !== '') segments.push({ kind: 'text', text: joined });
    prose = [];
  };

  for (const line of text.split('\n')) {
    if (code === null) {
      const open = FENCE.exec(line.trim());
      if (open === null) {
        prose.push(line);
        continue;
      }
      flushProse();
      code = [];
      fence = open[1] ?? '```';
      lang = open[2] === undefined || open[2] === '' ? 'text' : open[2].toLowerCase();
    } else if (line.trim().startsWith(fence) && line.trim().replace(/[`~]/g, '') === '') {
      segments.push({ kind: 'code', code: code.join('\n'), lang });
      code = null;
    } else {
      code.push(line);
    }
  }
  if (code !== null) segments.push({ kind: 'code', code: code.join('\n'), lang });
  flushProse();
  return segments;
}
