import { describe, expect, test } from "bun:test";

import {
  regionToColor,
  regionToWheel24,
  wheel24ToDarkColor,
} from "../src/render/color";

describe("harmonic color", () => {
  test("maps a compact fifth-run region to its midpoint on the wheel", () => {
    expect(regionToWheel24([0, 7, 2, 9, 4])).toBe(4);
  });

  test("maps a wraparound fifth-run region to its midpoint on the wheel", () => {
    expect(regionToWheel24([5, 0, 7])).toBe(0);
  });

  test("derives base and dark colors from the same wheel position", () => {
    expect(regionToColor([0])).toBe("rgb(254, 125, 125)");
    expect(wheel24ToDarkColor(0)).toBe("#fd0c0c");
  });

  test("returns no region color for an empty region", () => {
    expect(regionToColor([])).toBeUndefined();
  });
});
