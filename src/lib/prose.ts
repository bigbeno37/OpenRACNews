// Agents write plain text, not Markdown or HTML: everything they write is built from text that anyone
// can put in a commit message or pull request title, so nothing they write may turn into markup. The
// only structure is blank lines between paragraphs, `code` spans, and #123 / repo#123 references.

export type ProseToken =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'ref'; text: string; repo: string | null; number: number };

const INLINE = /`([^`\n]+)`|(?<![\w#])(?:([A-Za-z][\w.-]*))?#(\d+)\b/g;

export function tokenize(text: string): ProseToken[] {
  const tokens: ProseToken[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) tokens.push({ kind: 'text', text: text.slice(last, match.index) });
    if (match[1] !== undefined) tokens.push({ kind: 'code', text: match[1] });
    else tokens.push({ kind: 'ref', text: match[0], repo: match[2] ?? null, number: Number(match[3]) });
    last = match.index + match[0].length;
  }
  if (last < text.length) tokens.push({ kind: 'text', text: text.slice(last) });
  return tokens;
}

export const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/** Plain text as HTML paragraphs, for feeds: a reader treats an RSS description as HTML, so it must be escaped. */
export function toEscapedHtml(text: string): string {
  const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return paragraphs(text)
    .map((paragraph) => `<p>${escape(paragraph)}</p>`)
    .join('');
}

/** Every #123 / repo#123 outside code spans. */
export function referencesIn(text: string) {
  return tokenize(text).flatMap((token) => (token.kind === 'ref' ? [{ repo: token.repo, number: token.number }] : []));
}
