import { describe, expect, test } from "bun:test";
import { buildSections } from "./sections";
import { match, parseSelector } from "./select";
import type { Heading } from "./scan";

describe("parseSelector", () => {
  test("single fuzzy segment", () => {
    expect(parseSelector("Install")).toEqual([
      { op: "descendant", level: null, kind: "fuzzy", value: "Install" },
    ]);
  });

  test("exact match prefix =", () => {
    expect(parseSelector("=Install")).toEqual([
      { op: "descendant", level: null, kind: "exact", value: "Install" },
    ]);
  });

  test("regex /.../", () => {
    const segs = parseSelector("/inst(all)?/");
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("regex");
    expect(segs[0].value).toBe("inst(all)?");
    expect(segs[0].regex?.test("installation")).toBe(true);
    expect(segs[0].regex?.test("foo")).toBe(false);
  });

  test("level prefix #", () => {
    const [seg] = parseSelector("##Install");
    expect(seg.level).toBe(2);
    expect(seg.value).toBe("Install");
    expect(seg.kind).toBe("fuzzy");
  });

  test("level prefix with space", () => {
    const [seg] = parseSelector("### Install");
    expect(seg.level).toBe(3);
    expect(seg.value).toBe("Install");
  });

  test("descendant chain", () => {
    const segs = parseSelector("Guide > Install");
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ op: "descendant", value: "Guide" });
    expect(segs[1]).toMatchObject({ op: "descendant", value: "Install" });
  });

  test("direct child", () => {
    const segs = parseSelector("Guide >> Install");
    expect(segs).toHaveLength(2);
    expect(segs[1].op).toBe("child");
  });

  test("mixed operators", () => {
    const segs = parseSelector("Root > Mid >> Leaf");
    expect(segs).toHaveLength(3);
    expect(segs[1].op).toBe("descendant");
    expect(segs[2].op).toBe("child");
  });

  test("whitespace around operators is ignored", () => {
    const a = parseSelector("A>B");
    const b = parseSelector("A > B");
    const c = parseSelector("A   >   B");
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  test("level + exact combine", () => {
    const [seg] = parseSelector("##=Install");
    expect(seg.level).toBe(2);
    expect(seg.kind).toBe("exact");
    expect(seg.value).toBe("Install");
  });

  test("empty selector returns empty array", () => {
    expect(parseSelector("")).toEqual([]);
    expect(parseSelector("   ")).toEqual([]);
  });

  test("7+ hashes is NOT a level prefix (treated as literal)", () => {
    // Previously a bug: #######foo silently became level=6 value="#foo".
    // Now the negative lookahead rejects it and we fall through to fuzzy.
    const [seg] = parseSelector("#######foo");
    expect(seg.level).toBe(null);
    expect(seg.kind).toBe("fuzzy");
  });

  test("regex as a later segment does not split on inner >", () => {
    // Earlier regression: the splitter only entered regex mode at
    // cur.length === 0 and missed the leading space after a `>` split.
    const segs = parseSelector("Guide > /re>gex/");
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ kind: "fuzzy", value: "Guide" });
    expect(segs[1].kind).toBe("regex");
    expect(segs[1].value).toBe("re>gex");
  });

  test("regex segment followed by another segment", () => {
    const segs = parseSelector("/^foo/ > bar");
    expect(segs).toHaveLength(2);
    expect(segs[0].kind).toBe("regex");
    expect(segs[1]).toMatchObject({ kind: "fuzzy", value: "bar" });
  });
});

function headings(...hs: Array<[number, string, number]>): Heading[] {
  return hs.map(([level, title, line]) => ({ level, title, line }));
}

describe("match", () => {
  const tree = buildSections(
    headings(
      [1, "Guide", 1],
      [2, "Install", 5],
      [3, "MacOS", 10],
      [3, "Linux", 20],
      [2, "API", 31],
      [1, "Community", 51],
    ),
    100,
  );

  test("fuzzy matches any section at any depth", () => {
    const r = match(tree, parseSelector("install"));
    expect(r.map((s) => s.title)).toEqual(["Install"]);
  });

  test("fuzzy case-insensitive substring", () => {
    const r = match(tree, parseSelector("mac"));
    expect(r.map((s) => s.title)).toEqual(["MacOS"]);
  });

  test("exact match does not do substring", () => {
    expect(match(tree, parseSelector("=Mac"))).toEqual([]);
    expect(match(tree, parseSelector("=MacOS")).map((s) => s.title)).toEqual(["MacOS"]);
  });

  test("regex matches", () => {
    const r = match(tree, parseSelector("/^mac/i"));
    expect(r.map((s) => s.title)).toEqual(["MacOS"]);
  });

  test("level filter matches only that level", () => {
    const r = match(tree, parseSelector("##install"));
    expect(r.map((s) => s.title)).toEqual(["Install"]);
    expect(match(tree, parseSelector("###install"))).toEqual([]);
  });

  test("descendant chain: any depth below", () => {
    const r = match(tree, parseSelector("Guide > MacOS"));
    expect(r.map((s) => s.title)).toEqual(["MacOS"]);
  });

  test("descendant chain skips intermediate levels", () => {
    const r = match(tree, parseSelector("Guide > Linux"));
    expect(r.map((s) => s.title)).toEqual(["Linux"]);
  });

  test("direct child fails for grandchild", () => {
    expect(match(tree, parseSelector("Guide >> MacOS"))).toEqual([]);
  });

  test("direct child works for immediate child", () => {
    const r = match(tree, parseSelector("Guide >> Install"));
    expect(r.map((s) => s.title)).toEqual(["Install"]);
  });

  test("multiple matches returned in document order", () => {
    const r = match(tree, parseSelector("/^[A-Z]/"));
    expect(r.map((s) => s.title)).toEqual([
      "Guide",
      "Install",
      "MacOS",
      "Linux",
      "API",
      "Community",
    ]);
  });

  test("no match returns empty", () => {
    expect(match(tree, parseSelector("nonexistent"))).toEqual([]);
  });
});
