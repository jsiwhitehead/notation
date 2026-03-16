import { describe, expect, test } from "bun:test";

import { normalizeHarmonicGuidance } from "../src/chord";

describe("normalizeHarmonicGuidance", () => {
  test("normalizes whitespace and letter case", () => {
    expect(normalizeHarmonicGuidance("  gSuS4  ")).toEqual({
      groundPitchClass: 7,
      pitchClasses: [0, 2, 7],
      rootPitchClass: 7,
    });
  });

  test("supports 6/9 without forcing a dominant seventh", () => {
    expect(normalizeHarmonicGuidance("C6/9")).toEqual({
      groundPitchClass: 0,
      pitchClasses: [0, 2, 4, 7, 9],
      rootPitchClass: 0,
    });
  });

  test("adds a natural eleventh for 11 chords", () => {
    expect(normalizeHarmonicGuidance("C11")).toEqual({
      groundPitchClass: 0,
      pitchClasses: [0, 4, 5, 7, 10],
      rootPitchClass: 0,
    });
  });

  test("supports slash-ground grounding", () => {
    expect(normalizeHarmonicGuidance("Dmin7/A")).toEqual({
      groundPitchClass: 9,
      pitchClasses: [0, 2, 5, 9],
      rootPitchClass: 2,
    });
  });

  test("supports enharmonic root spellings", () => {
    expect(normalizeHarmonicGuidance("Dbmaj7")).toEqual({
      groundPitchClass: 1,
      pitchClasses: [0, 1, 5, 8],
      rootPitchClass: 1,
    });
    expect(normalizeHarmonicGuidance("Cbmaj")).toEqual({
      groundPitchClass: 11,
      pitchClasses: [3, 6, 11],
      rootPitchClass: 11,
    });
  });

  test("supports major, minor, diminished, and augmented qualities", () => {
    expect(normalizeHarmonicGuidance("Cmaj")?.pitchClasses).toEqual([0, 4, 7]);
    expect(normalizeHarmonicGuidance("Dmin")?.pitchClasses).toEqual([2, 5, 9]);
    expect(normalizeHarmonicGuidance("Bdim7")?.pitchClasses).toEqual([
      2, 5, 8, 11,
    ]);
    expect(normalizeHarmonicGuidance("Caug")?.pitchClasses).toEqual([0, 4, 8]);
  });

  test("supports suspension and alterations", () => {
    expect(normalizeHarmonicGuidance("Dsus2")?.pitchClasses).toEqual([2, 4, 9]);
    expect(normalizeHarmonicGuidance("Gsus4")?.pitchClasses).toEqual([0, 2, 7]);
    expect(normalizeHarmonicGuidance("C7#5")?.pitchClasses).toEqual([
      0, 4, 8, 10,
    ]);
    expect(normalizeHarmonicGuidance("C7b5")?.pitchClasses).toEqual([
      0, 4, 6, 10,
    ]);
    expect(normalizeHarmonicGuidance("C7b9#11")?.pitchClasses).toEqual([
      0, 1, 4, 6, 7, 10,
    ]);
  });

  test("supports upper extensions", () => {
    expect(normalizeHarmonicGuidance("C9")?.pitchClasses).toEqual([
      0, 2, 4, 7, 10,
    ]);
    expect(normalizeHarmonicGuidance("C13")?.pitchClasses).toEqual([
      0, 4, 7, 9, 10,
    ]);
  });

  test("returns undefined for invalid symbols", () => {
    expect(normalizeHarmonicGuidance("not-a-chord")).toBeUndefined();
    expect(normalizeHarmonicGuidance("")).toBeUndefined();
    expect(normalizeHarmonicGuidance("Cmaj/not-a-note")).toBeUndefined();
  });

  test("does not misread maj7 as minor", () => {
    expect(normalizeHarmonicGuidance("Cmaj7")?.pitchClasses).toEqual([
      0, 4, 7, 11,
    ]);
  });
});
