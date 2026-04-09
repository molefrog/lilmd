import { describe, expect, test } from "bun:test";
import { buildSections } from "./sections";
import { renderSection, renderToc, truncateBody } from "./render";
import type { Heading } from "./scan";

function h(level: number, title: string, line: number): Heading {
  return { level, title, line };
}

describe("renderToc", () => {
  const src = "# A\n\nbody\n\n## B\n\nbody\n\n### C\n\nend\n";
  const sections = buildSections([h(1, "A", 1), h(2, "B", 5), h(3, "C", 9)], 11);

  test("header line shows file, total range, heading count", () => {
    const out = renderToc("file.md", src, sections, {});
    const first = out.split("\n")[0];
    expect(first).toContain("file.md");
    expect(first).toContain("L1-11");
    expect(first).toContain("3 headings");
  });

  test("headings are indented by level", () => {
    const out = renderToc("file.md", src, sections, {});
    const lines = out.split("\n");
    expect(lines[1]).toMatch(/^# A\b/);
    expect(lines[2]).toMatch(/^  ## B\b/);
    expect(lines[3]).toMatch(/^    ### C\b/);
  });

  test("each heading line ends with L<start>-<end>", () => {
    const out = renderToc("file.md", src, sections, {});
    expect(out).toContain("# A  L1-11");
    // B is level 2 with child C (level 3); its subtree runs to EOF.
    expect(out).toContain("## B  L5-11");
    expect(out).toContain("### C  L9-11");
  });

  test("--depth filters deeper headings", () => {
    const out = renderToc("file.md", src, sections, { depth: 2 });
    expect(out).not.toContain("C");
    expect(out).toContain("B");
  });

  test("--flat removes indentation", () => {
    const out = renderToc("file.md", src, sections, { flat: true });
    const lines = out.split("\n").slice(1);
    for (const l of lines) expect(l).not.toMatch(/^ /);
  });

  test("singular heading count", () => {
    const only = buildSections([h(1, "A", 1)], 1);
    const out = renderToc("file.md", "# A", only, {});
    expect(out.split("\n")[0]).toContain("1 heading");
    expect(out.split("\n")[0]).not.toContain("1 headings");
  });
});

describe("renderSection", () => {
  const src = "# Title\n\nfirst line\nsecond line\n\n## Sub\n\ninside sub\n";
  const srcLines = src.split("\n");
  const sections = buildSections([h(1, "Title", 1), h(2, "Sub", 6)], 8);

  test("prints delimiter with file, range, heading", () => {
    const out = renderSection("file.md", srcLines, sections[0], {});
    expect(out).toMatch(/^── file\.md  L1-8  # Title/);
    expect(out).toContain("── end");
  });

  test("body contains the exact source slice", () => {
    const out = renderSection("file.md", srcLines, sections[0], {});
    expect(out).toContain("first line\nsecond line");
    expect(out).toContain("## Sub");
  });

  test("body-only stops before the first child heading", () => {
    const out = renderSection("file.md", srcLines, sections[0], {
      bodyOnly: true,
      allSections: sections,
    });
    expect(out).toContain("first line");
    expect(out).not.toContain("## Sub");
  });

  test("no-body prints only the heading line", () => {
    const out = renderSection("file.md", srcLines, sections[0], { noBody: true });
    const body = out.split("\n").slice(1, -1).join("\n"); // between delimiters
    expect(body.trim()).toBe("# Title");
  });

  test("--raw drops the delimiters", () => {
    const out = renderSection("file.md", srcLines, sections[0], { raw: true });
    expect(out).not.toContain("── ");
    expect(out.startsWith("# Title")).toBe(true);
  });

  test("pretty formatter transforms the body, delimiters untouched", () => {
    const out = renderSection("file.md", srcLines, sections[0], {
      pretty: (md) => `<<PRETTY>>${md}<<END>>`,
    });
    expect(out).toContain("<<PRETTY>>");
    expect(out).toContain("<<END>>");
    expect(out).toContain("first line");
    expect(out).toMatch(/── file\.md/);
    expect(out).toContain("── end");
  });

  test("pretty receives the already-truncated body", () => {
    let received = "";
    const body = "# Title\n\nline1\nline2\nline3\nline4\nline5";
    const longLines = body.split("\n");
    const long = buildSections([h(1, "Title", 1)], longLines.length);
    renderSection("file.md", longLines, long[0], {
      maxLines: 2,
      pretty: (md) => {
        received = md;
        return md;
      },
    });
    expect(received).toContain("more lines");
  });
});

describe("truncateBody", () => {
  test("no-op when under budget", () => {
    const body = "a\nb\nc";
    expect(truncateBody(body, 10)).toBe(body);
  });

  test("cuts at maxLines and appends a marker", () => {
    const body = "1\n2\n3\n4\n5";
    const out = truncateBody(body, 3);
    expect(out.split("\n").slice(0, 3)).toEqual(["1", "2", "3"]);
    expect(out).toContain("2 more lines");
  });

  test("maxLines=0 means unlimited", () => {
    const body = "1\n2\n3";
    expect(truncateBody(body, 0)).toBe(body);
  });
});
