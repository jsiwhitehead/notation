import { describe, expect, test } from "bun:test";

import { normalizeHarmonyHint } from "../src/chord";

describe("normalizeHarmonyHint", () => {
  test("normalizes whitespace and letter case", () => {
    expect(normalizeHarmonyHint("  gSuS4  ")).toEqual({
      bassPitchClass: 7,
      pitchClasses: [0, 2, 7],
      rootPitchClass: 7,
    });
  });

  test("supports 6/9 without forcing a dominant seventh", () => {
    expect(normalizeHarmonyHint("C6/9")).toEqual({
      bassPitchClass: 0,
      pitchClasses: [0, 2, 4, 7, 9],
      rootPitchClass: 0,
    });
  });

  test("adds a natural eleventh for 11 chords", () => {
    expect(normalizeHarmonyHint("C11")).toEqual({
      bassPitchClass: 0,
      pitchClasses: [0, 4, 5, 7, 10],
      rootPitchClass: 0,
    });
  });

  test("supports slash bass grounding", () => {
    expect(normalizeHarmonyHint("Dmin7/A")).toEqual({
      bassPitchClass: 9,
      pitchClasses: [0, 2, 5, 9],
      rootPitchClass: 2,
    });
  });

  test("supports enharmonic root spellings", () => {
    expect(normalizeHarmonyHint("Dbmaj7")).toEqual({
      bassPitchClass: 1,
      pitchClasses: [0, 1, 5, 8],
      rootPitchClass: 1,
    });
    expect(normalizeHarmonyHint("Cbmaj")).toEqual({
      bassPitchClass: 11,
      pitchClasses: [3, 6, 11],
      rootPitchClass: 11,
    });
  });

  test("supports major, minor, diminished, and augmented qualities", () => {
    expect(normalizeHarmonyHint("Cmaj")?.pitchClasses).toEqual([0, 4, 7]);
    expect(normalizeHarmonyHint("Dmin")?.pitchClasses).toEqual([2, 5, 9]);
    expect(normalizeHarmonyHint("Bdim7")?.pitchClasses).toEqual([2, 5, 8, 11]);
    expect(normalizeHarmonyHint("Caug")?.pitchClasses).toEqual([0, 4, 8]);
  });

  test("supports suspension and alterations", () => {
    expect(normalizeHarmonyHint("Dsus2")?.pitchClasses).toEqual([2, 4, 9]);
    expect(normalizeHarmonyHint("Gsus4")?.pitchClasses).toEqual([0, 2, 7]);
    expect(normalizeHarmonyHint("C7#5")?.pitchClasses).toEqual([0, 4, 8, 10]);
    expect(normalizeHarmonyHint("C7b5")?.pitchClasses).toEqual([0, 4, 6, 10]);
    expect(normalizeHarmonyHint("C7b9#11")?.pitchClasses).toEqual([
      0, 1, 4, 6, 7, 10,
    ]);
  });

  test("supports upper extensions", () => {
    expect(normalizeHarmonyHint("C9")?.pitchClasses).toEqual([0, 2, 4, 7, 10]);
    expect(normalizeHarmonyHint("C13")?.pitchClasses).toEqual([0, 4, 7, 9, 10]);
  });

  test("returns undefined for invalid symbols", () => {
    expect(normalizeHarmonyHint("not-a-chord")).toBeUndefined();
    expect(normalizeHarmonyHint("")).toBeUndefined();
    expect(normalizeHarmonyHint("Cmaj/not-a-note")).toBeUndefined();
  });

  test("does not misread maj7 as minor", () => {
    expect(normalizeHarmonyHint("Cmaj7")?.pitchClasses).toEqual([0, 4, 7, 11]);
  });
});
