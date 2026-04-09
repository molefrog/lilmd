import { describe, expect, test } from "bun:test";
import { buildSections, countLines, pathOf } from "./sections";

describe("countLines", () => {
  test("empty string is 0 lines", () => {
    expect(countLines("")).toBe(0);
  });

  test("single line without trailing newline", () => {
    expect(countLines("hello")).toBe(1);
  });

  test("single line with trailing newline", () => {
    expect(countLines("hello\n")).toBe(1);
  });

  test("multiple lines", () => {
    expect(countLines("a\nb\nc")).toBe(3);
    expect(countLines("a\nb\nc\n")).toBe(3);
  });

  test("CRLF counts the same as LF", () => {
    expect(countLines("a\r\nb\r\n")).toBe(2);
  });
});

describe("buildSections", () => {
  test("no headings -> empty list", () => {
    expect(buildSections([], 42)).toEqual([]);
  });

  test("single heading spans the whole document", () => {
    const secs = buildSections([{ level: 1, title: "A", line: 1 }], 10);
    expect(secs.length).toBe(1);
    expect(secs[0]).toMatchObject({ level: 1, title: "A", line_start: 1, line_end: 10 });
    expect(secs[0].parent).toBeNull();
  });

  test("sibling sections at top level", () => {
    const secs = buildSections(
      [
        { level: 1, title: "A", line: 1 },
        { level: 1, title: "B", line: 5 },
      ],
      10,
    );
    expect(secs.map((s) => [s.title, s.line_start, s.line_end])).toEqual([
      ["A", 1, 4],
      ["B", 5, 10],
    ]);
    expect(secs[0].parent).toBeNull();
    expect(secs[1].parent).toBeNull();
  });

  test("nested sections get correct parents and ranges", () => {
    const secs = buildSections(
      [
        { level: 1, title: "A", line: 1 },
        { level: 2, title: "A1", line: 3 },
        { level: 2, title: "A2", line: 6 },
        { level: 1, title: "B", line: 10 },
      ],
      15,
    );
    expect(secs.map((s) => [s.title, s.line_start, s.line_end])).toEqual([
      ["A", 1, 9],
      ["A1", 3, 5],
      ["A2", 6, 9],
      ["B", 10, 15],
    ]);
    expect(secs[1].parent?.title).toBe("A");
    expect(secs[2].parent?.title).toBe("A");
    expect(secs[3].parent).toBeNull();
  });

  test("first heading can be H3 (no synthetic root)", () => {
    const secs = buildSections(
      [
        { level: 3, title: "Deep", line: 1 },
        { level: 3, title: "Also deep", line: 5 },
      ],
      10,
    );
    expect(secs[0].parent).toBeNull();
    expect(secs[1].parent).toBeNull();
    expect(secs[0].line_start).toBe(1);
    expect(secs[0].line_end).toBe(4);
  });

  test("heading levels can jump down by more than one", () => {
    // # A\n### Deep\n## Mid
    // "Deep" is still a descendant of "A" even though level jumps 1 -> 3.
    const secs = buildSections(
      [
        { level: 1, title: "A", line: 1 },
        { level: 3, title: "Deep", line: 2 },
        { level: 2, title: "Mid", line: 5 },
      ],
      10,
    );
    expect(secs[0].line_end).toBe(10); // A spans whole document
    expect(secs[1].parent?.title).toBe("A");
    expect(secs[2].parent?.title).toBe("A");
    expect(secs[1].line_end).toBe(4); // Deep ends before Mid
  });

  test("pathOf returns titles of ancestors in order", () => {
    const secs = buildSections(
      [
        { level: 1, title: "Guide", line: 1 },
        { level: 2, title: "Install", line: 3 },
        { level: 3, title: "MacOS", line: 5 },
      ],
      10,
    );
    expect(pathOf(secs[0])).toEqual([]);
    expect(pathOf(secs[1])).toEqual(["Guide"]);
    expect(pathOf(secs[2])).toEqual(["Guide", "Install"]);
  });
});
