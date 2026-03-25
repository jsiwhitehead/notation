import { beforeAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

import { buildRegion } from "../src/harmony/region";
import type { ProjectionEvent } from "../src/projection";
import { buildBeamGroups } from "../src/render/beams";
import {
  getDurationDotCount,
  getShortDurationBeamCount,
} from "../src/render/duration";
import { appendProjectedSegmentEvents } from "../src/render/events";
import {
  appendProjectedSegmentRegions,
  regionToColor,
  regionToWheel24,
  wheel24ToDarkColor,
} from "../src/render/regions";
import type { NotationLayout, RenderSegmentLayout } from "../src/render/layout";

beforeAll(() => {
  GlobalRegistrator.register();
});

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
    pitchOwnerships: (options.pitches ?? [60]).map((pitch) => ({ pitch })),
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

function createBaseLayout(): NotationLayout {
  return {
    height: 300,
    maxPitch: 72,
    minPitch: 58,
    width: 400,
  };
}

function createRenderSegmentLayout(
  segment: RenderSegmentLayout["segment"],
): RenderSegmentLayout {
  const contentWidthPx = 200;

  return {
    contentWidthPx,
    segment,
    widthPx: contentWidthPx + segment.harmonicSlices.length * 30,
    x: 100,
  };
}

function renderSegmentRegions(
  renderSegmentLayout: RenderSegmentLayout,
): SVGGElement {
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

  appendProjectedSegmentRegions(group, createBaseLayout(), renderSegmentLayout);

  return group;
}

function renderSegmentEvents(renderSegmentLayout: RenderSegmentLayout): {
  fillGroup: SVGGElement;
  inkGroup: SVGGElement;
} {
  const fillGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const inkGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");

  appendProjectedSegmentEvents(
    fillGroup,
    inkGroup,
    createBaseLayout().maxPitch,
    renderSegmentLayout,
  );

  return { fillGroup, inkGroup };
}

function getPathDataByFill(group: SVGGElement, fill: string): string[] {
  return [...group.querySelectorAll("path")]
    .filter((path) => path.getAttribute("fill") === fill)
    .map((path) => path.getAttribute("d"))
    .filter((d): d is string => d !== null);
}

function getUniqueNonWhitePathData(group: SVGGElement): string[] {
  return [
    ...new Set(
      [...group.querySelectorAll("path")]
        .filter((path) => path.getAttribute("fill") !== "#ffffff")
        .map((path) => path.getAttribute("d"))
        .filter((d): d is string => d !== null),
    ),
  ];
}

function getNotchMetrics(pathData: string): {
  apexX: number;
  leftX: number;
  rightX: number;
} {
  const moveMatch = pathData.match(/^M (-?\d+(?:\.\d+)?) /);
  const apexMatch = pathData.match(
    / C [^ ]+ [^ ]+ [^ ]+ [^ ]+ (-?\d+(?:\.\d+)?) /,
  );
  const rightCurveMatch = pathData.match(
    / C [^ ]+ [^ ]+ [^ ]+ [^ ]+ (-?\d+(?:\.\d+)?) [^ ]+ L /,
  );

  if (moveMatch === null || apexMatch === null || rightCurveMatch === null) {
    throw new Error(`Unable to parse notch path: ${pathData}`);
  }

  return {
    apexX: Number(apexMatch[1]),
    leftX: Number(moveMatch[1]),
    rightX: Number(rightCurveMatch[1]),
  };
}

function getTranslateX(transform: string): number {
  const match = transform.match(/^translate\((-?\d+(?:\.\d+)?) /);

  if (match === null) {
    throw new Error(`Unable to parse translate x from: ${transform}`);
  }

  return Number(match[1]);
}

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

  test("counts supported duration dots", () => {
    expect(getDurationDotCount(3)).toBe(1);
    expect(getDurationDotCount(1.5)).toBe(1);
    expect(getDurationDotCount(0.75)).toBe(1);
    expect(getDurationDotCount(0.375)).toBe(1);
    expect(getDurationDotCount(3.5)).toBe(2);
    expect(getDurationDotCount(1.75)).toBe(2);
    expect(getDurationDotCount(3.75)).toBe(3);
    expect(getDurationDotCount(1.875)).toBe(3);
    expect(getDurationDotCount(1)).toBe(0);
    expect(getDurationDotCount(0.25)).toBe(0);
  });
});

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

describe("appendProjectedSegmentRegions", () => {
  test("renders a same-pitch span as a 1px band", () => {
    const group = renderSegmentRegions(
      createRenderSegmentLayout({
        events: [],
        harmonicSlices: [
          {
            center: {
              spans: [projectedSpan(62, 62)],
            },
            duration: 1,
            endX: 1,
            field: { spans: [] },
            harmonic: {
              center: region([0]),
              field: region([0]),
            },
            projectedGroundingMarks: undefined,
            startOffset: 0,
            startX: 0,
            touchesSegmentEnd: true,
            touchesSegmentStart: true,
          },
        ],
        index: 0,
        visibleDefaults: { restAnchorPitch: 60 },
        segmentWidthUnits: 25,
        timePositions: [],
        timeSignature: undefined,
        totalDuration: 1,
      }),
    );

    const coloredPaths = getUniqueNonWhitePathData(group);

    expect(coloredPaths).toHaveLength(1);
    expect(coloredPaths[0]).toContain("129.25");
    expect(coloredPaths[0]).toContain("130.75");
  });

  test("positions notches from segment-space event x coordinates", () => {
    const group = renderSegmentRegions(
      createRenderSegmentLayout({
        events: [
          {
            duration: 1,
            layer: 0,
            offset: 2,
            pitchOwnerships: [{ pitch: 62 }],
            pitches: [62],
            type: "pitched",
            x: 0.75,
          },
        ],
        harmonicSlices: [
          {
            center: {
              spans: [projectedSpan(60, 62), projectedSpan(63, 63, {})],
            },
            duration: 1,
            endX: 1,
            field: { spans: [] },
            harmonic: {
              center: region([0]),
              field: region([0]),
            },
            projectedGroundingMarks: undefined,
            startOffset: 2,
            startX: 0.5,
            touchesSegmentEnd: true,
            touchesSegmentStart: false,
          },
        ],
        index: 0,
        visibleDefaults: { restAnchorPitch: 60 },
        segmentWidthUnits: 25,
        timePositions: [{ maxDuration: 1, offset: 2, x: 0.5 }],
        timeSignature: undefined,
        totalDuration: 3,
      }),
    );
    const [notchPath] = getPathDataByFill(group, "#ffffff");

    expect(notchPath).toBeDefined();

    const { apexX, leftX, rightX } = getNotchMetrics(notchPath!);

    expect(leftX).toBe(250);
    expect(rightX).toBe(280);
    expect(apexX).toBe(266.2);
  });

  test("only creates notches from events inside the current slice", () => {
    const group = renderSegmentRegions(
      createRenderSegmentLayout({
        events: [
          {
            duration: 1,
            layer: 0,
            offset: 0,
            pitchOwnerships: [{ pitch: 62 }],
            pitches: [62],
            type: "pitched",
            x: 0.25,
          },
          {
            duration: 1,
            layer: 0,
            offset: 2,
            pitchOwnerships: [{ pitch: 62 }],
            pitches: [62],
            type: "pitched",
            x: 0.75,
          },
        ],
        harmonicSlices: [
          {
            center: {
              spans: [projectedSpan(60, 62), projectedSpan(63, 63, {})],
            },
            duration: 1,
            endX: 1,
            field: { spans: [] },
            harmonic: {
              center: region([0]),
              field: region([0]),
            },
            projectedGroundingMarks: undefined,
            startOffset: 2,
            startX: 0.5,
            touchesSegmentEnd: true,
            touchesSegmentStart: false,
          },
        ],
        index: 0,
        visibleDefaults: { restAnchorPitch: 60 },
        segmentWidthUnits: 25,
        timePositions: [{ maxDuration: 1, offset: 2, x: 0.5 }],
        timeSignature: undefined,
        totalDuration: 3,
      }),
    );

    const notchPaths = getPathDataByFill(group, "#ffffff");

    expect(notchPaths).toHaveLength(1);

    const { apexX } = getNotchMetrics(notchPaths[0]!);

    expect(apexX).toBe(266.2);
  });

  test("renders joins across internal slice boundaries", () => {
    const group = renderSegmentRegions(
      createRenderSegmentLayout({
        events: [],
        harmonicSlices: [
          {
            center: {
              spans: [projectedSpan(60, 62, { next: { end: 64, start: 62 } })],
            },
            duration: 1,
            endX: 0.5,
            field: {
              spans: [projectedSpan(60, 62, { next: { end: 64, start: 62 } })],
            },
            harmonic: {
              center: region([0, 2]),
              field: region([0, 2]),
            },
            projectedGroundingMarks: undefined,
            startOffset: 0,
            startX: 0,
            touchesSegmentEnd: false,
            touchesSegmentStart: true,
          },
          {
            center: {
              spans: [projectedSpan(62, 64, { prev: { end: 62, start: 60 } })],
            },
            duration: 1,
            endX: 1,
            field: {
              spans: [projectedSpan(62, 64, { prev: { end: 62, start: 60 } })],
            },
            harmonic: {
              center: region([0, 2]),
              field: region([0, 2]),
            },
            projectedGroundingMarks: undefined,
            startOffset: 1,
            startX: 0.5,
            touchesSegmentEnd: true,
            touchesSegmentStart: false,
          },
        ],
        index: 0,
        visibleDefaults: { restAnchorPitch: 60 },
        segmentWidthUnits: 25,
        timePositions: [],
        timeSignature: undefined,
        totalDuration: 2,
      }),
    );

    const joinedPaths = getUniqueNonWhitePathData(group);

    expect(joinedPaths).toHaveLength(2);
    expect(
      joinedPaths.some((pathData) => pathData.includes("L 215 131.5 C")),
    ).toBe(true);
    expect(
      joinedPaths.some((pathData) =>
        pathData.includes("M 230 128.5 C 232.625 127 235.25 125.5 245 125.5 L"),
      ),
    ).toBe(true);
    expect(
      joinedPaths.some((pathData) =>
        pathData.includes("L 215 131.5 C 224.75 131.5 227.375 130 230 128.5"),
      ),
    ).toBe(true);
  });
});

describe("appendProjectedSegmentEvents", () => {
  test("shifts event x positions out of internal slice join gaps", () => {
    const { fillGroup } = renderSegmentEvents(
      createRenderSegmentLayout({
        events: [
          getPitchedEvent({
            duration: 4,
            offset: 0,
            pitches: [60],
            x: 0.25,
          }),
          getPitchedEvent({
            duration: 4,
            offset: 2,
            pitches: [60],
            x: 0.75,
          }),
        ],
        harmonicSlices: [
          {
            center: { spans: [] },
            duration: 2,
            endX: 0.5,
            field: { spans: [] },
            harmonic: {
              center: region([0]),
              field: region([0]),
            },
            projectedGroundingMarks: undefined,
            startOffset: 0,
            startX: 0,
            touchesSegmentEnd: false,
            touchesSegmentStart: true,
          },
          {
            center: { spans: [] },
            duration: 2,
            endX: 1,
            field: { spans: [] },
            harmonic: {
              center: region([0]),
              field: region([0]),
            },
            projectedGroundingMarks: undefined,
            startOffset: 2,
            startX: 0.5,
            touchesSegmentEnd: true,
            touchesSegmentStart: false,
          },
        ],
        index: 0,
        visibleDefaults: { restAnchorPitch: 60 },
        segmentWidthUnits: 25,
        timePositions: [
          { maxDuration: 4, offset: 0, x: 0.25 },
          { maxDuration: 4, offset: 2, x: 0.75 },
        ],
        timeSignature: undefined,
        totalDuration: 4,
      }),
    );
    const transforms = [...fillGroup.querySelectorAll("path")]
      .map((path) => path.getAttribute("transform"))
      .filter((transform): transform is string => transform !== null);

    expect(transforms).toHaveLength(2);

    const [firstOriginX, secondOriginX] = transforms.map(getTranslateX);

    expect(firstOriginX).toBeDefined();
    expect(secondOriginX).toBeDefined();
    expect(secondOriginX! - firstOriginX!).toBeCloseTo(130, 6);
  });

  test("keeps a single-slice segment event centered in the flat body", () => {
    const { fillGroup } = renderSegmentEvents(
      createRenderSegmentLayout({
        events: [
          getPitchedEvent({
            duration: 4,
            offset: 0,
            pitches: [60],
            x: 0.5,
          }),
        ],
        harmonicSlices: [
          {
            center: { spans: [] },
            duration: 4,
            endX: 1,
            field: { spans: [] },
            harmonic: {
              center: region([0]),
              field: region([0]),
            },
            projectedGroundingMarks: undefined,
            startOffset: 0,
            startX: 0,
            touchesSegmentEnd: true,
            touchesSegmentStart: true,
          },
        ],
        index: 0,
        visibleDefaults: { restAnchorPitch: 60 },
        segmentWidthUnits: 25,
        timePositions: [{ maxDuration: 4, offset: 0, x: 0.5 }],
        timeSignature: undefined,
        totalDuration: 4,
      }),
    );
    const transforms = [...fillGroup.querySelectorAll("path")]
      .map((path) => path.getAttribute("transform"))
      .filter((transform): transform is string => transform !== null);

    expect(transforms).toHaveLength(1);
    expect(getTranslateX(transforms[0]!)).toBeCloseTo(209.01792452830188, 6);
  });

  test("positions short later-slice events within that slice instead of clamping to its start", () => {
    const { fillGroup } = renderSegmentEvents(
      createRenderSegmentLayout({
        events: [
          getPitchedEvent({
            duration: 0.5,
            offset: 3.5,
            pitches: [74],
            x: 0.8927281350120794,
          }),
          getPitchedEvent({
            duration: 0.25,
            offset: 3.75,
            pitches: [72],
            x: 0.9523236155609242,
          }),
        ],
        harmonicSlices: [
          {
            center: { spans: [] },
            duration: 3.5,
            endX: 0.8927281350120794,
            field: { spans: [] },
            harmonic: {
              center: region([0]),
              field: region([0]),
            },
            projectedGroundingMarks: undefined,
            startOffset: 0,
            startX: 0,
            touchesSegmentEnd: false,
            touchesSegmentStart: true,
          },
          {
            center: { spans: [] },
            duration: 0.5,
            endX: 1,
            field: { spans: [] },
            harmonic: {
              center: region([0]),
              field: region([0]),
            },
            projectedGroundingMarks: undefined,
            startOffset: 3.5,
            startX: 0.8927281350120794,
            touchesSegmentEnd: true,
            touchesSegmentStart: false,
          },
        ],
        index: 0,
        visibleDefaults: { restAnchorPitch: 60 },
        segmentWidthUnits: 25,
        timePositions: [
          { maxDuration: 0.5, offset: 3.5, x: 0.8927281350120794 },
          { maxDuration: 0.25, offset: 3.75, x: 0.9523236155609242 },
        ],
        timeSignature: undefined,
        totalDuration: 4,
      }),
    );
    const transforms = [...fillGroup.querySelectorAll("path")]
      .map((path) => path.getAttribute("transform"))
      .filter((transform): transform is string => transform !== null);

    expect(transforms).toHaveLength(2);

    const [firstOriginX, secondOriginX] = transforms.map(getTranslateX);

    expect(secondOriginX).toBeGreaterThan(firstOriginX! + 5);
    expect(firstOriginX!).toBeGreaterThan(233);
  });
});

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
