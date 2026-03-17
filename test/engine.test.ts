import { describe, expect, test } from "bun:test";

import { runEngine } from "../src/engine";
import { uniqueFifthsOrderedPitchClasses } from "../src/pitch";
import type { HarmonicRegion, PieceInput } from "../src/model";

function getSegment(input: PieceInput) {
  return runEngine(input).segments[0]!;
}

function expectRegionPitchClasses(
  region: HarmonicRegion,
  pitchClasses: number[],
): void {
  expect(region).toEqual({
    pitchClasses: uniqueFifthsOrderedPitchClasses(pitchClasses),
  });
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

    expectRegionPitchClasses(segment.center, [0, 4, 7]);
    expectRegionPitchClasses(segment.field, [0, 4, 7]);
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

    expectRegionPitchClasses(segment.center, [0, 4, 7, 11]);
    expectRegionPitchClasses(segment.field, [0, 4, 7, 11]);
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

    expectRegionPitchClasses(segment.center, [0, 4, 7]);
    expectRegionPitchClasses(segment.field, [0, 2, 4, 5, 7, 9]);
  });

  test("derives field from wider local evidence", () => {
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

    expectRegionPitchClasses(segment.center, [0, 6]);
    expectRegionPitchClasses(segment.field, [0, 4, 6, 7, 11]);
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

    expectRegionPitchClasses(segment.center, [2, 5, 9]);
    expectRegionPitchClasses(segment.field, [0, 2, 5, 9]);
    expect(segment.grounding).toEqual({ ground: 9, root: 2 });
  });

  test("falls back to simple center grounding for weak unguided evidence", () => {
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

    expectRegionPitchClasses(segment.center, [0, 6]);
    expectRegionPitchClasses(segment.field, [0, 6]);
    expect(segment.grounding).toEqual({ ground: 0, root: 0 });
  });

  test("emits fifths-space regions for guidance-only material", () => {
    const segment = getSegment({
      segments: [
        {
          events: [],
          harmonicGuidance: "Bsus4",
        },
      ],
    });

    expectRegionPitchClasses(segment.center, [4, 6, 11]);
    expectRegionPitchClasses(segment.field, [4, 6, 11]);
  });
});
