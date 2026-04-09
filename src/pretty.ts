/**
 * Pretty printing for `mdq read --pretty`. Lazy-loads marked +
 * marked-terminal on first use so the default (plain-text) path keeps its
 * ~16ms cold start.
 */

export type PrettyFormatter = (markdown: string) => string;

let formatterPromise: Promise<PrettyFormatter> | null = null;

/** Returns a cached formatter, importing marked + marked-terminal on first call. */
export function loadPrettyFormatter(): Promise<PrettyFormatter> {
  return (formatterPromise ??= buildFormatter());
}

async function buildFormatter(): Promise<PrettyFormatter> {
  const [{ marked }, { markedTerminal }] = await Promise.all([
    import("marked"),
    import("marked-terminal"),
  ]);

  marked.use(
    markedTerminal({
      reflowText: false,
      tab: 2,
      // Unicode em-dash for <hr>, matches mdq's delimiter style.
      hr: "─",
    }),
  );

  return (md: string) => {
    // highlight.js hits console.error when it sees an unknown code-fence
    // language like `js-nolint` (common in MDN). The throw is swallowed by
    // marked-terminal, but the stderr line isn't — mute that one channel
    // for the duration of the parse.
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      if (
        typeof args[0] === "string" &&
        /Could not find the language/i.test(args[0])
      )
        return;
      originalError.apply(console, args as Parameters<typeof console.error>);
    };
    let rendered: string | Promise<string>;
    try {
      rendered = marked.parse(md);
    } finally {
      console.error = originalError;
    }
    if (typeof rendered !== "string") {
      throw new Error("mdq: pretty renderer returned a Promise unexpectedly");
    }
    // marked-terminal appends a trailing newline; trim so delimiter spacing
    // matches the plain path.
    return rendered.replace(/\n+$/, "");
  };
}
