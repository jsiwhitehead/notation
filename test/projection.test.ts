import { describe, expect, test } from "bun:test";

import {
  buildRegionSpanClasses,
  buildProjection,
  repeatRegionSpanClassesAcrossRange,
} from "../src/projection";
import { repeatPitchClassesAcrossRange } from "../src/pitch";

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
    ).toEqual([]);
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

    expect(projection.minPitch).toBe(58);
    expect(projection.maxPitch).toBe(69);
    expect(projection.segments[0]).toMatchObject({
      harmonic: {
        center: { pitchClasses: [0, 4, 7] },
        field: { pitchClasses: [0, 4, 7] },
        grounding: { ground: 7, root: 0 },
      },
      placement: {
        centerSpans: [],
        fieldSpans: [],
        groundingMarks: [
          { pitch: 60, type: "root" },
          { pitch: 67, type: "ground" },
        ],
        restPitch: 64,
        visibleWindow: {
          maxPitch: 69,
          minPitch: 58,
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

    expect(projection.minPitch).toBe(70);
    expect(projection.maxPitch).toBe(74);
    expect(projection.segments[1]).toMatchObject({
      placement: {
        centerSpans: [],
        fieldSpans: [],
        groundingMarks: [],
        restPitch: 72,
        visibleWindow: {
          maxPitch: 74,
          minPitch: 70,
        },
      },
    });
    expect(projection.segments[1]?.events).toEqual([
      { duration: 2, offset: 0, pitch: 72, type: "rest" },
    ]);
  });
});
