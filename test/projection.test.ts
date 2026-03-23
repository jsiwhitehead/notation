import { describe, expect, test } from "bun:test";

import { runEngine } from "../src/engine";
import { buildProjection } from "../src/projection";
import { SEED_INPUT } from "../src/seed-input";

describe("projection", () => {
  test("buildProjection groups contiguous tone-runs into projected spans", () => {
    const projection = buildProjection(
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
        ],
      },
      {
        segments: [
          {
            center: { pitchClasses: [0, 2, 4, 5, 7, 9, 11] },
            field: { pitchClasses: [0, 2, 4, 5, 7, 9, 11] },
          },
        ],
      },
    );

    expect(projection.segments[0]?.placement.center.spans).toEqual([
      { end: 59, start: 53 },
      { end: 64, start: 60 },
      { end: 71, start: 65 },
      { end: 76, start: 72 },
    ]);
  });

  test("buildProjection splits semitone-adjacent material into separate projected spans", () => {
    const projection = buildProjection(
      {
        segments: [
          {
            events: [{ duration: 1, pitches: [60, 61, 71], type: "chord" }],
          },
        ],
      },
      {
        segments: [
          {
            center: { pitchClasses: [11, 0, 1] },
            field: { pitchClasses: [11, 0, 1] },
          },
        ],
      },
    );

    expect(projection.segments[0]?.placement.center.spans).toEqual([
      { end: 59, start: 59 },
      { end: 60, start: 60 },
      { end: 61, start: 61 },
      { end: 71, start: 71 },
      { end: 72, start: 72 },
      { end: 73, start: 73 },
    ]);
  });

  test("buildProjection repeats region spans across the visible pitch window", () => {
    const projection = buildProjection(
      {
        segments: [
          {
            events: [{ duration: 1, pitches: [60, 61], type: "chord" }],
          },
        ],
      },
      {
        segments: [
          {
            center: { pitchClasses: [0, 1] },
            field: { pitchClasses: [11] },
          },
        ],
      },
    );

    expect(projection.segments[0]?.placement.center.spans).toEqual([
      { end: 60, start: 60 },
      { end: 61, start: 61 },
    ]);
    expect(projection.segments[0]?.placement.field.spans).toEqual([
      { end: 59, start: 59 },
    ]);
  });

  test("buildProjection projected grounding repeats root and ground marks across the visible range", () => {
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

    expect(projection.segments[0]?.placement.projectedGroundingOverlay).toEqual(
      {
        marks: [
          { pitch: 60, type: "root" },
          { pitch: 67, type: "ground" },
        ],
        groundPitchClass: 7,
        rootPitchClass: 0,
      },
    );
  });

  test("buildProjection emits render-ready harmonic placement data", () => {
    const projection = buildProjection(
      {
        segments: [
          {
            events: [{ duration: 1, pitches: [60, 64, 67], type: "chord" }],
          },
        ],
      },
      {
        segments: [
          {
            center: { pitchClasses: [0, 4, 7] },
            field: { pitchClasses: [0, 4, 7] },
            grounding: { ground: 7, root: 0 },
          },
        ],
      },
    );

    expect(projection.minPitch).toBe(58);
    expect(projection.maxPitch).toBe(69);
    expect(projection.segments[0]).toMatchObject({
      harmonic: {
        center: { pitchClasses: [0, 4, 7] },
        field: { pitchClasses: [0, 4, 7] },
        grounding: { ground: 7, root: 0 },
      },
      segmentWidthUnits: 15,
      timePositions: [{ maxDuration: 1, offset: 0, x: 0.5 }],
      placement: {
        center: {
          spans: [
            { end: 60, start: 60 },
            { end: 64, start: 64 },
            { end: 67, start: 67 },
          ],
        },
        field: {
          spans: [
            { end: 60, start: 60 },
            { end: 64, start: 64 },
            { end: 67, start: 67 },
          ],
        },
        projectedGroundingOverlay: {
          marks: [
            { pitch: 60, type: "root" },
            { pitch: 67, type: "ground" },
          ],
          groundPitchClass: 7,
          rootPitchClass: 0,
        },
        restAnchorPitch: 64,
      },
    });
    expect(projection.segments[0]?.events).toEqual([
      {
        duration: 1,
        layer: 0,
        offset: 0,
        pitches: [60, 64, 67],
        type: "pitched",
        x: 0.5,
      },
    ]);
  });

  test("buildProjection gives denser segments more width than sparse ones", () => {
    const projection = buildProjection(
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
      {
        segments: [
          {
            center: { pitchClasses: [0] },
            field: { pitchClasses: [0] },
          },
          {
            center: { pitchClasses: [0, 2, 4, 5] },
            field: { pitchClasses: [0, 2, 4, 5] },
          },
        ],
      },
    );

    expect(projection.segments[0]!.segmentWidthUnits).toBe(15);
    expect(projection.segments[1]!.segmentWidthUnits).toBeGreaterThan(
      projection.segments[0]!.segmentWidthUnits,
    );
  });

  test("buildProjection uses nearby sounded material for rest-only segment defaults", () => {
    const projection = buildProjection(
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
      {
        segments: [
          {
            center: { pitchClasses: [0] },
            field: { pitchClasses: [0] },
            grounding: { ground: 0, root: 0 },
          },
          {
            center: { pitchClasses: [] },
            field: { pitchClasses: [] },
          },
        ],
      },
    );

    expect(projection.minPitch).toBe(70);
    expect(projection.maxPitch).toBe(74);
    expect(projection.segments[1]).toMatchObject({
      placement: {
        center: { spans: [] },
        field: { spans: [] },
        projectedGroundingOverlay: undefined,
        restAnchorPitch: 72,
      },
    });
    expect(projection.segments[1]?.events).toEqual([
      { duration: 2, layer: 0, offset: 0, pitch: 72, type: "rest", x: 0.5 },
    ]);
  });

  test("buildProjection projects root and ground marks within the grounding window", () => {
    const projection = buildProjection(
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
      {
        segments: [
          {
            center: { pitchClasses: [0, 7, 4] },
            field: { pitchClasses: [0, 7, 4] },
            grounding: { ground: 0, root: 0 },
          },
          {
            center: { pitchClasses: [7, 2, 11] },
            field: { pitchClasses: [7, 2, 11] },
            grounding: { ground: 7, root: 7 },
          },
        ],
      },
    );

    expect(projection.segments[0]?.placement.projectedGroundingOverlay).toEqual(
      {
        marks: [
          { pitch: 60, type: "root" },
          { pitch: 60, type: "ground" },
          { pitch: 72, type: "root" },
          { pitch: 72, type: "ground" },
        ],
        groundPitchClass: 0,
        rootPitchClass: 0,
      },
    );
    expect(projection.segments[1]?.placement.projectedGroundingOverlay).toEqual(
      {
        marks: [
          { pitch: 67, type: "root" },
          { pitch: 67, type: "ground" },
        ],
        groundPitchClass: 7,
        rootPitchClass: 7,
      },
    );
  });

  test("buildProjection annotates adjacent paired spans with joins", () => {
    const projection = buildProjection(
      {
        segments: [
          { events: [{ duration: 1, pitches: [60, 69], type: "chord" }] },
          { events: [{ duration: 1, pitches: [62, 71], type: "chord" }] },
        ],
      },
      {
        segments: [
          {
            center: { pitchClasses: [0, 7, 2, 9] },
            field: { pitchClasses: [0, 7, 2, 9] },
          },
          {
            center: { pitchClasses: [2, 9, 4, 11] },
            field: { pitchClasses: [2, 9, 4, 11] },
          },
        ],
      },
    );

    expect(projection.segments[0]?.placement.center.spans).toEqual([
      { end: 62, next: { end: 64, start: 62 }, start: 60 },
      { end: 69, next: { end: 71, start: 69 }, start: 67 },
      { end: 74, next: { end: 76, start: 74 }, start: 72 },
    ]);
    expect(projection.segments[1]?.placement.center.spans).toEqual([
      { end: 59, prev: { end: 57, start: 55 }, start: 57 },
      { end: 64, prev: { end: 62, start: 60 }, start: 62 },
      { end: 71, prev: { end: 69, start: 67 }, start: 69 },
    ]);
  });

  test("buildProjection can emit crossed joins for degenerate paired spans", () => {
    const projection = buildProjection(
      {
        segments: [
          { events: [{ duration: 1, pitches: [60, 61], type: "chord" }] },
          { events: [{ duration: 1, pitches: [61, 62], type: "chord" }] },
        ],
      },
      {
        segments: [
          {
            center: { pitchClasses: [0, 1] },
            field: { pitchClasses: [0, 1] },
          },
          {
            center: { pitchClasses: [1, 2] },
            field: { pitchClasses: [1, 2] },
          },
        ],
      },
    );

    expect(projection.segments[0]?.placement.center.spans).toEqual([
      { end: 60, start: 60 },
      { end: 61, next: { end: 61, start: 61 }, start: 61 },
    ]);
    expect(projection.segments[1]?.placement.center.spans).toEqual([
      { end: 61, prev: { end: 61, start: 61 }, start: 61 },
      { end: 62, start: 62 },
    ]);
  });

  test("buildProjection leaves unpaired adjacent regions unjoined", () => {
    const projection = buildProjection(
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
      {
        segments: [
          {
            center: { pitchClasses: [0, 1, 2] },
            field: { pitchClasses: [0, 1, 2] },
          },
          {
            center: { pitchClasses: [1, 2, 3] },
            field: { pitchClasses: [1, 2, 3] },
          },
        ],
      },
    );

    expect(projection.segments[0]?.placement.center.spans).toEqual([
      { end: 60, start: 60 },
      { end: 61, start: 61 },
      { end: 62, start: 62 },
    ]);
    expect(projection.segments[1]?.placement.center.spans).toEqual([
      { end: 61, start: 61 },
      { end: 62, start: 62 },
      { end: 63, start: 63 },
    ]);
  });

  test("buildProjection links wrapped paired regions from the seed progression", () => {
    const harmonicStructure = runEngine(SEED_INPUT);
    const projection = buildProjection(SEED_INPUT, harmonicStructure);

    expect(
      projection.segments[0]?.placement.center.spans.some(
        (span) => span.next !== undefined,
      ),
    ).toBe(true);
    expect(
      projection.segments[1]?.placement.field.spans.some(
        (span) => span.prev !== undefined || span.next !== undefined,
      ),
    ).toBe(true);
  });
});
