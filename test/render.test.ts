import { beforeAll, describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

import { buildRegion } from "../src/harmony/region";
import type { ProjectionEvent } from "../src/projection";
import { renderNotationSvg } from "../src/render";
import { buildBeamGroups } from "../src/render/beams";
import {
  getDurationDotCount,
  getShortDurationBeamCount,
} from "../src/render/duration";
import { appendProjectedSegmentEvents } from "../src/render/events";
import {
  appendProjectedSegmentRegions,
  flattenColorOverWhite,
  regionToColor,
  regionToWheel24,
  wheel24ToDarkColor,
} from "../src/render/regions";
import type { NotationLayout, RenderSegmentLayout } from "../src/render/layout";
import {
  OUT_OF_FIELD_MARK_STROKE_WIDTH_PX,
  OUT_OF_FIELD_MARK_WIDTH_PX,
} from "../src/render/metrics";

beforeAll(() => {
  GlobalRegistrator.register();
});

function getPitchedEvent(options: {
  duration: number;
  layer?: number;
  offset: number;
  pitches?: number[];
  pitchOwnerships?: Array<{
    fieldSpan?: { end: number; start: number };
    pitch: number;
  }>;
  x?: number;
}): ProjectionEvent {
  return {
    duration: options.duration,
    layer: options.layer ?? 0,
    offset: options.offset,
    pitchOwnerships:
      options.pitchOwnerships ??
      (options.pitches ?? [60]).map((pitch) => ({ pitch })),
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
    join?: Array<{
      end: number;
      start: number;
      targetInsetDirection: "down" | "none" | "up";
    }>;
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

function createProjectionSegment(
  segment: RenderSegmentLayout["segment"],
): import("../src/projection").Projection["segments"][number] {
  return segment;
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

function getOutOfFieldLines(group: SVGGElement): SVGLineElement[] {
  return [...group.querySelectorAll("line")].filter(
    (line) =>
      line.getAttribute("y1") === line.getAttribute("y2") &&
      Number(line.getAttribute("stroke-width")) ===
        OUT_OF_FIELD_MARK_STROKE_WIDTH_PX,
  );
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

    expect(leftX).toBe(185);
    expect(rightX).toBe(215);
    expect(apexX).toBe(201.2);
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

    expect(apexX).toBe(201.2);
  });

  test("keeps spans flat across internal slice boundaries", () => {
    const group = renderSegmentRegions(
      createRenderSegmentLayout({
        events: [],
        harmonicSlices: [
          {
            center: {
              spans: [
                projectedSpan(60, 62, {
                  join: [
                    {
                      end: 64,
                      start: 62,
                      targetInsetDirection: "none",
                    },
                  ],
                }),
              ],
            },
            duration: 1,
            endX: 0.5,
            field: {
              spans: [
                projectedSpan(60, 62, {
                  join: [
                    {
                      end: 64,
                      start: 62,
                      targetInsetDirection: "none",
                    },
                  ],
                }),
              ],
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
              spans: [projectedSpan(62, 64)],
            },
            duration: 1,
            endX: 1,
            field: {
              spans: [projectedSpan(62, 64)],
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
      joinedPaths.some(
        (pathData) =>
          pathData ===
          "M 100 131.5 L 200 131.5 L 200 134.5 L 100 134.5 Z M 200 125.5 L 210 125.5 L 210 128.5 L 200 128.5 Z",
      ),
    ).toBe(true);
    expect(
      joinedPaths.some(
        (pathData) =>
          pathData === "M 210 125.5 L 310 125.5 L 310 128.5 L 210 128.5 Z",
      ),
    ).toBe(true);
  });

  test("renders ground marks at half the width of root marks", () => {
    const group = renderSegmentRegions(
      createRenderSegmentLayout({
        events: [],
        harmonicSlices: [
          {
            center: { spans: [] },
            duration: 1,
            endX: 1,
            field: { spans: [] },
            harmonic: {
              center: region([0, 7]),
              field: region([0, 7]),
              grounding: { ground: 7, root: 0 },
            },
            projectedGroundingMarks: {
              groundPitchClass: 7,
              marks: [
                { pitch: 60, type: "root" },
                { pitch: 67, type: "ground" },
              ],
              rootPitchClass: 0,
            },
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

    const widths = [...group.querySelectorAll("rect")].map((rect) =>
      Number(rect.getAttribute("width")),
    );

    expect(widths).toEqual([10, 5]);
  });
});

describe("appendProjectedSegmentEvents", () => {
  test("keeps adjacent slice event x positions continuous", () => {
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
    expect(secondOriginX! - firstOriginX!).toBeCloseTo(110, 6);
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
    expect(getTranslateX(transforms[0]!)).toBeCloseTo(194.01792452830188, 6);
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
    expect(firstOriginX!).toBeGreaterThan(200);
  });

  test("draws a short horizontal mark through noteheads outside the field", () => {
    const { fillGroup } = renderSegmentEvents(
      createRenderSegmentLayout({
        events: [
          getPitchedEvent({
            duration: 1,
            offset: 0,
            pitches: [61],
            pitchOwnerships: [{ pitch: 61 }],
          }),
        ],
        harmonicSlices: [
          {
            center: { spans: [] },
            duration: 1,
            endX: 1,
            field: { spans: [] },
            harmonic: {
              center: region([]),
              field: region([]),
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
        timePositions: [{ maxDuration: 1, offset: 0, x: 0.5 }],
        timeSignature: undefined,
        totalDuration: 1,
      }),
    );

    const outOfFieldLines = getOutOfFieldLines(fillGroup);

    expect(outOfFieldLines).toHaveLength(1);
    expect(fillGroup.contains(outOfFieldLines[0]!)).toBe(true);
    expect(
      Number(outOfFieldLines[0]?.getAttribute("x2")) -
        Number(outOfFieldLines[0]?.getAttribute("x1")),
    ).toBeCloseTo(OUT_OF_FIELD_MARK_WIDTH_PX, 6);
  });
});

describe("renderNotationSvg", () => {
  test("renders joined center spans as single filled paths across slice and segment boundaries", () => {
    const svg = renderNotationSvg({
      maxPitch: 72,
      minPitch: 58,
      segments: [
        createProjectionSegment({
          events: [],
          harmonicSlices: [
            {
              center: {
                spans: [
                  projectedSpan(60, 64, {
                    join: [
                      {
                        end: 64,
                        start: 64,
                        targetInsetDirection: "down",
                      },
                    ],
                  }),
                ],
              },
              duration: 1,
              endX: 0.5,
              field: { spans: [] },
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
                spans: [
                  projectedSpan(64, 68, {
                    join: [
                      {
                        end: 68,
                        start: 66,
                        targetInsetDirection: "none",
                      },
                    ],
                  }),
                ],
              },
              duration: 1,
              endX: 1,
              field: { spans: [] },
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
        createProjectionSegment({
          events: [],
          harmonicSlices: [
            {
              center: { spans: [projectedSpan(66, 70)] },
              duration: 1,
              endX: 1,
              field: { spans: [] },
              harmonic: {
                center: region([0, 2]),
                field: region([0, 2]),
              },
              projectedGroundingMarks: undefined,
              startOffset: 0,
              startX: 0,
              touchesSegmentEnd: true,
              touchesSegmentStart: true,
            },
          ],
          index: 1,
          visibleDefaults: { restAnchorPitch: 60 },
          segmentWidthUnits: 25,
          timePositions: [],
          timeSignature: undefined,
          totalDuration: 1,
        }),
      ],
    });

    const baseCenterFill = flattenColorOverWhite(
      regionToColor([0, 2]) ?? "#111111",
      0.4,
    );
    const markerPaths = [...svg.querySelectorAll("path")]
      .filter((path) => path.getAttribute("fill") === baseCenterFill)
      .map((path) => path.getAttribute("d"))
      .filter((pathData): pathData is string => pathData !== null);

    expect(markerPaths).toContain(
      "M 28 125.5 L 128 125.5 L 128 134.5 L 28 134.5 Z M 128 125.5 L 138 121 L 138 122.5 L 128 127 Z",
    );
    expect(markerPaths).toContain(
      "M 138 113.5 L 238 113.5 L 238 122.5 L 138 122.5 Z M 238 113.5 L 248 113.5 L 248 116.5 L 238 116.5 Z",
    );
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
