import { describe, expect, test } from "bun:test";

import {
  buildFieldSpans,
  buildGroundingMarks,
  buildProjection,
  repeatPitchClassesAcrossRange,
  repeatFieldSpansAcrossRange,
} from "../src/projection";

describe("projection", () => {
  test("buildFieldSpans groups nearby pitch classes into spans", () => {
    expect(buildFieldSpans({ pitchClasses: [0, 4, 7, 11] })).toEqual([
      { end: 0, start: 0 },
      { end: 4, start: 4 },
      { end: 7, start: 7 },
      { end: 11, start: 11 },
    ]);
  });

  test("buildFieldSpans keeps wrapped edge material as separate spans", () => {
    expect(buildFieldSpans({ pitchClasses: [11, 0, 1] })).toEqual([
      { end: 1, start: 0 },
      { end: 11, start: 11 },
    ]);
  });

  test("repeatFieldSpansAcrossRange repeats spans into visible pitch space", () => {
    expect(repeatFieldSpansAcrossRange(14, 0, { end: 1, start: 0 })).toEqual([
      { end: 1, start: 0 },
      { end: 13, start: 12 },
    ]);
    expect(repeatFieldSpansAcrossRange(14, 0, { end: 11, start: 11 })).toEqual([
      { end: 11, start: 11 },
    ]);
  });

  test("repeatPitchClassesAcrossRange repeats pitch classes across octaves", () => {
    expect(repeatPitchClassesAcrossRange(14, 0, [0, 7])).toEqual([0, 7, 12]);
  });

  test("buildGroundingMarks repeats root and ground across the visible range", () => {
    const projection = buildProjection(
      {
        segments: [
          {
            events: [{ duration: 1, pitches: [60, 67], type: "chord" }],
          },
        ],
      },
      {
        segments: [
          {
            center: { pitchClasses: [0, 7, 4] },
            field: { pitchClasses: [0, 7, 4] },
            grounding: { ground: 7, root: 0 },
          },
        ],
      },
    );

    expect(buildGroundingMarks(projection, projection.segments[0]!)).toEqual([
      { pitch: 60, type: "root" },
      { pitch: 67, type: "ground" },
    ]);
  });
});
