/**
 * Minimal ambient types for `marked-terminal`. The package ships no d.ts
 * and @types/marked-terminal lags behind the v7 `markedTerminal` factory.
 * We only need enough to type `marked.use(markedTerminal(...))` in pretty.ts.
 */
declare module "marked-terminal" {
  import type { MarkedExtension } from "marked";

  export function markedTerminal(
    options?: Record<string, unknown>,
    highlightOptions?: Record<string, unknown>,
  ): MarkedExtension;
}
