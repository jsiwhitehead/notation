import { describe, expect, test } from "bun:test";

import { runEngine } from "../src/engine";
import { uniqueFifthsOrderedPitchClasses } from "../src/pitch";

import type { HarmonicRegion, PieceInput, SegmentInput } from "../src/model";

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

function hasAdjacentSemitonePairs(pitchClasses: number[]): boolean {
  const sorted = [...new Set(pitchClasses)].sort((left, right) => left - right);

  if (sorted.length < 3) {
    return false;
  }

  const intervals = sorted.map((pitchClass, index) => {
    const nextPitchClass = sorted[(index + 1) % sorted.length]!;

    return (nextPitchClass - pitchClass + 12) % 12;
  });

  return intervals.some(
    (interval, index) =>
      interval === 1 && intervals[(index + 1) % intervals.length] === 1,
  );
}

function expectRegionPitchClasses(
  region: HarmonicRegion,
  pitchClasses: number[],
): void {
  expect(region).toEqual({
    pitchClasses: uniqueFifthsOrderedPitchClasses(pitchClasses),
  });
  expect(hasAdjacentSemitonePairs(region.pitchClasses)).toBe(false);
}

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
      expect(segment.grounding).toEqual({ ground: 0, root: 0 });
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

    test("keeps augmented-triad evidence sparse rather than forcing a run", () => {
      const segment = getSingleSegment({
        chordSymbol: "Caug",
        events: [],
      });

      expectRegionPitchClasses(segment.center, [0, 4, 8]);
      expectRegionPitchClasses(segment.field, [0, 4, 8]);
      expect(segment.grounding).toEqual({ ground: 0, root: 0 });
    });

    test("keeps diminished-seventh evidence sparse rather than forcing a run", () => {
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
      expect(segment.grounding).toEqual({ ground: 0, root: 0 });
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

    test("keeps a longer direct chromatic run out of center and field", () => {
      const segment = getSingleSegment({
        events: [
          { duration: 1, pitch: 60, type: "note" },
          { duration: 1, pitch: 61, type: "note" },
          { duration: 1, pitch: 62, type: "note" },
          { duration: 1, pitch: 63, type: "note" },
        ],
      });

      expectRegionPitchClasses(segment.center, []);
      expectRegionPitchClasses(segment.field, []);
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

    test("keeps altered extension evidence sparse rather than collapsing to a plain run", () => {
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
});
