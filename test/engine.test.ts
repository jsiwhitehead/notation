import { describe, expect, test } from "bun:test";

import { runEngine } from "../src/engine";
import type { PieceInput } from "../src/model";

function getSegment(input: PieceInput) {
  return runEngine(input).segments[0]!;
}

describe("runEngine", () => {
  test("derives structure from event evidence without harmonic guidance", () => {
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

    expect(segment.center).toEqual([0, 4, 7]);
  });

  test("derives structure from guidance evidence when no events are present", () => {
    const segment = getSegment({
      segments: [
        {
          events: [],
          harmonicGuidance: "Cmaj7",
        },
      ],
    });

    expect(segment.center).toEqual([0, 4, 7, 11]);
    expect(segment.regions).toHaveLength(3);
    expect(
      segment.regions.flatMap((region) => [region.start, region.end]),
    ).toEqual(expect.arrayContaining([0, 4, 7, 11]));
    expect(segment.grounding).toEqual({ ground: 0, root: 0 });
  });

  test("prefers sounded event evidence when guidance and events disagree", () => {
    const segment = getSegment({
      segments: [
        {
          events: [{ duration: 1, pitches: [60, 64, 67], type: "chord" }],
          harmonicGuidance: "Dmin7",
        },
      ],
    });

    expect(segment.center).toEqual([0, 4, 7]);
  });

  test("derives regions from event evidence when events are present", () => {
    const segment = getSegment({
      segments: [
        {
          events: [
            { duration: 1, pitch: 60, type: "note" },
            { duration: 1, pitch: 66, type: "note" },
          ],
          harmonicGuidance: "Cmaj7",
        },
      ],
    });

    expect(segment.regions).toEqual([
      { end: 0, start: 0 },
      { end: 6, start: 6 },
    ]);
  });

  test("uses overlapping evidence when guidance and events agree", () => {
    const segment = getSegment({
      segments: [
        {
          events: [
            { duration: 1, pitch: 62, type: "note" },
            { duration: 1, pitches: [65, 69], type: "chord" },
          ],
          harmonicGuidance: "Dmin7/A",
        },
      ],
    });

    expect(segment.center).toEqual([2, 5, 9]);
    expect(segment.grounding).toEqual({ ground: 9, root: 2 });
  });

  test("falls back to simple region grounding for weak unguided evidence", () => {
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
    expect(segment.grounding).toEqual({ ground: 6, root: 0 });
  });

  test("emits only non-wrapping regions", () => {
    const segment = getSegment({
      segments: [
        {
          events: [],
          harmonicGuidance: "Bsus4",
        },
      ],
    });

    expect(segment.regions).toEqual([
      { end: 6, start: 4 },
      { end: 11, start: 11 },
    ]);
  });
});
