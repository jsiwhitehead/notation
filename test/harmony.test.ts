import { describe, expect, test } from "bun:test";

import { normalizeChordSymbol } from "../src/harmony/chord";
import { buildRegion } from "../src/harmony/region";
import { runEngine } from "../src/harmony";

import type { HarmonicRegion, PieceInput, SegmentInput } from "../src/model";

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
  expect([...region.pitchClasses].sort((a, b) => a - b)).toEqual(
    [...pitchClasses].sort((a, b) => a - b),
  );
}

describe("buildRegion", () => {
  test("derives canonical lanes for a diatonic two-span region", () => {
    expect(buildRegion([0, 2, 4, 5, 7, 9, 11])).toMatchObject({
      lanes: [
        { end: 4, start: 0 },
        { end: 11, start: 5 },
      ],
      pitchClasses: [0, 7, 2, 9, 4, 11, 5],
    });
  });

  test("derives canonical lanes for a paired fourth-chain region", () => {
    expect(buildRegion([0, 7, 2, 9])).toMatchObject({
      lanes: [
        { end: 2, start: 0 },
        { end: 9, start: 7 },
      ],
      pitchClasses: [0, 7, 2, 9],
    });
  });

  test("keeps semitone-adjacent clusters as separate single-step lanes", () => {
    expect(buildRegion([11, 0, 1])).toMatchObject({
      lanes: [
        { end: 0, start: 0 },
        { end: 1, start: 1 },
        { end: 11, start: 11 },
      ],
      pitchClasses: [0, 11, 1],
    });
  });
});

describe("runEngine", () => {
  describe("single-segment local filling", () => {
    test("is deterministic for the same single-segment input", () => {
      const input = {
        segments: [
          {
            chordSymbol: "Cmaj7",
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
        chordSymbol: "Cmaj7",
        events: [],
      });

      expectRegionPitchClasses(segment.center, [0, 7, 2, 9, 4, 11]);
      expectRegionPitchClasses(segment.field, [0, 7, 2, 9, 4, 11]);
      expect(segment.grounding).toEqual({ ground: 0, root: 0 });
    });

    test("combines melodic events and chord symbols into one local center", () => {
      const segment = getSingleSegment({
        chordSymbol: "Cmaj",
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
        chordSymbol: "Dmin7/A",
        events: [],
      });

      expectRegionPitchClasses(segment.center, [5, 0, 7, 2, 9]);
      expectRegionPitchClasses(segment.field, [5, 0, 7, 2, 9]);
      expect(segment.grounding).toEqual({ ground: 9, root: 2 });
    });

    test("fills short internal fifth-gaps in dominant-seventh evidence", () => {
      const segment = getSingleSegment({
        chordSymbol: "G7",
        events: [],
      });

      expectRegionPitchClasses(segment.center, [5, 0, 7, 2, 9, 4, 11]);
      expectRegionPitchClasses(segment.field, [5, 0, 7, 2, 9, 4, 11]);
      expect(segment.grounding).toEqual({ ground: 7, root: 7 });
    });

    test("keeps altered-fifth chord evidence sparse rather than forcing a naturalized run", () => {
      const segment = getSingleSegment({
        chordSymbol: "C7b5",
        events: [],
      });

      expectRegionPitchClasses(segment.center, []);
      expectRegionPitchClasses(segment.field, []);
      expect(segment.grounding).toEqual({ ground: 0, root: 0 });
    });

    test("treats augmented-triad evidence as invalid under the baseline two-span rule", () => {
      const segment = getSingleSegment({
        chordSymbol: "Caug",
        events: [],
      });

      expectRegionPitchClasses(segment.center, []);
      expectRegionPitchClasses(segment.field, []);
      expect(segment.grounding).toEqual({ ground: 0, root: 0 });
    });

    test("treats diminished-seventh evidence as invalid when its paired lanes overlap", () => {
      const segment = getSingleSegment({
        chordSymbol: "Bdim7",
        events: [],
      });

      expectRegionPitchClasses(segment.center, []);
      expectRegionPitchClasses(segment.field, []);
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

    test("keeps a direct chromatic three-note cluster out of center and field", () => {
      const segment = getSingleSegment({
        events: [
          { duration: 1, pitch: 60, type: "note" },
          { duration: 1, pitch: 61, type: "note" },
          { duration: 1, pitch: 62, type: "note" },
        ],
      });

      expectRegionPitchClasses(segment.center, []);
      expectRegionPitchClasses(segment.field, []);
      expect(segment.grounding).toBeUndefined();
    });

    test("rescues a longer direct chromatic run when filling reaches a paired baseline region", () => {
      const segment = getSingleSegment({
        events: [
          { duration: 1, pitch: 60, type: "note" },
          { duration: 1, pitch: 61, type: "note" },
          { duration: 1, pitch: 62, type: "note" },
          { duration: 1, pitch: 63, type: "note" },
        ],
      });

      expectRegionPitchClasses(segment.center, [0, 7, 2, 1, 8, 3, 10, 5]);
      expectRegionPitchClasses(segment.field, [0, 7, 2, 1, 8, 3, 10, 5]);
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
        chordSymbol: "C13",
        events: [],
      });

      expectRegionPitchClasses(segment.center, [10, 5, 0, 7, 2, 9, 4]);
      expectRegionPitchClasses(segment.field, [10, 5, 0, 7, 2, 9, 4]);
      expect(segment.grounding).toEqual({ ground: 0, root: 0 });
    });

    test("keeps suspended harmony from inventing third-quality content", () => {
      const segment = getSingleSegment({
        chordSymbol: "Csus4",
        events: [],
      });

      expectRegionPitchClasses(segment.center, [0, 5, 7]);
      expectRegionPitchClasses(segment.field, [0, 5, 7]);
      expect(segment.grounding).toEqual({ ground: 0, root: 0 });
    });

    test("treats altered extension evidence as invalid when its paired lanes overlap", () => {
      const segment = getSingleSegment({
        chordSymbol: "C7#11",
        events: [],
      });

      expectRegionPitchClasses(segment.center, []);
      expectRegionPitchClasses(segment.field, []);
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
        chordSymbol: "Cmaj7",
        events: [
          { duration: 1, pitch: 62, type: "note" },
          { duration: 1, pitches: [60, 64, 67], type: "chord" },
        ],
      });
      const reversed = getSingleSegment({
        chordSymbol: "Cmaj7",
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

    test("keeps a chromatic passing note inside the underlying local harmonic region", () => {
      const segment = getSingleSegment({
        events: [
          { duration: 1, offset: 0, pitch: 64, type: "note" },
          { duration: 1, offset: 1, pitch: 65, type: "note" },
          { duration: 1, offset: 2, pitch: 67, type: "note" },
          { duration: 0.5, offset: 3, pitch: 66, type: "note" },
        ],
        timeSignature: { beatType: 4, beats: 4 },
      });

      expectRegionPitchClasses(segment.center, [0, 7, 2, 9, 4, 5]);
      expectRegionPitchClasses(segment.field, [0, 7, 2, 9, 4, 5]);
      expect(segment.grounding).toBeUndefined();
    });

    test("moves to a new local harmonic region when the following segment confirms the chromatic reinterpretation", () => {
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
        [0, 7, 2, 9, 4, 5],
      );
      expectRegionPitchClasses(
        structure.segments[0]!.field,
        [0, 7, 2, 9, 4, 5],
      );
      expect(structure.segments[0]!.grounding).toBeUndefined();
      expectRegionPitchClasses(
        structure.segments[1]!.center,
        [7, 2, 9, 4, 11, 6],
      );
      expectRegionPitchClasses(
        structure.segments[1]!.field,
        [7, 2, 9, 4, 11, 6],
      );
      expect(structure.segments[1]!.grounding).toBeUndefined();
    });
  });

  test("broadens field through continuity across adjacent centers", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbol: "Cmaj",
          events: [],
        },
        {
          chordSymbol: "Cmaj7",
          events: [],
        },
        {
          chordSymbol: "C6/9",
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

    expectRegionPitchClasses(structure.segments[0]!.field, [0, 7, 2, 9, 4, 11]);
    expectRegionPitchClasses(structure.segments[1]!.field, [0, 7, 2, 9, 4, 11]);
    expectRegionPitchClasses(structure.segments[2]!.field, [0, 7, 2, 9, 4, 11]);
  });

  test("broadens field across a basic ii-V-I progression", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbol: "Dmin7",
          events: [],
        },
        {
          chordSymbol: "G7",
          events: [],
        },
        {
          chordSymbol: "Cmaj7",
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

    expectRegionPitchClasses(
      structure.segments[0]!.field,
      [5, 0, 7, 2, 9, 4, 11],
    );
    expectRegionPitchClasses(
      structure.segments[1]!.field,
      [5, 0, 7, 2, 9, 4, 11],
    );
    expectRegionPitchClasses(
      structure.segments[2]!.field,
      [5, 0, 7, 2, 9, 4, 11],
    );
  });

  test("broadens field across a cadential V-I pair", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbol: "G7",
          events: [],
        },
        {
          chordSymbol: "Cmaj7",
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
      [5, 0, 7, 2, 9, 4, 11],
    );
  });

  test("broadens field across a ii-V pair without requiring tonic arrival", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbol: "Dmin7",
          events: [],
        },
        {
          chordSymbol: "G7",
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
      structure.segments[0]!.field,
      [5, 0, 7, 2, 9, 4, 11],
    );
    expectRegionPitchClasses(
      structure.segments[1]!.field,
      [5, 0, 7, 2, 9, 4, 11],
    );
  });

  test("keeps a deceptive ii-V-vi less unified than a ii-V-I while still broadening through the dominant", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbol: "Dmin7",
          events: [],
        },
        {
          chordSymbol: "G7",
          events: [],
        },
        {
          chordSymbol: "Amin7",
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

    expectRegionPitchClasses(
      structure.segments[0]!.field,
      [5, 0, 7, 2, 9, 4, 11],
    );
    expectRegionPitchClasses(
      structure.segments[1]!.field,
      [5, 0, 7, 2, 9, 4, 11],
    );
    expectRegionPitchClasses(
      structure.segments[2]!.field,
      [5, 0, 7, 2, 9, 4, 11],
    );
  });

  test("does not widen field when neighbors share only two pitch classes", () => {
    const structure = runEngine({
      segments: [
        {
          chordSymbol: "Cmaj7",
          events: [],
        },
        {
          chordSymbol: "Abmaj7",
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
          chordSymbol: "Cmaj",
          events: [],
        },
        {
          chordSymbol: "F#maj",
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
      duration: 3.5,
      startOffset: 0,
    });
    expect(structure.segments[0]!.harmonicSlices[1]).toMatchObject({
      duration: 0.5,
      startOffset: 3.5,
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
      [0, 7, 2, 9, 4, 11, 6],
    );
    expectRegionPitchClasses(
      structure.segments[0]!.harmonicSlices[1]!.harmonic.field,
      [0, 7, 2, 9, 4, 11, 6],
    );
  });
});
