import { describe, expect, test } from "bun:test";

import { getShortDurationBeamCount } from "../src/render/duration";

describe("render duration policy", () => {
  test("maps supported short durations to beam counts", () => {
    expect(getShortDurationBeamCount(0.5)).toBe(1);
    expect(getShortDurationBeamCount(0.25)).toBe(2);
    expect(getShortDurationBeamCount(0.125)).toBe(3);
    expect(getShortDurationBeamCount(0.0625)).toBe(4);
  });

  test("returns zero for non-beamable durations", () => {
    expect(getShortDurationBeamCount(4)).toBe(0);
    expect(getShortDurationBeamCount(2)).toBe(0);
    expect(getShortDurationBeamCount(1)).toBe(0);
    expect(getShortDurationBeamCount(0.75)).toBe(0);
  });
});
