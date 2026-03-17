import { describe, expect, test } from "bun:test";

import {
  buildRegionSpanClasses,
  buildProjection,
  repeatPitchClassesAcrossRange,
  repeatRegionSpanClassesAcrossRange,
} from "../src/projection";

describe("projection", () => {
  test("buildRegionSpanClasses groups nearby pitch classes into spans", () => {
    expect(buildRegionSpanClasses({ pitchClasses: [0, 4, 7, 11] })).toEqual([
      { end: 0, start: 0 },
      { end: 4, start: 4 },
      { end: 7, start: 7 },
      { end: 11, start: 11 },
    ]);
  });

  test("buildRegionSpanClasses keeps wrapped edge material as separate spans", () => {
    expect(buildRegionSpanClasses({ pitchClasses: [11, 0, 1] })).toEqual([
      { end: 1, start: 0 },
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

  test("buildProjection placement repeats root and ground across the visible range", () => {
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

    expect(projection.segments[0]?.placement.groundingMarks).toEqual([
      { pitch: 60, type: "root" },
      { pitch: 67, type: "ground" },
    ]);
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

    expect(projection.minPitch).toBe(59);
    expect(projection.maxPitch).toBe(68);
    expect(projection.segments[0]).toMatchObject({
      harmonic: {
        center: { pitchClasses: [0, 4, 7] },
        field: { pitchClasses: [0, 4, 7] },
        grounding: { ground: 7, root: 0 },
      },
      placement: {
        centerSpans: [
          { end: 60, start: 60 },
          { end: 64, start: 64 },
          { end: 67, start: 67 },
        ],
        fieldSpans: [
          { end: 60, start: 60 },
          { end: 64, start: 64 },
          { end: 67, start: 67 },
        ],
        groundingMarks: [
          { pitch: 60, type: "root" },
          { pitch: 67, type: "ground" },
        ],
        restPitch: 64,
        visibleWindow: {
          maxPitch: 68,
          minPitch: 59,
        },
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

    expect(projection.minPitch).toBe(67);
    expect(projection.maxPitch).toBe(77);
    expect(projection.segments[1]).toMatchObject({
      placement: {
        centerSpans: [],
        fieldSpans: [],
        groundingMarks: [],
        restPitch: 72,
        visibleWindow: {
          maxPitch: 77,
          minPitch: 67,
        },
      },
    });
    expect(projection.segments[1]?.events).toEqual([
      { duration: 2, offset: 0, pitch: 72, type: "rest" },
    ]);
  });
});
