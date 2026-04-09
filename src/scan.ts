/**
 * Markdown heading scanner — the engine behind every read-path command.
 *
 * Instead of building a full CommonMark AST we walk the source line by line
 * and recognize only what `mdq` actually needs: ATX headings and fenced code
 * blocks (so `#` inside code doesn't count as a heading).
 *
 * Numbers from `dev/bench/query.ts` on MDN content: ~180 MB/s end-to-end on
 * a 10 MB fixture, roughly 7x faster than markdown-it and ~1000x faster than
 * mdast-util-from-markdown while returning the exact same section.
 *
 * Deliberate limitations:
 * - Setext headings (`===` / `---` underlines) are NOT recognized. mdq is
 *   aimed at agent-authored markdown where ATX is ubiquitous.
 * - HTML blocks are not detected. A `<pre>` containing an ATX-looking line
 *   would be misread as a heading. That's an acceptable tradeoff for 100x
 *   speed; a future `--strict` flag could hand off to markdown-it.
 * - Fenced code blocks *inside a list item* that are indented 4+ spaces are
 *   not recognized as fences — we only look at the first 3 columns for the
 *   fence opener. A `# fake` line inside such a block would be scanned as a
 *   heading. Rare in practice; document-your-way-out rather than fix.
 * - An unclosed fence at EOF leaves the scanner in "still in fence" state
 *   to the end of the file, so any `#`-looking lines after it are ignored.
 *   That's the conservative choice — prefer under-counting to over-counting.
 */

export type Heading = {
  /** 1..6 */
  level: number;
  /** Heading text with trailing closing hashes stripped. */
  title: string;
  /** 1-indexed line number. */
  line: number;
};

/**
 * Return every ATX heading in `src`, in document order.
 * Runs in a single pass; O(n) in source length, O(headings) in space.
 */
export function scan(src: string): Heading[] {
  const out: Heading[] = [];
  const len = src.length;

  let i = 0;
  let lineNo = 0;

  // Fence state: when inFence is true every line is ignored until we see a
  // matching closing fence (same char, length >= opening length).
  let inFence = false;
  let fenceChar = 0; // charCode of ` or ~
  let fenceLen = 0;

  while (i <= len) {
    // Slice one line without the trailing newline. A trailing \r from CRLF
    // is stripped below.
    const start = i;
    while (i < len && src.charCodeAt(i) !== 10 /* \n */) i++;
    let line = src.slice(start, i);
    if (line.length > 0 && line.charCodeAt(line.length - 1) === 13 /* \r */) {
      line = line.slice(0, line.length - 1);
    }
    lineNo++;

    const fence = matchFence(line);
    if (fence) {
      if (!inFence) {
        inFence = true;
        fenceChar = fence.char;
        fenceLen = fence.len;
      } else if (fence.char === fenceChar && fence.len >= fenceLen) {
        inFence = false;
      }
    } else if (!inFence) {
      const h = matchHeading(line, lineNo);
      if (h) out.push(h);
    }

    if (i >= len) break;
    i++; // skip the \n
  }

  return out;
}

/**
 * If `line` opens or closes a fenced code block, return the fence char code
 * (` or ~) and the number of fence characters. Otherwise null.
 *
 * A fence is 0–3 spaces, then 3+ of a single fence char, then optional info
 * string. We only care about the opening run length; the info string is
 * ignored.
 */
function matchFence(line: string): { char: number; len: number } | null {
  // Skip up to 3 leading spaces.
  let p = 0;
  while (p < 3 && line.charCodeAt(p) === 32) p++;
  const ch = line.charCodeAt(p);
  if (ch !== 96 /* ` */ && ch !== 126 /* ~ */) return null;
  let run = 0;
  while (line.charCodeAt(p + run) === ch) run++;
  if (run < 3) return null;
  // For backtick fences, CommonMark forbids backticks in the info string,
  // but we don't parse info; we only need to know this line is a fence.
  return { char: ch, len: run };
}

/**
 * If `line` is an ATX heading, return it. Otherwise null.
 *
 * Rules (CommonMark, simplified):
 * - 0–3 spaces of indent
 * - 1–6 `#`
 * - EITHER end-of-line OR a space/tab followed by content
 * - optional closing sequence: whitespace + trailing `#`s (stripped)
 */
function matchHeading(line: string, lineNo: number): Heading | null {
  // Skip up to 3 leading spaces.
  let p = 0;
  while (p < 3 && line.charCodeAt(p) === 32) p++;
  if (line.charCodeAt(p) !== 35 /* # */) return null;

  let hashes = 0;
  while (line.charCodeAt(p + hashes) === 35) hashes++;
  if (hashes < 1 || hashes > 6) return null;

  const after = p + hashes;
  const afterCh = line.charCodeAt(after);

  // After the hashes we need either end-of-line or a space/tab. Anything else
  // (including `#` which is caught above by the hashes loop) disqualifies.
  if (after < line.length && afterCh !== 32 && afterCh !== 9 /* \t */) {
    return null;
  }

  // Trim leading whitespace of content and trailing whitespace + closing #s.
  let contentStart = after;
  while (
    contentStart < line.length &&
    (line.charCodeAt(contentStart) === 32 || line.charCodeAt(contentStart) === 9)
  ) {
    contentStart++;
  }

  let end = line.length;
  // Trim trailing whitespace first.
  while (
    end > contentStart &&
    (line.charCodeAt(end - 1) === 32 || line.charCodeAt(end - 1) === 9)
  ) {
    end--;
  }
  // Strip closing `#`s only if they are preceded by whitespace (CommonMark
  // requires the closing sequence to be separated from the content).
  let closing = end;
  while (closing > contentStart && line.charCodeAt(closing - 1) === 35) closing--;
  if (
    closing < end &&
    (closing === contentStart ||
      line.charCodeAt(closing - 1) === 32 ||
      line.charCodeAt(closing - 1) === 9)
  ) {
    end = closing;
    while (
      end > contentStart &&
      (line.charCodeAt(end - 1) === 32 || line.charCodeAt(end - 1) === 9)
    ) {
      end--;
    }
  }

  const title = line.slice(contentStart, end);
  return { level: hashes, title, line: lineNo };
}
