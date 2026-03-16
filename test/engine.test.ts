import { describe, expect, test } from "bun:test";

import { runEngine } from "../src/engine";
import type { PieceInput } from "../src/model";

function getSegment(input: PieceInput) {
  return runEngine(input).segments[0]!;
}

describe("runEngine", () => {
  test("derives structure from event evidence without a hint", () => {
    const segment = getSegment({
      segments: [
        {
          events: [
            { duration: 1, pitch: 60, type: "note" },
            { duration: 1, pitches: [64, 67], type: "chord" },
          ],
        },
      ],
    });

    expect(segment.core).toEqual([0, 4, 7]);
  });

  test("derives structure from hint evidence when no events are present", () => {
    const segment = getSegment({
      segments: [
        {
          events: [],
          harmonyHint: "Cmaj7",
        },
      ],
    });

    expect(segment.core).toEqual([0, 4, 7, 11]);
    expect(segment.regions).toHaveLength(3);
    expect(
      segment.regions.flatMap((region) => [region.start, region.end]),
    ).toEqual(expect.arrayContaining([0, 4, 7, 11]));
    expect(segment.grounding).toEqual({ root: 0, base: 0 });
  });

  test("prefers sounded event evidence when hint and events disagree", () => {
    const segment = getSegment({
      segments: [
        {
          events: [{ duration: 1, pitches: [60, 64, 67], type: "chord" }],
          harmonyHint: "Dmin7",
        },
      ],
    });

    expect(segment.core).toEqual([0, 4, 7]);
  });

  test("derives regions from event evidence when events are present", () => {
    const segment = getSegment({
      segments: [
        {
          events: [
            { duration: 1, pitch: 60, type: "note" },
            { duration: 1, pitch: 66, type: "note" },
          ],
          harmonyHint: "Cmaj7",
        },
      ],
    });

    expect(segment.regions).toEqual([
      { end: 0, start: 0 },
      { end: 6, start: 6 },
    ]);
  });

  test("uses overlapping evidence when hint and events agree", () => {
    const segment = getSegment({
      segments: [
        {
          events: [
            { duration: 1, pitch: 62, type: "note" },
            { duration: 1, pitches: [65, 69], type: "chord" },
          ],
          harmonyHint: "Dmin7/A",
        },
      ],
    });

    expect(segment.core).toEqual([2, 5, 9]);
    expect(segment.grounding).toEqual({ root: 2, base: 9 });
  });

  test("falls back to simple region grounding for weak unhinted evidence", () => {
    const segment = getSegment({
      segments: [
        {
          events: [
            { duration: 1, pitch: 60, type: "note" },
            { duration: 1, pitch: 66, type: "note" },
          ],
        },
      ],
    });

    expect(segment.regions).toEqual([
      { end: 0, start: 0 },
      { end: 6, start: 6 },
    ]);
    expect(segment.grounding).toEqual({ root: 0, base: 6 });
  });

  test("emits only non-wrapping regions", () => {
    const segment = getSegment({
      segments: [
        {
          events: [],
          harmonyHint: "Bsus4",
        },
      ],
    });

    expect(segment.regions).toEqual([
      { end: 6, start: 4 },
      { end: 11, start: 11 },
    ]);
  });
});
