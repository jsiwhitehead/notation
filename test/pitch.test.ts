import { describe, expect, test } from "bun:test";

import {
  getEventPitchClasses,
  getEventPitches,
  repeatPitchClassesAcrossRange,
} from "../src/pitch";

describe("pitch helpers", () => {
  test("getEventPitches returns pitches for notes and chords", () => {
    expect(getEventPitches({ duration: 1, pitch: 60, type: "note" })).toEqual([
      60,
    ]);
    expect(
      getEventPitches({ duration: 1, pitches: [60, 64, 67], type: "chord" }),
    ).toEqual([60, 64, 67]);
  });

  test("getEventPitches returns no pitches for rests", () => {
    expect(getEventPitches({ duration: 1, type: "rest" })).toEqual([]);
  });

  test("getEventPitchClasses normalizes note and chord material", () => {
    expect(
      getEventPitchClasses({ duration: 1, pitch: 72, type: "note" }),
    ).toEqual([0]);
    expect(
      getEventPitchClasses({
        duration: 1,
        pitches: [60, 73, 67],
        type: "chord",
      }),
    ).toEqual([0, 1, 7]);
  });

  test("repeatPitchClassesAcrossRange repeats pitch classes across octaves", () => {
    expect(repeatPitchClassesAcrossRange(14, 0, [0, 7])).toEqual([0, 7, 12]);
  });
});
