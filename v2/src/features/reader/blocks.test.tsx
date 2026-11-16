import { describe, expect, it } from "vitest";
import type { VNode } from "preact";
import {
  buildGroups,
  flatten,
  type BookElement,
  type Para,
  type Section,
} from "@/domain/reader/book";
import { chunkSentences } from "@/domain/reader/spread";
import { ElementBlock } from "./ElementBlock";
import {
  elementsAfter,
  elementsBefore,
  frameClass,
  sectionBlocks,
} from "./blocks";
import { chunkBlocks } from "./SpreadView";

const pic = (asset: string): BookElement => ({
  kind: "image",
  asset,
  w: 200,
  h: 100,
  alt: "",
});
const table: BookElement = {
  kind: "table",
  rows: [[{ t: "A" }, { t: "B" }]],
  header: false,
};
const sec = (paras: Para[]): Section => ({
  title: "",
  label: { kind: "page", n: 1 },
  paras,
});

/** What a list of blocks shows, in order: `el:<asset or table>` for elements, the text otherwise. */
function shown(nodes: readonly VNode[]): string[] {
  return nodes.map((n) => {
    if (n.type === ElementBlock) {
      const el = (n.props as unknown as { el: BookElement }).el;
      return `el:${el.kind === "image" ? el.asset : "table"}`;
    }
    const kids = (n.props as { children?: unknown }).children;
    const flat = (Array.isArray(kids) ? kids : [kids]).flat(3);
    return flat
      .map((k) =>
        typeof k === "string"
          ? k
          : (((k as VNode | null)?.props as { children?: unknown } | undefined)
              ?.children ?? ""),
      )
      .join("");
  });
}

describe("elements in the flow of the text", () => {
  const book = [
    sec([
      { t: "Pierwszy akapit. Ma dwa zdania.", h: 0 },
      { t: "", h: 0, el: pic("a") },
      { t: "", h: 0, el: table },
      { t: "Drugi akapit.", h: 0 },
      { t: "W ramce.", h: 0, frame: 1 },
      { t: "Też w ramce.", h: 0, frame: 1 },
      { t: "", h: 0, el: pic("z") },
    ]),
  ];
  const { sents, secStart } = flatten(book);

  it("elements have no sentences: stepping goes from text to text past them", () => {
    expect(sents.map((s) => s.t)).toEqual([
      "Pierwszy akapit.",
      "Ma dwa zdania.",
      "Drugi akapit.",
      "W ramce.",
      "Też w ramce.",
    ]);
    // One sentence a step, two a step: never a group without text.
    for (const per of [1, 2]) {
      const groups = buildGroups(sents, per);
      expect(groups.every((g) => (sents[g]?.t.length ?? 0) > 0)).toBe(true);
    }
  });

  it("a section shows its elements in their places, the trailing ones after the last paragraph", () => {
    const blocks = sectionBlocks(sents, book, secStart, 0, (_i, s) => [s.t]);
    expect(shown(blocks)).toEqual([
      "Pierwszy akapit. Ma dwa zdania.",
      "el:a",
      "el:table",
      "Drugi akapit.",
      "W ramce.",
      "Też w ramce.",
      "el:z",
    ]);
  });

  it("the elements before a sentence only where it starts a paragraph; those after only at the end of the section", () => {
    expect(shown(elementsBefore(sents, book, 2))).toEqual(["el:a", "el:table"]);
    expect(elementsBefore(sents, book, 1)).toEqual([]);
    expect(elementsAfter(sents, book, 3)).toEqual([]);
    expect(shown(elementsAfter(sents, book, 4))).toEqual(["el:z"]);
  });

  it("a frame is drawn around its run of paragraphs", () => {
    expect(frameClass(book[0], 3)).toBe("");
    expect(frameClass(book[0], 4)).toBe(" reader-framed reader-framed--first");
    expect(frameClass(book[0], 5)).toBe(" reader-framed reader-framed--last");
  });
});

describe("pages of the spread with elements", () => {
  // A long book with a picture after every 25th paragraph: each element lands in exactly one chunk,
  // in the order of the book, so it shows once on one page.
  const paras: Para[] = [];
  const expected: string[] = [];
  for (let k = 0; k < 400; k++) {
    paras.push({ t: `Akapit numer ${k}. Drugie zdanie akapitu ${k}.`, h: 0 });
    if (k % 25 === 24) {
      paras.push({ t: "", h: 0, el: pic(`p${k}`) });
      expected.push(`el:p${k}`);
    }
  }
  const book = [sec(paras)];
  const { sents, secStart } = flatten(book);

  it("every element in one chunk, none lost or doubled", () => {
    const chunks = chunkSentences(sents);
    expect(chunks.length).toBeGreaterThan(2);
    const all = chunks.flatMap((c) =>
      shown(chunkBlocks(sents, book, secStart, c)).filter((x) =>
        x.startsWith("el:"),
      ),
    );
    expect(all).toEqual(expected);
  });

  it("a chunk that starts inside a paragraph does not repeat the elements before it", () => {
    const cut = { start: 1, end: 6 };
    expect(
      shown(chunkBlocks(sents, book, secStart, cut)).filter((x) =>
        x.startsWith("el:"),
      ),
    ).toEqual([]);
  });
});
