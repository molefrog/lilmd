import { describe, expect, test } from "bun:test";
import { scan } from "./scan";

describe("scan", () => {
  test("empty input", () => {
    expect(scan("")).toEqual([]);
  });

  test("single heading", () => {
    expect(scan("# Hi")).toEqual([{ level: 1, title: "Hi", line: 1 }]);
  });

  test("trailing newline", () => {
    expect(scan("# Hi\n")).toEqual([{ level: 1, title: "Hi", line: 1 }]);
  });

  test("multiple levels", () => {
    expect(scan("# A\n## B\n### C\n")).toEqual([
      { level: 1, title: "A", line: 1 },
      { level: 2, title: "B", line: 2 },
      { level: 3, title: "C", line: 3 },
    ]);
  });

  test("body lines are skipped", () => {
    expect(scan("# A\n\nbody line\n\n## B\n")).toEqual([
      { level: 1, title: "A", line: 1 },
      { level: 2, title: "B", line: 5 },
    ]);
  });

  test("ignores # inside backtick fenced code blocks", () => {
    const src = "# real\n\n```\n# fake\n```\n\n## also real\n";
    expect(scan(src)).toEqual([
      { level: 1, title: "real", line: 1 },
      { level: 2, title: "also real", line: 7 },
    ]);
  });

  test("ignores # inside tilde fenced code blocks", () => {
    const src = "# real\n~~~\n# fake\n~~~\n";
    expect(scan(src)).toEqual([{ level: 1, title: "real", line: 1 }]);
  });

  test("longer fence closes only on matching length", () => {
    // A 3-backtick fence cannot be closed by a 4-backtick fence but a
    // 5-backtick fence can be closed by 5+ backticks.
    const src = "# a\n`````\n```\n# not real\n`````\n## b\n";
    expect(scan(src)).toEqual([
      { level: 1, title: "a", line: 1 },
      { level: 2, title: "b", line: 6 },
    ]);
  });

  test("trailing closing hashes are stripped", () => {
    expect(scan("## Title ##")).toEqual([{ level: 2, title: "Title", line: 1 }]);
    expect(scan("### Title ########")).toEqual([{ level: 3, title: "Title", line: 1 }]);
  });

  test("up to 3 leading spaces are allowed", () => {
    expect(scan("   # Three")).toEqual([{ level: 1, title: "Three", line: 1 }]);
  });

  test("4 leading spaces is an indented code block, not a heading", () => {
    expect(scan("    # four")).toEqual([]);
  });

  test("missing space after # is not a heading", () => {
    expect(scan("#nope\n## also nope-like text\n")).toEqual([
      { level: 2, title: "also nope-like text", line: 2 },
    ]);
    expect(scan("#nope")).toEqual([]);
  });

  test("seven or more # is not a heading", () => {
    expect(scan("####### too deep")).toEqual([]);
  });

  test("empty title is allowed", () => {
    expect(scan("# ")).toEqual([{ level: 1, title: "", line: 1 }]);
    expect(scan("#")).toEqual([{ level: 1, title: "", line: 1 }]);
  });

  test("CRLF line endings", () => {
    const src = "# A\r\nbody\r\n## B\r\n";
    expect(scan(src)).toEqual([
      { level: 1, title: "A", line: 1 },
      { level: 2, title: "B", line: 3 },
    ]);
  });

  test("blank lines don't change heading line numbers", () => {
    expect(scan("\n\n# A\n")).toEqual([{ level: 1, title: "A", line: 3 }]);
  });

  test("unclosed fence at EOF stays open (documented)", () => {
    // After an unclosed ``` we never exit the fence, so lines that look like
    // headings after it are ignored. Pins the behavior called out in the
    // scanner header.
    const src = "# real\n\n```\n# fake\nmore code\n";
    expect(scan(src)).toEqual([{ level: 1, title: "real", line: 1 }]);
  });
});
