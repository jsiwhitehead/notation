import { describe, expect, test } from "bun:test";

import type { ProjectionEvent } from "../src/projection";
import { buildBeamGroups } from "../src/render/beams";

function getPitchedEvent(options: {
  duration: number;
  layer?: number;
  offset: number;
  pitches?: number[];
  x?: number;
}): ProjectionEvent {
  return {
    duration: options.duration,
    layer: options.layer ?? 0,
    offset: options.offset,
    pitches: options.pitches ?? [60],
    type: "pitched",
    x: options.x ?? 0.5,
  };
}

function getRestEvent(options: {
  duration: number;
  layer?: number;
  offset: number;
  x?: number;
}): ProjectionEvent {
  return {
    duration: options.duration,
    layer: options.layer ?? 0,
    offset: options.offset,
    pitch: 60,
    type: "rest",
    x: options.x ?? 0.5,
  };
}

describe("buildBeamGroups", () => {
  test("groups contiguous same-layer eighth notes", () => {
    expect(
      buildBeamGroups([
        getPitchedEvent({ duration: 0.5, offset: 0 }),
        getPitchedEvent({ duration: 0.5, offset: 0.5 }),
      ]),
    ).toEqual([{ beamCounts: [1, 1], eventIndices: [0, 1] }]);
  });

  test("breaks groups across rests", () => {
    expect(
      buildBeamGroups([
        getPitchedEvent({ duration: 0.5, offset: 0 }),
        getRestEvent({ duration: 0.5, offset: 0.5 }),
        getPitchedEvent({ duration: 0.5, offset: 1 }),
      ]),
    ).toEqual([]);
  });

  test("does not beam across layers", () => {
    expect(
      buildBeamGroups([
        getPitchedEvent({ duration: 0.5, layer: 0, offset: 0 }),
        getPitchedEvent({ duration: 0.5, layer: 1, offset: 0.5 }),
      ]),
    ).toEqual([]);
  });

  test("allows mixed eighth and sixteenth groups within one layer", () => {
    expect(
      buildBeamGroups([
        getPitchedEvent({ duration: 0.5, offset: 0 }),
        getPitchedEvent({ duration: 0.25, offset: 0.5 }),
        getPitchedEvent({ duration: 0.25, offset: 0.75 }),
      ]),
    ).toEqual([{ beamCounts: [1, 2, 2], eventIndices: [0, 1, 2] }]);
  });

  test("ignores non-beamable durations", () => {
    expect(
      buildBeamGroups([
        getPitchedEvent({ duration: 1, offset: 0 }),
        getPitchedEvent({ duration: 1, offset: 1 }),
      ]),
    ).toEqual([]);
  });
});
