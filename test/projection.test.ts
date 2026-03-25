import { describe, expect, test } from "bun:test";

import { buildRegion } from "../src/harmony/region";
import { runEngine } from "../src/harmony";
import { buildProjection } from "../src/projection";
import { getSegmentTotalDuration } from "../src/segment";
import type {
  HarmonicSegment,
  HarmonicStructure,
  PieceInput,
} from "../src/model";

const WRAPPED_REGION_FIXTURE: PieceInput = {
  segments: [
    {
      events: [
        { duration: 1, type: "rest" },
        { duration: 2, pitches: [62, 65, 69], type: "chord" },
      ],
      chordSymbol: "Dmin7",
    },
    {
      events: [
        { duration: 2, type: "rest" },
        { duration: 1, pitch: 67, type: "note" },
      ],
      chordSymbol: "G7",
    },
    {
      events: [
        { duration: 0.5, pitch: 64, type: "note" },
        { duration: 0.5, pitches: [60, 64, 67], type: "chord" },
        { duration: 0.5, type: "rest" },
        { duration: 0.5, pitch: 67, type: "note" },
        { duration: 0.5, pitches: [64, 67, 71], type: "chord" },
        { duration: 0.5, pitch: 72, type: "note" },
      ],
      chordSymbol: "Cmaj7",
    },
    {
      events: [
        { duration: 0.25, pitch: 69, type: "note" },
        { duration: 0.25, type: "rest" },
        { duration: 0.25, pitches: [64, 69], type: "chord" },
        { duration: 0.125, pitch: 72, type: "note" },
        { duration: 0.125, type: "rest" },
        { duration: 0.125, pitches: [67, 72], type: "chord" },
        { duration: 0.0625, pitch: 76, type: "note" },
        { duration: 0.0625, type: "rest" },
        { duration: 0.0625, pitches: [69, 72], type: "chord" },
        { duration: 1, pitch: 67, type: "note" },
        { duration: 0.5, pitch: 69, type: "note" },
        { duration: 0.125, pitch: 72, type: "note" },
        { duration: 0.0625, type: "rest" },
      ],
      chordSymbol: "Amin7",
    },
  ],
};

const BAR_NINE_INFLECTION_PITCHES = [
  53, 57, 62, 64, 65, 67, 69, 71, 73, 74, 76, 77, 79,
];
const C_SHARP_DIATONIC_INFLECTION_PITCHES = [61, 62, 64, 65, 67, 69, 71, 73];

function region(pitchClasses: number[]) {
  return buildRegion(pitchClasses);
}

function projectedSpan(
  start: number,
  end: number,
  options: {
    next?: { end: number; start: number };
    prev?: { end: number; start: number };
  } = {},
) {
  return {
    ...options,
    end,
    start,
  };
}

function buildUnsplitHarmonicStructure(
  input: PieceInput,
  segments: HarmonicSegment[],
): HarmonicStructure {
  return {
    segments: segments.map((harmonic, index) => ({
      ...harmonic,
      harmonicSlices: [
        {
          duration: getSegmentTotalDuration(input.segments[index]!),
          harmonic,
          startOffset: 0,
        },
      ],
    })),
  };
}

function buildProjectionWithUnsplitHarmonic(
  input: PieceInput,
  segments: HarmonicSegment[],
) {
  return buildProjection(input, buildUnsplitHarmonicStructure(input, segments));
}

function buildSingleSegmentNoteInput(pitches: number[]) {
  return {
    segments: [
      {
        events: pitches.map((pitch) => ({
          duration: 1,
          pitch,
          type: "note" as const,
        })),
      },
    ],
  };
}

function buildSingleSegmentChordInput(
  chords: Array<{ duration: number; offset: number; pitches: number[] }>,
  timeSignature: { beatType: number; beats: number },
) {
  return {
    segments: [
      {
        events: chords.map((chord) => ({
          ...chord,
          type: "chord" as const,
        })),
        timeSignature,
      },
    ],
  };
}

function buildOpeningHalfBeatSupportSegmentInput() {
  return {
    segments: [
      {
        events: [
          {
            duration: 2,
            layer: 0,
            offset: 0,
            pitch: 72,
            type: "note" as const,
          },
          {
            duration: 0.5,
            layer: 1,
            offset: 0,
            pitch: 60,
            type: "note" as const,
          },
          {
            duration: 0.5,
            layer: 1,
            offset: 0.5,
            pitch: 67,
            type: "note" as const,
          },
          {
            duration: 0.5,
            layer: 1,
            offset: 1,
            pitch: 64,
            type: "note" as const,
          },
          {
            duration: 0.5,
            layer: 1,
            offset: 1.5,
            pitch: 67,
            type: "note" as const,
          },
          {
            duration: 1,
            layer: 0,
            offset: 2,
            pitch: 76,
            type: "note" as const,
          },
          {
            duration: 0.5,
            layer: 1,
            offset: 2,
            pitch: 60,
            type: "note" as const,
          },
          {
            duration: 0.5,
            layer: 1,
            offset: 2.5,
            pitch: 67,
            type: "note" as const,
          },
          {
            duration: 1,
            layer: 0,
            offset: 3,
            pitch: 79,
            type: "note" as const,
          },
          {
            duration: 0.5,
            layer: 1,
            offset: 3,
            pitch: 64,
            type: "note" as const,
          },
          {
            duration: 0.5,
            layer: 1,
            offset: 3.5,
            pitch: 67,
            type: "note" as const,
          },
        ],
        timeSignature: { beatType: 4, beats: 4 },
      },
    ],
  };
}

function buildOpeningQuarterBeatSupportSegmentInput() {
  return {
    segments: [
      {
        events: [
          {
            duration: 0.5,
            layer: 0,
            offset: 0,
            pitch: 71,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 0,
            pitch: 43,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 0.25,
            pitch: 47,
            type: "note" as const,
          },
          {
            duration: 0.5,
            layer: 0,
            offset: 0.5,
            pitch: 79,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 0.5,
            pitch: 50,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 0.75,
            pitch: 55,
            type: "note" as const,
          },
          {
            duration: 0.5,
            layer: 0,
            offset: 1,
            pitch: 76,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 1,
            pitch: 43,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 1.25,
            pitch: 48,
            type: "note" as const,
          },
          {
            duration: 0.5,
            layer: 0,
            offset: 1.5,
            pitch: 72,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 1.5,
            pitch: 52,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 1.75,
            pitch: 55,
            type: "note" as const,
          },
          {
            duration: 0.5,
            layer: 0,
            offset: 2,
            pitch: 74,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 2,
            pitch: 43,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 2.25,
            pitch: 47,
            type: "note" as const,
          },
          {
            duration: 0.5,
            layer: 0,
            offset: 2.5,
            pitch: 79,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 2.5,
            pitch: 50,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 2.75,
            pitch: 55,
            type: "note" as const,
          },
          {
            duration: 0.5,
            layer: 0,
            offset: 3,
            pitch: 76,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 3,
            pitch: 43,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 3.25,
            pitch: 48,
            type: "note" as const,
          },
          {
            duration: 0.5,
            layer: 0,
            offset: 3.5,
            pitch: 72,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 3.5,
            pitch: 52,
            type: "note" as const,
          },
          {
            duration: 0.25,
            layer: 1,
            offset: 3.75,
            pitch: 55,
            type: "note" as const,
          },
        ],
        timeSignature: { beatType: 4, beats: 4 },
      },
    ],
  };
}

describe("projection", () => {
  test("buildProjection keeps spans for an event-driven chromatic inflection instead of dropping the region", () => {
    const input = buildSingleSegmentNoteInput(BAR_NINE_INFLECTION_PITCHES);
    const harmonicStructure = runEngine(input);
    const projection = buildProjection(input, harmonicStructure);

    expect(projection.segments[0]?.harmonicSlices[0]?.center.spans).toEqual([
      projectedSpan(50, 52, {}),
      projectedSpan(53, 61, {}),
      projectedSpan(62, 64, {}),
      projectedSpan(65, 73, {}),
      projectedSpan(74, 76, {}),
      projectedSpan(77, 85, {}),
    ]);
  });

  test("buildProjection renders a single-bar C-sharp diatonic inflection as repeated paired spans", () => {
    const input = buildSingleSegmentNoteInput(
      C_SHARP_DIATONIC_INFLECTION_PITCHES,
    );
    const harmonicStructure = runEngine(input);
    const projection = buildProjection(input, harmonicStructure);

    expect(projection.segments[0]?.harmonicSlices[0]?.center.spans).toEqual([
      projectedSpan(53, 61, {}),
      projectedSpan(62, 64, {}),
      projectedSpan(65, 73, {}),
      projectedSpan(74, 76, {}),
    ]);
  });

  test("buildProjection can split one segment into two harmonic slices when the local center changes mid-bar", () => {
    const input = buildSingleSegmentChordInput(
      [
        { duration: 2, offset: 0, pitches: [60, 64, 67] },
        { duration: 2, offset: 2, pitches: [61, 65, 68] },
      ],
      { beatType: 4, beats: 4 },
    );
    const harmonicStructure = runEngine(input);
    const projection = buildProjection(input, harmonicStructure);

    expect(projection.segments[0]?.harmonicSlices).toEqual([
      {
        center: {
          spans: [projectedSpan(60, 64, {}), projectedSpan(67, 69, {})],
        },
        duration: 2,
        endX: 0.7445208382054341,
        field: {
          spans: [projectedSpan(60, 64, {}), projectedSpan(67, 69, {})],
        },
        harmonic: {
          center: region([0, 7, 2, 9, 4]),
          field: region([0, 7, 2, 9, 4]),
        },
        touchesSegmentEnd: false,
        touchesSegmentStart: true,
        projectedGroundingMarks: undefined,
        startOffset: 0,
        startX: 0,
      },
      {
        center: {
          spans: [
            projectedSpan(56, 58, {}),
            projectedSpan(61, 65, {}),
            projectedSpan(68, 70, {}),
          ],
        },
        duration: 2,
        endX: 1,
        field: {
          spans: [
            projectedSpan(56, 58, {}),
            projectedSpan(61, 65, {}),
            projectedSpan(68, 70, {}),
          ],
        },
        harmonic: {
          center: region([1, 8, 3, 10, 5]),
          field: region([1, 8, 3, 10, 5]),
        },
        touchesSegmentEnd: true,
        touchesSegmentStart: false,
        projectedGroundingMarks: undefined,
        startOffset: 2,
        startX: 0.7445208382054341,
      },
    ]);
  });

  test("buildProjection chooses the strongest split instead of the first valid split", () => {
    const input = buildSingleSegmentChordInput(
      [
        { duration: 1, offset: 0, pitches: [60, 64, 67] },
        { duration: 1, offset: 1, pitches: [60, 64, 67] },
        { duration: 1, offset: 2, pitches: [61, 65, 68] },
      ],
      { beatType: 4, beats: 3 },
    );
    const harmonicStructure = runEngine(input);
    const projection = buildProjection(input, harmonicStructure);

    expect(projection.segments[0]?.harmonicSlices).toHaveLength(2);
    expect(projection.segments[0]?.harmonicSlices).toMatchObject([
      {
        duration: 2,
        startOffset: 0,
      },
      {
        duration: 1,
        startOffset: 2,
      },
    ]);
  });

  test("buildProjection does not split off an opening half-beat support figure from an otherwise stable segment", () => {
    const input = buildOpeningHalfBeatSupportSegmentInput();
    const harmonicStructure = runEngine(input);
    const projection = buildProjection(input, harmonicStructure);

    expect(projection.segments[0]?.harmonicSlices).toHaveLength(1);
    expect(projection.segments[0]?.harmonicSlices[0]).toMatchObject({
      duration: 4,
      endX: 1,
      startOffset: 0,
      startX: 0,
      touchesSegmentEnd: true,
      touchesSegmentStart: true,
    });
  });

  test("buildProjection does not split off an opening quarter-beat support figure from an otherwise stable segment", () => {
    const input = buildOpeningQuarterBeatSupportSegmentInput();
    const harmonicStructure = runEngine(input);
    const projection = buildProjection(input, harmonicStructure);

    expect(projection.segments[0]?.harmonicSlices).toHaveLength(1);
    expect(projection.segments[0]?.harmonicSlices[0]).toMatchObject({
      duration: 4,
      endX: 1,
      startOffset: 0,
      startX: 0,
      touchesSegmentEnd: true,
      touchesSegmentStart: true,
    });
  });

  test("buildProjection repeats region spans across the visible pitch window", () => {
    const projection = buildProjectionWithUnsplitHarmonic(
      {
        segments: [
          {
            events: [{ duration: 1, pitches: [60, 61], type: "chord" }],
          },
        ],
      },
      [
        {
          center: region([0, 1]),
          field: region([11]),
        },
      ],
    );

    expect(projection.segments[0]?.harmonicSlices[0]?.center.spans).toEqual([
      projectedSpan(60, 60, {}),
      projectedSpan(61, 61, {}),
    ]);
    expect(projection.segments[0]?.harmonicSlices[0]?.field.spans).toEqual([
      projectedSpan(59, 59, {}),
    ]);
  });

  test("buildProjection projected grounding repeats root and ground marks across the visible range", () => {
    const projection = buildProjectionWithUnsplitHarmonic(
      {
        segments: [
          {
            events: [{ duration: 1, pitches: [60, 67], type: "chord" }],
          },
        ],
      },
      [
        {
          center: region([0, 7, 4]),
          field: region([0, 7, 4]),
          grounding: { ground: 7, root: 0 },
        },
      ],
    );

    expect(
      projection.segments[0]?.harmonicSlices[0]?.projectedGroundingMarks,
    ).toEqual({
      marks: [
        { pitch: 60, type: "root" },
        { pitch: 67, type: "ground" },
      ],
      groundPitchClass: 7,
      rootPitchClass: 0,
    });
  });

  test("buildProjection emits render-ready harmonic projection data", () => {
    const projection = buildProjectionWithUnsplitHarmonic(
      {
        segments: [
          {
            events: [{ duration: 1, pitches: [60, 64, 67], type: "chord" }],
          },
        ],
      },
      [
        {
          center: region([0, 4, 7]),
          field: region([0, 4, 7]),
          grounding: { ground: 7, root: 0 },
        },
      ],
    );

    expect(projection.minPitch).toBe(58);
    expect(projection.maxPitch).toBe(69);
    expect(projection.segments[0]).toMatchObject({
      segmentWidthUnits: 15,
      harmonicSlices: [
        {
          center: {
            spans: [
              projectedSpan(60, 60, {}),
              projectedSpan(64, 64, {}),
              projectedSpan(67, 67, {}),
            ],
          },
          duration: 1,
          field: {
            spans: [
              projectedSpan(60, 60, {}),
              projectedSpan(64, 64, {}),
              projectedSpan(67, 67, {}),
            ],
          },
          harmonic: {
            center: region([0, 4, 7]),
            field: region([0, 4, 7]),
            grounding: { ground: 7, root: 0 },
          },
          projectedGroundingMarks: {
            marks: [
              { pitch: 60, type: "root" },
              { pitch: 67, type: "ground" },
            ],
            groundPitchClass: 7,
            rootPitchClass: 0,
          },
          startOffset: 0,
        },
      ],
      timePositions: [{ maxDuration: 1, offset: 0, x: 0.5 }],
      visibleDefaults: {
        restAnchorPitch: 64,
      },
    });
    expect(projection.segments[0]?.events).toEqual([
      {
        duration: 1,
        layer: 0,
        offset: 0,
        pitchOwnerships: [
          { fieldSpan: { end: 60, start: 60 }, pitch: 60 },
          { fieldSpan: { end: 64, start: 64 }, pitch: 64 },
          { fieldSpan: { end: 67, start: 67 }, pitch: 67 },
        ],
        pitches: [60, 64, 67],
        type: "pitched",
        x: 0.5,
      },
    ]);
  });

  test("buildProjection gives denser segments more width than sparse ones", () => {
    const projection = buildProjectionWithUnsplitHarmonic(
      {
        segments: [
          {
            events: [{ duration: 4, pitch: 60, type: "note" }],
          },
          {
            events: [
              { duration: 1, pitch: 60, type: "note" },
              { duration: 1, pitch: 62, type: "note" },
              { duration: 1, pitch: 64, type: "note" },
              { duration: 1, pitch: 65, type: "note" },
            ],
          },
        ],
      },
      [
        {
          center: region([0]),
          field: region([0]),
        },
        {
          center: region([0, 2, 4, 5]),
          field: region([0, 2, 4, 5]),
        },
      ],
    );

    expect(projection.segments[0]!.segmentWidthUnits).toBe(15);
    expect(projection.segments[1]!.segmentWidthUnits).toBeGreaterThan(
      projection.segments[0]!.segmentWidthUnits,
    );
  });

  test("buildProjection uses nearby sounded material for rest-only segment defaults", () => {
    const projection = buildProjectionWithUnsplitHarmonic(
      {
        segments: [
          {
            events: [{ duration: 1, pitch: 72, type: "note" }],
          },
          {
            events: [{ duration: 2, type: "rest" }],
          },
        ],
      },
      [
        {
          center: region([0]),
          field: region([0]),
          grounding: { ground: 0, root: 0 },
        },
        {
          center: region([]),
          field: region([]),
        },
      ],
    );

    expect(projection.minPitch).toBe(70);
    expect(projection.maxPitch).toBe(74);
    expect(projection.segments[1]).toMatchObject({
      harmonicSlices: [
        {
          center: { spans: [] },
          duration: 2,
          field: { spans: [] },
          projectedGroundingMarks: undefined,
          startOffset: 0,
        },
      ],
      visibleDefaults: {
        restAnchorPitch: 72,
      },
    });
    expect(projection.segments[1]?.events).toEqual([
      { duration: 2, layer: 0, offset: 0, pitch: 72, type: "rest", x: 0.5 },
    ]);
  });

  test("buildProjection anchors rests separately for each layer", () => {
    const projection = buildProjectionWithUnsplitHarmonic(
      {
        segments: [
          {
            events: [
              { duration: 1, layer: 0, pitch: 76, type: "note" },
              { duration: 1, layer: 1, pitch: 52, type: "note" },
            ],
          },
          {
            events: [
              { duration: 1, layer: 0, type: "rest" },
              { duration: 1, layer: 1, type: "rest" },
            ],
          },
        ],
      },
      [
        {
          center: region([4]),
          field: region([4]),
        },
        {
          center: region([]),
          field: region([]),
        },
      ],
    );

    expect(projection.segments[1]?.events).toEqual([
      { duration: 1, layer: 0, offset: 0, pitch: 76, type: "rest", x: 0.5 },
      { duration: 1, layer: 1, offset: 0, pitch: 52, type: "rest", x: 0.5 },
    ]);
  });

  test("buildProjection uses a local weighted window for layer rest anchors", () => {
    const projection = buildProjectionWithUnsplitHarmonic(
      {
        segments: [
          {
            events: [{ duration: 1, layer: 0, pitch: 60, type: "note" }],
          },
          {
            events: [{ duration: 1, layer: 0, type: "rest" }],
          },
          {
            events: [{ duration: 1, layer: 0, pitch: 72, type: "note" }],
          },
        ],
      },
      [
        {
          center: region([0]),
          field: region([0]),
        },
        {
          center: region([]),
          field: region([]),
        },
        {
          center: region([0]),
          field: region([0]),
        },
      ],
    );

    expect(projection.segments[1]?.events).toEqual([
      { duration: 1, layer: 0, offset: 0, pitch: 66, type: "rest", x: 0.5 },
    ]);
  });

  test("buildProjection projects root and ground marks within the grounding window", () => {
    const projection = buildProjectionWithUnsplitHarmonic(
      {
        segments: [
          {
            events: [{ duration: 1, pitches: [60, 64, 67], type: "chord" }],
          },
          {
            events: [{ duration: 1, pitches: [62, 67, 71], type: "chord" }],
          },
        ],
      },
      [
        {
          center: region([0, 7, 4]),
          field: region([0, 7, 4]),
          grounding: { ground: 0, root: 0 },
        },
        {
          center: region([7, 2, 11]),
          field: region([7, 2, 11]),
          grounding: { ground: 7, root: 7 },
        },
      ],
    );

    expect(
      projection.segments[0]?.harmonicSlices[0]?.projectedGroundingMarks,
    ).toEqual({
      marks: [
        { pitch: 60, type: "root" },
        { pitch: 60, type: "ground" },
        { pitch: 72, type: "root" },
        { pitch: 72, type: "ground" },
      ],
      groundPitchClass: 0,
      rootPitchClass: 0,
    });
    expect(
      projection.segments[1]?.harmonicSlices[0]?.projectedGroundingMarks,
    ).toEqual({
      marks: [
        { pitch: 67, type: "root" },
        { pitch: 67, type: "ground" },
      ],
      groundPitchClass: 7,
      rootPitchClass: 7,
    });
  });

  test("buildProjection does not project grounding marks from event-only analysis", () => {
    const input = {
      segments: [
        {
          events: [
            { duration: 1, pitches: [60, 64, 67], type: "chord" as const },
          ],
        },
      ],
    };
    const projection = buildProjection(input, runEngine(input));

    expect(
      projection.segments[0]?.harmonicSlices[0]?.harmonic.grounding,
    ).toBeUndefined();
    expect(
      projection.segments[0]?.harmonicSlices[0]?.projectedGroundingMarks,
    ).toBeUndefined();
  });

  test("buildProjection annotates adjacent paired spans with joins", () => {
    const projection = buildProjectionWithUnsplitHarmonic(
      {
        segments: [
          { events: [{ duration: 1, pitches: [60, 69], type: "chord" }] },
          { events: [{ duration: 1, pitches: [62, 71], type: "chord" }] },
        ],
      },
      [
        {
          center: region([0, 7, 2, 9]),
          field: region([0, 7, 2, 9]),
        },
        {
          center: region([2, 9, 4, 11]),
          field: region([2, 9, 4, 11]),
        },
      ],
    );

    expect(projection.segments[0]?.harmonicSlices[0]?.center.spans).toEqual([
      projectedSpan(60, 62, { next: { end: 64, start: 62 } }),
      projectedSpan(67, 69, { next: { end: 71, start: 69 } }),
      projectedSpan(72, 74, { next: { end: 76, start: 74 } }),
    ]);
    expect(projection.segments[1]?.harmonicSlices[0]?.center.spans).toEqual([
      projectedSpan(57, 59, { prev: { end: 57, start: 55 } }),
      projectedSpan(62, 64, { prev: { end: 62, start: 60 } }),
      projectedSpan(69, 71, { prev: { end: 69, start: 67 } }),
    ]);
  });

  test("buildProjection joins paired spans across bars through a C-sharp diatonic inflection", () => {
    const projection = buildProjectionWithUnsplitHarmonic(
      {
        segments: [
          {
            events: [
              {
                duration: 1,
                pitches: [60, 62, 64, 65, 67, 69, 71],
                type: "chord",
              },
            ],
          },
          {
            events: [
              {
                duration: 1,
                pitches: [61, 62, 64, 65, 67, 69, 71, 73],
                type: "chord",
              },
            ],
          },
        ],
      },
      [
        {
          center: region([0, 2, 4, 5, 7, 9, 11]),
          field: region([0, 2, 4, 5, 7, 9, 11]),
        },
        {
          center: region([1, 2, 4, 5, 7, 9, 11]),
          field: region([1, 2, 4, 5, 7, 9, 11]),
        },
      ],
    );

    expect(projection.segments[0]?.harmonicSlices[0]?.center.spans).toEqual([
      projectedSpan(53, 59, { next: { end: 61, start: 53 } }),
      projectedSpan(60, 64, { next: { end: 64, start: 62 } }),
      projectedSpan(65, 71, { next: { end: 73, start: 65 } }),
      projectedSpan(72, 76, { next: { end: 76, start: 74 } }),
    ]);
    expect(projection.segments[1]?.harmonicSlices[0]?.center.spans).toEqual([
      projectedSpan(53, 61, { prev: { end: 59, start: 53 } }),
      projectedSpan(62, 64, { prev: { end: 64, start: 60 } }),
      projectedSpan(65, 73, { prev: { end: 71, start: 65 } }),
      projectedSpan(74, 76, { prev: { end: 76, start: 72 } }),
    ]);
  });

  test("buildProjection can emit crossed joins for degenerate paired spans", () => {
    const projection = buildProjectionWithUnsplitHarmonic(
      {
        segments: [
          { events: [{ duration: 1, pitches: [60, 61], type: "chord" }] },
          { events: [{ duration: 1, pitches: [61, 62], type: "chord" }] },
        ],
      },
      [
        {
          center: region([0, 1]),
          field: region([0, 1]),
        },
        {
          center: region([1, 2]),
          field: region([1, 2]),
        },
      ],
    );

    expect(projection.segments[0]?.harmonicSlices[0]?.center.spans).toEqual([
      projectedSpan(60, 60, { next: { end: 50, start: 50 } }),
      projectedSpan(61, 61, { next: { end: 61, start: 61 } }),
    ]);
    expect(projection.segments[1]?.harmonicSlices[0]?.center.spans).toEqual([
      projectedSpan(61, 61, { prev: { end: 61, start: 61 } }),
      projectedSpan(62, 62, { prev: { end: 72, start: 72 } }),
    ]);
  });

  test("buildProjection leaves unpaired adjacent regions unjoined", () => {
    const projection = buildProjectionWithUnsplitHarmonic(
      {
        segments: [
          {
            events: [{ duration: 1, pitches: [60, 61, 62], type: "chord" }],
          },
          {
            events: [{ duration: 1, pitches: [61, 62, 63], type: "chord" }],
          },
        ],
      },
      [
        {
          center: region([0, 1, 2]),
          field: region([0, 1, 2]),
        },
        {
          center: region([1, 2, 3]),
          field: region([1, 2, 3]),
        },
      ],
    );

    expect(projection.segments[0]?.harmonicSlices[0]?.center.spans).toEqual([
      projectedSpan(60, 60, {}),
      projectedSpan(61, 61, {}),
      projectedSpan(62, 62, {}),
    ]);
    expect(projection.segments[1]?.harmonicSlices[0]?.center.spans).toEqual([
      projectedSpan(61, 61, {}),
      projectedSpan(62, 62, {}),
      projectedSpan(63, 63, {}),
    ]);
  });

  test("buildProjection links wrapped paired regions from the seed progression", () => {
    const harmonicStructure = runEngine(WRAPPED_REGION_FIXTURE);
    const projection = buildProjection(
      WRAPPED_REGION_FIXTURE,
      harmonicStructure,
    );

    expect(
      projection.segments[0]?.harmonicSlices[0]?.center.spans.some(
        (span) => span.next !== undefined,
      ),
    ).toBe(true);
    expect(
      projection.segments[1]?.harmonicSlices[0]?.field.spans.some(
        (span) => span.prev !== undefined || span.next !== undefined,
      ),
    ).toBe(true);
  });
});
