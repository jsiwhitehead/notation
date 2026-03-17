import { describe, expect, test } from "bun:test";

import { runEngine } from "../src/engine";
import {
  buildProjectedGroundingOverlays,
  buildRegionSpanClasses,
  buildProjection,
  repeatRegionSpanClassesAcrossRange,
} from "../src/projection";
import { repeatPitchClassesAcrossRange } from "../src/pitch";
import { SEED_INPUT } from "../src/seed-input";

describe("projection", () => {
  test("buildRegionSpanClasses groups contiguous tone-runs into spans", () => {
    expect(
      buildRegionSpanClasses({ pitchClasses: [0, 2, 4, 5, 7, 9, 11] }),
    ).toEqual([
      { end: 4, start: 0 },
      { end: 11, start: 5 },
    ]);
  });

  test("buildRegionSpanClasses splits semitone-adjacent material into separate spans", () => {
    expect(buildRegionSpanClasses({ pitchClasses: [11, 0, 1] })).toEqual([
      { end: 0, start: 0 },
      { end: 1, start: 1 },
      { end: 11, start: 11 },
    ]);
  });

  test("repeatRegionSpanClassesAcrossRange repeats spans into visible pitch space", () => {
    expect(
      repeatRegionSpanClassesAcrossRange(
        { maxPitch: 14, minPitch: 0 },
        { end: 1, start: 0 },
      ),
    ).toEqual([
      { end: 1, start: 0 },
      { end: 13, start: 12 },
    ]);
    expect(
      repeatRegionSpanClassesAcrossRange(
        { maxPitch: 14, minPitch: 0 },
        { end: 11, start: 11 },
      ),
    ).toEqual([{ end: 11, start: 11 }]);
  });

  test("repeatPitchClassesAcrossRange repeats pitch classes across octaves", () => {
    expect(repeatPitchClassesAcrossRange(14, 0, [0, 7])).toEqual([0, 7, 12]);
  });

  test("buildProjection placement repeats root and ground marks across the visible range", () => {
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

    expect(projection.segments[0]?.placement.groundingOverlay).toEqual({
      marks: [
        { pitch: 60, type: "root" },
        { pitch: 67, type: "ground" },
      ],
      groundPitchClass: 7,
      rootPitchClass: 0,
    });
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
        groundingOverlay: {
          marks: [
            { pitch: 60, type: "root" },
            { pitch: 67, type: "ground" },
          ],
          groundPitchClass: 7,
          rootPitchClass: 0,
        },
        restPitch: 64,
      },
    });
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
        groundingOverlay: undefined,
        restPitch: 72,
      },
    });
    expect(projection.segments[1]?.events).toEqual([
      { duration: 2, offset: 0, pitch: 72, type: "rest" },
    ]);
  });

  test("buildProjectedGroundingOverlays projects root and ground marks within the grounding window", () => {
    const overlays = buildProjectedGroundingOverlays(
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
      [
        {
          spans: [
            { end: 60, start: 60 },
            { end: 64, start: 64 },
            { end: 67, start: 67 },
          ],
        },
        {
          spans: [
            { end: 62, start: 62 },
            { end: 67, start: 67 },
            { end: 71, start: 71 },
          ],
        },
      ],
      [
        {
          spans: [
            { end: 60, start: 60 },
            { end: 64, start: 64 },
            { end: 67, start: 67 },
          ],
        },
        {
          spans: [
            { end: 62, start: 62 },
            { end: 67, start: 67 },
            { end: 71, start: 71 },
          ],
        },
      ],
    );

    expect(overlays[0]).toEqual({
      marks: [
        { pitch: 60, type: "root" },
        { pitch: 60, type: "ground" },
      ],
      groundPitchClass: 0,
      rootPitchClass: 0,
    });
    expect(overlays[1]).toEqual({
      marks: [
        { pitch: 67, type: "root" },
        { pitch: 67, type: "ground" },
      ],
      groundPitchClass: 7,
      rootPitchClass: 7,
    });
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
