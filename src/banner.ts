/**
 * Banner rendering: shows the lilmd logo in the terminal when `--help` is
 * invoked interactively. Loaded via dynamic import from cli.ts so neither
 * the base64 payload nor the `terminal-image` dependency (plus its Jimp
 * tree) touch the non-help cold start path.
 *
 * The PNG is a 200px-wide palette-quantized scale-down of lilmd-logo.webp
 * (see lilmd-logo.png in the repo root), base64-encoded inline so the
 * bundled CLI stays a single self-contained file with no external asset
 * lookup at runtime.
 */
import terminalImage from "terminal-image";
import chalk from "chalk";

const LOGO_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAMgAAABMCAMAAAAfpwhiAAAAIGNIUk0AAHomAACAhAAA+gAAAIDo"
  + "AAB1MAAA6mAAADqYAAAXcJy6UTwAAAFrUExURf///4SEhHd3d3p6eqanpLy8vMTEw62trKSkpJmZ"
  + "l6ysq5+fn11dXbS0tIyMjGxsa1lZV1FRT0ZGRktMSz8/PjY2Nk9PTnBwcIuLind3dmZmZnl5eFRU"
  + "VHl6dzw8O3JycIKDgn+AfFtcW93d3ElJR4WGgUJCQWhoaNTU1OTk5DAwL3x8fJSUlImKhmJjYuzs"
  + "7FhYWB0dHV5eXqenp2BhYLKysvT09I6OjJWVk56enbGxsVtbWmBgX8nJx8zMy7y8u7KysFZWVWRk"
  + "Y6mqp2VlZJCRjklJST09Pbu7u4+Pjjw8PDQ0MywsK0RERG9wbWRkZIGBfygoJzk5NnFybtnZ1zo7"
  + "O1dYVmlpZ9HRz8HCv/Hx70BAPujo5vn5+eHh4KGhn2BgYEFBP9/g3TAxLmFiXx0dHD4+PnBxbjAw"
  + "MHl6eSoqKm9vby8wLSAgH3R0dCgpJjExMWZmZHt7emBgXkhIR3V1dCUlJFJSUjQ0MjFf7PAAAAAB"
  + "dFJOUwBA5thmAAAAAWJLR0QAiAUdSAAAAAd0SU1FB+oECwoXGELyKpMAAAAldEVYdGRhdGU6Y3Jl"
  + "YXRlADIwMjYtMDQtMDlUMTU6NTA6NDYrMDA6MDBck/qpAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDI2"
  + "LTA0LTA5VDE1OjUwOjQ2KzAwOjAwLc5CFQAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyNi0wNC0x"
  + "MVQxMDoyMzoyNCswMDowMAC9MvsAABN5SURBVGje7VsLVxtHlla10y+j7ioECCyqmISuRVKqiTCj"
  + "ZccL0ZjyIMfdXQaBZYXYjodAvHacDDPJvn7+3mo9aEktwJ7Jmd2zUyfnBPWzvvv47ner2oXC/+uB"
  + "EPp7T+GvHsadT0zLtB3XuTtn/Hpv+ZVRFA3Xs31M5ksLi0vl8vLKveuurvxvxVFcdUwXU1pauprr"
  + "Na80ih8L486vi8NwLY8RUlobRzcTym8+8j2ffvarwlj3rcCjnC7d9oY7HxlZc//0a8LYqLq1uscp"
  + "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"
  + "/wAAAABJRU5ErkJggg=="
;

/**
 * Render the logo as a string of ANSI escape codes sized to ~40% of the
 * terminal width. Returns `null` if terminal-image fails (e.g. very small
 * terminal or unsupported environment); callers should fall back silently.
 */
/**
 * Applies ANSI colors to the plain-text HELP string for interactive display.
 * Only called when stdout is a TTY — plain text is preserved for pipes/scripts.
 */
export function colorHelp(help: string): string {
  return (
    help
      // Title line: bold
      .replace(/^(lilmd —.+)$/m, chalk.bold("$1"))
      // Section headers: bold + underline
      .replace(/^(\w.+:)$/gm, chalk.bold.underline("$1"))
      // [experimental] tag: dim magenta
      .replace(/(\[experimental\][^:\n]*)/g, chalk.dim.magenta("$1"))
      // Subcommand: "lilmd <subcommand>" in cyan bold (but not bare "lilmd" with no subcommand)
      .replace(/\blilmd\b( \w+)/g, chalk.cyan.bold("lilmd") + chalk.cyan("$1"))
      // <placeholders>: yellow
      .replace(/<[^>]+>/g, (m) => chalk.yellow(m))
      // --flags: green
      .replace(/--[\w-]+/g, (m) => chalk.green(m))
  );
}

export async function renderBanner(): Promise<string | null> {
  try {
    const buf = Buffer.from(LOGO_BASE64, "base64");
    const img = await terminalImage.buffer(buf, { width: "25%" });
    return img + "\n";
  } catch {
    return null;
  }
}
