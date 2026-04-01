import { describe, expect, test } from "bun:test";

import { normalizeChordSymbol } from "../src/harmony/chord";
import {
  buildRegion,
  getRegionPitchClasses,
  getRegionSpans,
  isBaselineValidRegion,
} from "../src/harmony/region";
import { runEngine } from "../src/harmony";

import type { HarmonicRegion, PieceInput, SegmentInput } from "../src/model";

function chordSymbolsAtStart(symbol: string) {
  return [{ offset: 0, symbol }];
}

describe("normalizeChordSymbol", () => {
  test("normalizes whitespace and letter case", () => {
    expect(normalizeChordSymbol("  gSuS4  ")).toEqual({
      groundPitchClass: 7,
      pitchClasses: [0, 2, 7],
      rootPitchClass: 7,
    });
  });

  test("supports 6/9 without forcing a dominant seventh", () => {
    expect(normalizeChordSymbol("C6/9")).toEqual({
      groundPitchClass: 0,
      pitchClasses: [0, 2, 4, 7, 9],
      rootPitchClass: 0,
    });
  });

  test("adds a natural eleventh for 11 chords", () => {
    expect(normalizeChordSymbol("C11")).toEqual({
      groundPitchClass: 0,
      pitchClasses: [0, 4, 5, 7, 10],
      rootPitchClass: 0,
    });
  });

  test("supports slash-ground grounding", () => {
    expect(normalizeChordSymbol("Dmin7/A")).toEqual({
      groundPitchClass: 9,
      pitchClasses: [0, 2, 5, 9],
      rootPitchClass: 2,
    });
  });

  test("supports enharmonic root spellings", () => {
    expect(normalizeChordSymbol("Dbmaj7")).toEqual({
      groundPitchClass: 1,
      pitchClasses: [0, 1, 5, 8],
      rootPitchClass: 1,
    });
    expect(normalizeChordSymbol("Cbmaj")).toEqual({
      groundPitchClass: 11,
      pitchClasses: [3, 6, 11],
      rootPitchClass: 11,
    });
  });

  test("supports major, minor, diminished, and augmented qualities", () => {
    expect(normalizeChordSymbol("Cmaj")?.pitchClasses).toEqual([0, 4, 7]);
    expect(normalizeChordSymbol("Dmin")?.pitchClasses).toEqual([2, 5, 9]);
    expect(normalizeChordSymbol("Bdim7")?.pitchClasses).toEqual([2, 5, 8, 11]);
    expect(normalizeChordSymbol("Caug")?.pitchClasses).toEqual([0, 4, 8]);
  });

  test("supports suspension and alterations", () => {
    expect(normalizeChordSymbol("Dsus2")?.pitchClasses).toEqual([2, 4, 9]);
    expect(normalizeChordSymbol("Gsus4")?.pitchClasses).toEqual([0, 2, 7]);
    expect(normalizeChordSymbol("C7#5")?.pitchClasses).toEqual([0, 4, 8, 10]);
    expect(normalizeChordSymbol("C7b5")?.pitchClasses).toEqual([0, 4, 6, 10]);
    expect(normalizeChordSymbol("C7b9#11")?.pitchClasses).toEqual([
      0, 1, 4, 6, 7, 10,
    ]);
  });

  test("supports upper extensions", () => {
    expect(normalizeChordSymbol("C9")?.pitchClasses).toEqual([0, 2, 4, 7, 10]);
    expect(normalizeChordSymbol("C13")?.pitchClasses).toEqual([0, 4, 7, 9, 10]);
  });

  test("supports added-tone modifiers without implying a seventh", () => {
    expect(normalizeChordSymbol("Cadd9")?.pitchClasses).toEqual([0, 2, 4, 7]);
    expect(normalizeChordSymbol("Cadd#11")?.pitchClasses).toEqual([
      0, 4, 6, 7,
    ]);
  });

  test("always includes slash-ground in committed pitch classes", () => {
    expect(normalizeChordSymbol("Cmaj/Gb")).toEqual({
      groundPitchClass: 6,
      pitchClasses: [0, 4, 6, 7],
      rootPitchClass: 0,
    });
  });

  test("ignores unsupported added degrees", () => {
    expect(normalizeChordSymbol("Cadd8")).toEqual({
      groundPitchClass: 0,
      pitchClasses: [0, 4, 7],
      rootPitchClass: 0,
    });
  });

  test("returns undefined for invalid symbols", () => {
    expect(normalizeChordSymbol("not-a-chord")).toBeUndefined();
    expect(normalizeChordSymbol("")).toBeUndefined();
    expect(normalizeChordSymbol("Cmaj/not-a-note")).toBeUndefined();
  });

  test("does not misread maj7 as minor", () => {
    expect(normalizeChordSymbol("Cmaj7")?.pitchClasses).toEqual([0, 4, 7, 11]);
  });
});

function getSegment(input: PieceInput) {
  return runEngine(input).segments[0]!;
}

function getSingleSegment(segment: SegmentInput) {
  return getSegment({ segments: [segment] });
}

function expectSingleSegmentCenter(
  segment: SegmentInput,
  pitchClasses: number[],
): void {
  expectRegionPitchClasses(getSingleSegment(segment).center, pitchClasses);
}

function expectRegionPitchClasses(
  region: HarmonicRegion,
  pitchClasses: number[],
): void {
  expect([...getRegionPitchClasses(region)].sort((a, b) => a - b)).toEqual(
    [...pitchClasses].sort((a, b) => a - b),
  );
}

describe("buildRegion", () => {
  test("derives canonical lanes for a diatonic two-span region", () => {
    expectRegionPitchClasses(buildRegion([0, 2, 4, 5, 7, 9, 11]), [
      0, 7, 2, 9, 4, 11, 5,
    ]);
    expect(getRegionSpans(buildRegion([0, 2, 4, 5, 7, 9, 11]))).toEqual([
      { end: 4, start: 0 },
      { end: 11, start: 5 },
    ]);
  });

  test("derives canonical lanes for a paired fourth-chain region", () => {
    expectRegionPitchClasses(buildRegion([0, 7, 2, 9]), [0, 7, 2, 9]);
    expect(getRegionSpans(buildRegion([0, 7, 2, 9]))).toEqual([
      { end: 2, start: 0 },
      { end: 9, start: 7 },
    ]);
  });

  test("keeps semitone-adjacent clusters as separate single-step lanes", () => {
    expectRegionPitchClasses(buildRegion([11, 0, 1]), [0, 11, 1]);
    expect(getRegionSpans(buildRegion([11, 0, 1]))).toEqual([
      { end: 0, start: 0 },
      { end: 1, start: 1 },
      { end: 11, start: 11 },
    ]);
  });

  test("rejects paired lanes that overlap after octave repetition", () => {
    expect(isBaselineValidRegion([2, 9, 4, 11, 6, 1, 8, 3])).toBe(false);
    expect(getRegionSpans(buildRegion([2, 9, 4, 11, 6, 1, 8, 3]))).toEqual([
      { end: 2, start: 2 },
      { end: 3, start: 3 },
      { end: 8, start: 4 },
      { end: 13, start: 9 },
    ]);
  });
});

describe("runEngine", () => {
  describe("single-segment local filling", () => {
    test("is deterministic for the same single-segment input", () => {
      const input = {
        segments: [
          {
            chordSymbols: chordSymbolsAtStart("Cmaj7"),
            events: [{ duration: 1, pitch: 62, type: "note" as const }],
          },
        ],
      };

      expect(runEngine(input)).toEqual(runEngine(input));
    });

    test("keeps empty local evidence empty", () => {
      const segment = getSingleSegment({
        events: [{ duration: 1, type: "rest" }],
      });

      expectRegionPitchClasses(segment.center, []);
      expectRegionPitchClasses(segment.field, []);
      expect(segment.grounding).toBeUndefined();
    });

    test("derives a local filled center from event evidence", () => {
      const segment = getSingleSegment({
        events: [{ duration: 1, pitches: [60, 64, 67], type: "chord" }],
      });

      expectRegionPitchClasses(segment.center, [0, 7, 2, 9, 4]);
      expectRegionPitchClasses(segment.field, [0, 7, 2, 9, 4]);
    });

    test("treats chord symbols as one committed local evidence set", () => {
      const segment = getSingleSegment({
        chordSymbols: chordSymbolsAtStart("Cmaj7"),
        events: [],
      });

      expectRegionPitchClasses(segment.center, [0, 7, 2, 9, 4, 11]);
      expectRegionPitchClasses(segment.field, [0, 7, 2, 9, 4, 11]);
      expect(segment.grounding).toEqual({ ground: 0, root: 0 });
    });

    test("combines melodic events and chord symbols into one local center", () => {
      const segment = getSingleSegment({
        chordSymbols: chordSymbolsAtStart("Cmaj"),
        events: [{ duration: 1, pitch: 62, type: "note" }],
      });

      expectRegionPitchClasses(segment.center, [0, 7, 2, 9, 4]);
      expectRegionPitchClasses(segment.field, [0, 7, 2, 9, 4]);
    });

    test("keeps weak event-only evidence sparse when it does not settle a region", () => {
      const segment = getSingleSegment({
        events: [
          { duration: 1, pitch: 60, type: "note" },
          { duration: 1, pitch: 66, type: "note" },
        ],
      });

      expectRegionPitchClasses(segment.center, [0, 6]);
      expectRegionPitchClasses(segment.field, [0, 6]);
      expect(segment.grounding).toBeUndefined();
    });

    test("fills a two-note dyad along the unique shorter fifths path", () => {
      const segment = getSingleSegment({
        events: [
          { duration: 1, pitch: 67, type: "note" },
          { duration: 1, pitch: 71, type: "note" },
        ],
      });

      expectRegionPitchClasses(segment.center, [7, 2, 9, 4, 11]);
      expectRegionPitchClasses(segment.field, [7, 2, 9, 4, 11]);
      expect(segment.grounding).toBeUndefined();
    });

    test("keeps a two-note tritone dyad unfilled when the fifths path is ambiguous", () => {
      const segment = getSingleSegment({
        events: [
          { duration: 1, pitch: 60, type: "note" },
          { duration: 1, pitch: 66, type: "note" },
        ],
      });

      expectRegionPitchClasses(segment.center, [0, 6]);
      expectRegionPitchClasses(segment.field, [0, 6]);
      expect(segment.grounding).toBeUndefined();
    });

    test("fills a uniquely implied up-to-tritone fifths run for three-note evidence", () => {
      const segment = getSingleSegment({
        events: [
          { duration: 1, pitch: 60, type: "note" },
          { duration: 1, pitch: 62, type: "note" },
          { duration: 1, pitch: 66, type: "note" },
        ],
      });

      expectRegionPitchClasses(segment.center, [0, 7, 2, 9, 4, 11, 6]);
      expectRegionPitchClasses(segment.field, [0, 7, 2, 9, 4, 11, 6]);
      expect(segment.grounding).toBeUndefined();
    });

    test("uses chord root and ground to orient local grounding", () => {
      const segment = getSingleSegment({
        chordSymbols: chordSymbolsAtStart("Dmin7/A"),
        events: [],
      });

      expectRegionPitchClasses(segment.center, [5, 0, 7, 2, 9]);
      expectRegionPitchClasses(segment.field, [5, 0, 7, 2, 9]);
      expect(segment.grounding).toEqual({ ground: 9, root: 2 });
    });

    test("fills short internal fifth-gaps in dominant-seventh evidence", () => {
      const segment = getSingleSegment({
        chordSymbols: chordSymbolsAtStart("G7"),
        events: [],
      });

      expectRegionPitchClasses(segment.center, [5, 0, 7, 2, 9, 4, 11]);
      expectRegionPitchClasses(segment.field, [5, 0, 7, 2, 9, 4, 11]);
      expect(segment.grounding).toEqual({ ground: 7, root: 7 });
    });

    test("selects an expanded span cover for altered-fifth chord evidence", () => {
      const segment = getSingleSegment({
        chordSymbols: chordSymbolsAtStart("C7b5"),
        events: [],
      });

      expectRegionPitchClasses(segment.center, [1, 3, 4, 6, 8, 10, 11]);
      expectRegionPitchClasses(segment.field, [1, 3, 4, 6, 8, 10, 11]);
      expect(segment.grounding).toEqual({ ground: 0, root: 0 });
    });

    test("selects a weighted span cover for augmented-triad evidence", () => {
      const segment = getSingleSegment({
        chordSymbols: chordSymbolsAtStart("Caug"),
        events: [],
      });

      expectRegionPitchClasses(segment.center, [1, 4, 6, 8, 11]);
      expectRegionPitchClasses(segment.field, [1, 4, 6, 8, 11]);
      expect(segment.grounding).toEqual({ ground: 0, root: 0 });
    });

    test("selects a weighted span cover for diminished-seventh evidence", () => {
      const segment = getSingleSegment({
        chordSymbols: chordSymbolsAtStart("Bdim7"),
        events: [],
      });

      expectRegionPitchClasses(segment.center, [1, 3, 5, 6, 8, 10, 11]);
      expectRegionPitchClasses(segment.field, [1, 3, 5, 6, 8, 10, 11]);
      expect(segment.grounding).toEqual({ ground: 11, root: 11 });
    });

    test("fills short fifth-gaps in symmetric event-only evidence when the result stays structurally valid", () => {
      const segment = getSingleSegment({
        events: [
          { duration: 1, pitch: 60, type: "note" },
          { duration: 1, pitch: 66, type: "note" },
          { duration: 1, pitch: 69, type: "note" },
        ],
      });

      expectRegionPitchClasses(segment.center, [0, 7, 2, 9, 4, 11, 6]);
      expectRegionPitchClasses(segment.field, [0, 7, 2, 9, 4, 11, 6]);
      expect(segment.grounding).toBeUndefined();
    });

    test("reduces a chromatic three-note cluster to the best-supported sparse cover", () => {
      const segment = getSingleSegment({
        events: [
          { duration: 1, pitch: 60, type: "note" },
          { duration: 1, pitch: 61, type: "note" },
          { duration: 1, pitch: 62, type: "note" },
        ],
      });

      expectRegionPitchClasses(segment.center, [0, 2]);
      expectRegionPitchClasses(segment.field, [0, 2]);
      expect(segment.grounding).toBeUndefined();
    });

    test("selects a compact span cover inside a longer chromatic run", () => {
      const segment = getSingleSegment({
        events: [
          { duration: 1, pitch: 60, type: "note" },
          { duration: 1, pitch: 61, type: "note" },
          { duration: 1, pitch: 62, type: "note" },
          { duration: 1, pitch: 63, type: "note" },
        ],
      });

      expectRegionPitchClasses(segment.center, [0, 2, 3, 5, 7]);
      expectRegionPitchClasses(segment.field, [0, 2, 3, 5, 7]);
      expect(segment.grounding).toBeUndefined();
    });

    test("keeps event-driven chromatic inflection sparse when fifth filling would erase the span structure", () => {
      const segment = getSingleSegment({
        events: [
          { duration: 1, pitch: 53, type: "note" },
          { duration: 1, pitch: 57, type: "note" },
          { duration: 1, pitch: 62, type: "note" },
          { duration: 1, pitch: 64, type: "note" },
          { duration: 1, pitch: 65, type: "note" },
          { duration: 1, pitch: 67, type: "note" },
          { duration: 1, pitch: 69, type: "note" },
          { duration: 1, pitch: 71, type: "note" },
          { duration: 1, pitch: 73, type: "note" },
          { duration: 1, pitch: 74, type: "note" },
          { duration: 1, pitch: 76, type: "note" },
          { duration: 1, pitch: 77, type: "note" },
          { duration: 1, pitch: 79, type: "note" },
        ],
      });

      expectRegionPitchClasses(segment.center, [7, 2, 9, 4, 11, 1, 5]);
      expectRegionPitchClasses(segment.field, [7, 2, 9, 4, 11, 1, 5]);
      expect(segment.grounding).toBeUndefined();
    });

    test("keeps an extension-bearing local center as one direct evidence set", () => {
      const segment = getSingleSegment({
        chordSymbols: chordSymbolsAtStart("C13"),
        events: [],
      });

      expectRegionPitchClasses(segment.center, [10, 5, 0, 7, 2, 9, 4]);
      expectRegionPitchClasses(segment.field, [10, 5, 0, 7, 2, 9, 4]);
      expect(segment.grounding).toEqual({ ground: 0, root: 0 });
    });

    test("allows suspended harmony to collapse to its non-singleton span support", () => {
      const segment = getSingleSegment({
        chordSymbols: chordSymbolsAtStart("Csus4"),
        events: [],
      });

      expectRegionPitchClasses(segment.center, [5, 7]);
      expectRegionPitchClasses(segment.field, [5, 7]);
      expect(segment.grounding).toEqual({ ground: 0, root: 0 });
    });

    test("selects an expanded span cover for altered extension evidence", () => {
      const segment = getSingleSegment({
        chordSymbols: chordSymbolsAtStart("C7#11"),
        events: [],
      });

      expectRegionPitchClasses(segment.center, [0, 2, 4, 6, 7, 9, 10]);
      expectRegionPitchClasses(segment.field, [0, 2, 4, 6, 7, 9, 10]);
      expect(segment.grounding).toEqual({ ground: 0, root: 0 });
    });

    test("ignores duplicated local evidence when deriving the center", () => {
      expectSingleSegmentCenter(
        {
          events: [
            { duration: 1, pitches: [60, 64, 67], type: "chord" },
            { duration: 1, pitches: [72, 76, 79], type: "chord" },
            { duration: 1, pitch: 60, type: "note" },
          ],
        },
        [0, 7, 2, 9, 4],
      );
    });

    test("is invariant to event ordering within a segment", () => {
      const forward = getSingleSegment({
        chordSymbols: chordSymbolsAtStart("Cmaj7"),
        events: [
          { duration: 1, pitch: 62, type: "note" },
          { duration: 1, pitches: [60, 64, 67], type: "chord" },
        ],
      });
      const reversed = getSingleSegment({
        chordSymbols: chordSymbolsAtStart("Cmaj7"),
        events: [
          { duration: 1, pitches: [60, 64, 67], type: "chord" },
          { duration: 1, pitch: 62, type: "note" },
        ],
      });

      expect(reversed.center).toEqual(forward.center);
      expect(reversed.field).toEqual(forward.field);
      expect(reversed.grounding).toEqual(forward.grounding);
    });

    test("treats later diatonic filling as completion of one local harmonic region", () => {
      const segment = getSingleSegment({
        events: [
          { duration: 1, offset: 0, pitch: 60, type: "note" },
          { duration: 1, offset: 1, pitch: 62, type: "note" },
          { duration: 1, offset: 2, pitch: 64, type: "note" },
          { duration: 1, offset: 3, pitch: 65, type: "note" },
        ],
        timeSignature: { beatType: 4, beats: 4 },
      });

      expectRegionPitchClasses(segment.center, [0, 7, 2, 9, 4, 5]);
      expectRegionPitchClasses(segment.field, [0, 7, 2, 9, 4, 5]);
      expect(segment.grounding).toBeUndefined();
    });

    test("lets a chromatic passing note contract the selected local region", () => {
      const segment = getSingleSegment({
        events: [
          { duration: 1, offset: 0, pitch: 64, type: "note" },
          { duration: 1, offset: 1, pitch: 65, type: "note" },
          { duration: 1, offset: 2, pitch: 67, type: "note" },
          { duration: 0.5, offset: 3, pitch: 66, type: "note" },
        ],
        timeSignature: { beatType: 4, beats: 4 },
      });

      expectRegionPitchClasses(segment.center, [0, 7, 2, 4, 5]);
      expectRegionPitchClasses(segment.field, [0, 7, 2, 4, 5]);
      expect(segment.grounding).toBeUndefined();
    });

    test("keeps the contracted local region before a following reinterpretation", () => {
      const structure = runEngine({
        segments: [
          {
            events: [
              { duration: 1, offset: 0, pitch: 64, type: "note" },
              { duration: 1, offset: 1, pitch: 65, type: "note" },
              { duration: 1, offset: 2, pitch: 67, type: "note" },
              { duration: 0.5, offset: 3.5, pitch: 66, type: "note" },
            ],
            timeSignature: { beatType: 4, beats: 4 },
          },
          {
            events: [
              { duration: 1, offset: 0, pitch: 64, type: "note" },
              { duration: 1, offset: 1, pitch: 66, type: "note" },
              { duration: 1, offset: 2, pitch: 67, type: "note" },
            ],
            timeSignature: { beatType: 4, beats: 4 },
          },
        ],
      });

      expectRegionPitchClasses(
        structure.segments[0]!.center,
        [0, 7, 2, 4, 5],
      );
      expectRegionPitchClasses(
        structure.segments[0]!.field,
        [0, 7, 2, 4, 5],
      );
      expect(structure.segments[0]!.grounding).toBeUndefined();
      expectRegionPitchClasses(
        structure.segments[1]!.center,
        [7, 9, 4, 11, 6],
      );
      expectRegionPitchClasses(
        structure.segments[1]!.field,
        [7, 9, 4, 11, 6],
      );
      expect(structure.segments[1]!.grounding).toBeUndefined();
    });
  });

  test("keeps field aligned with center across adjacent centers for now", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbols: chordSymbolsAtStart("Cmaj"),
          events: [],
        },
        {
          chordSymbols: chordSymbolsAtStart("Cmaj7"),
          events: [],
        },
        {
          chordSymbols: chordSymbolsAtStart("C6/9"),
          events: [],
        },
      ],
    });

    expectRegionPitchClasses(structure.segments[0]!.center, [0, 7, 2, 9, 4]);
    expectRegionPitchClasses(
      structure.segments[1]!.center,
      [0, 7, 2, 9, 4, 11],
    );
    expectRegionPitchClasses(structure.segments[2]!.center, [0, 7, 2, 9, 4]);

    expectRegionPitchClasses(structure.segments[0]!.field, [0, 7, 2, 9, 4]);
    expectRegionPitchClasses(structure.segments[1]!.field, [0, 7, 2, 9, 4, 11]);
    expectRegionPitchClasses(structure.segments[2]!.field, [0, 7, 2, 9, 4]);
  });

  test("keeps field aligned with center across a basic ii-V-I progression", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbols: chordSymbolsAtStart("Dmin7"),
          events: [],
        },
        {
          chordSymbols: chordSymbolsAtStart("G7"),
          events: [],
        },
        {
          chordSymbols: chordSymbolsAtStart("Cmaj7"),
          events: [],
        },
      ],
    });

    expectRegionPitchClasses(structure.segments[0]!.center, [5, 0, 7, 2, 9]);
    expectRegionPitchClasses(
      structure.segments[1]!.center,
      [5, 0, 7, 2, 9, 4, 11],
    );
    expectRegionPitchClasses(
      structure.segments[2]!.center,
      [0, 7, 2, 9, 4, 11],
    );

    expectRegionPitchClasses(structure.segments[0]!.field, [5, 0, 7, 2, 9]);
    expectRegionPitchClasses(
      structure.segments[1]!.field,
      [5, 0, 7, 2, 9, 4, 11],
    );
    expectRegionPitchClasses(
      structure.segments[2]!.field,
      [0, 7, 2, 9, 4, 11],
    );
  });

  test("keeps field aligned with center across a cadential V-I pair", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbols: chordSymbolsAtStart("G7"),
          events: [],
        },
        {
          chordSymbols: chordSymbolsAtStart("Cmaj7"),
          events: [],
        },
      ],
    });

    expectRegionPitchClasses(
      structure.segments[0]!.center,
      [5, 0, 7, 2, 9, 4, 11],
    );
    expectRegionPitchClasses(
      structure.segments[1]!.center,
      [0, 7, 2, 9, 4, 11],
    );

    expectRegionPitchClasses(
      structure.segments[0]!.field,
      [5, 0, 7, 2, 9, 4, 11],
    );
    expectRegionPitchClasses(
      structure.segments[1]!.field,
      [0, 7, 2, 9, 4, 11],
    );
  });

  test("keeps field aligned with center across a ii-V pair", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbols: chordSymbolsAtStart("Dmin7"),
          events: [],
        },
        {
          chordSymbols: chordSymbolsAtStart("G7"),
          events: [],
        },
      ],
    });

    expectRegionPitchClasses(structure.segments[0]!.center, [5, 0, 7, 2, 9]);
    expectRegionPitchClasses(
      structure.segments[1]!.center,
      [5, 0, 7, 2, 9, 4, 11],
    );

    expectRegionPitchClasses(structure.segments[0]!.field, [5, 0, 7, 2, 9]);
    expectRegionPitchClasses(
      structure.segments[1]!.field,
      [5, 0, 7, 2, 9, 4, 11],
    );
  });

  test("keeps field aligned with center across a deceptive ii-V-vi", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbols: chordSymbolsAtStart("Dmin7"),
          events: [],
        },
        {
          chordSymbols: chordSymbolsAtStart("G7"),
          events: [],
        },
        {
          chordSymbols: chordSymbolsAtStart("Amin7"),
          events: [],
        },
      ],
    });

    expectRegionPitchClasses(structure.segments[0]!.center, [5, 0, 7, 2, 9]);
    expectRegionPitchClasses(
      structure.segments[1]!.center,
      [5, 0, 7, 2, 9, 4, 11],
    );
    expectRegionPitchClasses(structure.segments[2]!.center, [0, 7, 2, 9, 4]);

    expectRegionPitchClasses(structure.segments[0]!.field, [5, 0, 7, 2, 9]);
    expectRegionPitchClasses(
      structure.segments[1]!.field,
      [5, 0, 7, 2, 9, 4, 11],
    );
    expectRegionPitchClasses(
      structure.segments[2]!.field,
      [0, 7, 2, 9, 4],
    );
  });

  test("does not widen field when neighbors share only two pitch classes", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbols: chordSymbolsAtStart("Cmaj7"),
          events: [],
        },
        {
          chordSymbols: chordSymbolsAtStart("Abmaj7"),
          events: [],
        },
      ],
    });

    expectRegionPitchClasses(
      structure.segments[0]!.center,
      [0, 7, 2, 9, 4, 11],
    );
    expectRegionPitchClasses(
      structure.segments[1]!.center,
      [8, 3, 10, 5, 0, 7],
    );
    expectRegionPitchClasses(structure.segments[0]!.field, [0, 7, 2, 9, 4, 11]);
    expectRegionPitchClasses(structure.segments[1]!.field, [8, 3, 10, 5, 0, 7]);
  });

  test("does not widen field when neighboring centers do not strongly cohere", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbols: chordSymbolsAtStart("Cmaj"),
          events: [],
        },
        {
          chordSymbols: chordSymbolsAtStart("F#maj"),
          events: [],
        },
      ],
    });

    expectRegionPitchClasses(structure.segments[0]!.center, [0, 7, 2, 9, 4]);
    expectRegionPitchClasses(structure.segments[0]!.field, [0, 7, 2, 9, 4]);
  });

  test("prefers the later split onset when two slice boundaries tie on score", () => {
    const structure = runEngine({
      segments: [
        {
          events: [
            { duration: 0.25, layer: 0, offset: 0, pitch: 81, type: "note" },
            { duration: 1.5, layer: 1, offset: 0, pitch: 53, type: "note" },
            { duration: 0.25, layer: 0, offset: 0.25, pitch: 83, type: "note" },
            { duration: 0.25, layer: 0, offset: 0.5, pitch: 84, type: "note" },
            { duration: 0.25, layer: 0, offset: 0.75, pitch: 83, type: "note" },
            { duration: 0.25, layer: 0, offset: 1, pitch: 81, type: "note" },
            { duration: 0.25, layer: 0, offset: 1.25, pitch: 79, type: "note" },
            { duration: 0.25, layer: 0, offset: 1.5, pitch: 77, type: "note" },
            { duration: 0.5, layer: 1, offset: 1.5, pitch: 55, type: "note" },
            { duration: 0.25, layer: 0, offset: 1.75, pitch: 76, type: "note" },
            { duration: 0.25, layer: 0, offset: 2, pitch: 77, type: "note" },
            { duration: 1.5, layer: 1, offset: 2, pitch: 57, type: "note" },
            { duration: 0.25, layer: 0, offset: 2.25, pitch: 79, type: "note" },
            { duration: 0.25, layer: 0, offset: 2.5, pitch: 81, type: "note" },
            { duration: 0.25, layer: 0, offset: 2.75, pitch: 79, type: "note" },
            { duration: 0.25, layer: 0, offset: 3, pitch: 77, type: "note" },
            { duration: 0.25, layer: 0, offset: 3.25, pitch: 76, type: "note" },
            { duration: 0.5, layer: 1, offset: 3.5, pitch: 54, type: "note" },
            { duration: 0.25, layer: 0, offset: 3.5, pitch: 74, type: "note" },
            { duration: 0.25, layer: 0, offset: 3.75, pitch: 72, type: "note" },
          ],
          timeSignature: { beatType: 4, beats: 4 },
        },
      ],
    });

    expect(structure.segments[0]!.harmonicSlices).toHaveLength(2);
    expect(structure.segments[0]!.harmonicSlices[0]).toMatchObject({
      duration: 3.75,
      startOffset: 0,
    });
    expect(structure.segments[0]!.harmonicSlices[1]).toMatchObject({
      duration: 0.25,
      startOffset: 3.75,
    });
    expectRegionPitchClasses(
      structure.segments[0]!.harmonicSlices[0]!.harmonic.center,
      [0, 7, 2, 9, 4, 11, 5],
    );
    expectRegionPitchClasses(
      structure.segments[0]!.harmonicSlices[0]!.harmonic.field,
      [0, 7, 2, 9, 4, 11, 5],
    );
    expectRegionPitchClasses(
      structure.segments[0]!.harmonicSlices[1]!.harmonic.center,
      [0, 6],
    );
    expectRegionPitchClasses(
      structure.segments[0]!.harmonicSlices[1]!.harmonic.field,
      [0, 6],
    );
  });

  test("preserves timed chord-symbol grounding across a slice split", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbols: [
            { offset: 0, symbol: "Cmaj7" },
            { offset: 2, symbol: "F#maj7" },
          ],
          events: [
            { duration: 2, offset: 0, pitches: [60, 64, 67], type: "chord" },
            { duration: 2, offset: 2, pitches: [66, 70, 73], type: "chord" },
          ],
        },
      ],
    });

    expect(structure.segments[0]!.harmonicSlices).toHaveLength(2);
    expect(structure.segments[0]!.harmonicSlices[0]!.startOffset).toBe(0);
    expect(
      structure.segments[0]!.harmonicSlices[0]!.harmonic.grounding,
    ).toEqual({ ground: 0, root: 0 });
    expect(structure.segments[0]!.harmonicSlices[1]!.startOffset).toBe(2);
    expect(
      structure.segments[0]!.harmonicSlices[1]!.harmonic.grounding,
    ).toEqual({ ground: 6, root: 6 });
  });

  test("leaves segment grounding undefined when multiple timed chord symbols contribute evidence", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbols: [
            { offset: 0, symbol: "Cmaj7" },
            { offset: 2, symbol: "F#maj7" },
          ],
          events: [
            { duration: 2, offset: 0, pitches: [60, 64, 67], type: "chord" },
            { duration: 2, offset: 2, pitches: [66, 70, 73], type: "chord" },
          ],
        },
      ],
    });

    expect(structure.segments[0]!.grounding).toBeUndefined();
  });

  test("uses every chord-symbol change as a slice boundary", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbols: [
            { offset: 0, symbol: "Cmaj7" },
            { offset: 1, symbol: "F#maj7" },
            { offset: 3, symbol: "Abmaj7" },
          ],
          events: [
            { duration: 1, offset: 0, pitches: [60, 64, 67], type: "chord" },
            { duration: 2, offset: 1, pitches: [66, 70, 73], type: "chord" },
            { duration: 1, offset: 3, pitches: [68, 72, 75], type: "chord" },
          ],
        },
      ],
    });

    expect(structure.segments[0]!.harmonicSlices).toHaveLength(3);
    expect(structure.segments[0]!.harmonicSlices).toMatchObject([
      { duration: 1, startOffset: 0 },
      { duration: 2, startOffset: 1 },
      { duration: 1, startOffset: 3 },
    ]);
    expect(
      structure.segments[0]!.harmonicSlices[0]!.harmonic.grounding,
    ).toEqual({ ground: 0, root: 0 });
    expect(
      structure.segments[0]!.harmonicSlices[1]!.harmonic.grounding,
    ).toEqual({ ground: 6, root: 6 });
    expect(
      structure.segments[0]!.harmonicSlices[2]!.harmonic.grounding,
    ).toEqual({ ground: 8, root: 8 });
  });
});
