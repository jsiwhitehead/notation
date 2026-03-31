import { sliceContainsOffset } from "../projection";
import type { ProjectedSpan, Span } from "../projection/spans";
import {
  appendPositionedGraphics,
  buildPositionedGraphics,
  getRenderedEventCenterX,
  getRenderedHarmonicSliceBounds,
  type NotationLayout,
  type RenderSegmentLayout,
} from "./layout";
import {
  CENTER_SPAN_NOTCH_APEX_X_OFFSET_PX,
  CENTER_SPAN_NOTCH_CONTROL_X_RATIO,
  CENTER_SPAN_NOTCH_HEIGHT_EXTENSION_PX,
  CENTER_SPAN_NOTCH_HALF_WIDTH_PX,
  GROUNDING_MARK_HEIGHT_PX,
  GROUNDING_MARK_WIDTH_PX,
  JOIN_CURVE_CONTROL_X_RATIO,
  getYForPitch,
  PITCH_STEP_HEIGHT_PX,
  SEGMENT_GAP_PX,
  SINGLE_PITCH_SPAN_HEIGHT_PX,
  SPAN_EVENT_CLEARANCE_PX,
} from "./metrics";
import type { PitchClass } from "../model";
import { getRegionMidpointInHalfFifths, mod } from "../pitch";
import { createSvgElement, setAttributes } from "./svg";

const HARMONIC_WHEEL_SIZE = 24;
const HARMONIC_WHEEL_24 = [
  "rgb(254, 125, 125)",
  "rgb(255, 141, 102)",
  "rgb(255, 156, 75)",
  "rgb(255, 172, 65)",
  "rgb(255, 187, 53)",
  "rgb(251, 196, 36)",
  "rgb(247, 204, 0)",
  "rgb(236, 215, 0)",
  "rgb(225, 225, 0)",
  "rgb(194, 226, 7)",
  "rgb(161, 227, 15)",
  "rgb(124, 222, 53)",
  "rgb(75, 217, 75)",
  "rgb(74, 195, 129)",
  "rgb(53, 173, 173)",
  "rgb(85, 153, 188)",
  "rgb(103, 133, 203)",
  "rgb(118, 120, 203)",
  "rgb(130, 105, 203)",
  "rgb(149, 101, 204)",
  "rgb(166, 96, 205)",
  "rgb(198, 94, 186)",
  "rgb(226, 91, 168)",
  "rgb(241, 108, 147)",
] as const;
const HARMONIC_WHEEL_24_DARK = [
  "#fd0c0c",
  "#f24a06",
  "#e76700",
  "#e07c00",
  "#d78f00",
  "#c28f00",
  "#ac8e00",
  "#a59600",
  "#9d9d00",
  "#879e05",
  "#709e0a",
  "#53a319",
  "#23a823",
  "#2f9055",
  "#257979",
  "#33688c",
  "#36569f",
  "#4648a0",
  "#5237a0",
  "#6635a0",
  "#7832a0",
  "#9d2c8c",
  "#bc2179",
  "#df194a",
] as const;

type Point = {
  x: number;
  y: number;
};

type SpanRect = {
  bottom: number;
  height: number;
  top: number;
};

export type VerticalBounds = {
  height: number;
  y: number;
};

type PaintLayer = {
  fill: string;
  opacity: number;
};

type RegionPaint = {
  layers: PaintLayer[];
};

type RegionGraphic = GroundMarkGraphic | NotchRegionGraphic | SpanRegionGraphic;

type PositionedRegionGraphic =
  | PositionedGroundMarkGraphic
  | PositionedNotchRegionGraphic
  | PositionedSpanRegionGraphic;

type SpanRegionGraphic = {
  bounds: HorizontalBounds;
  nextJoinGapPx: number;
  paint: RegionPaint;
  prevJoinGapPx: number;
  projectedSpan: ProjectedSpan;
  type: "span";
};

type PositionedSpanRegionGraphic = {
  pathData: string;
  paint: RegionPaint;
  type: "span";
};

type NotchRegionGraphic = {
  centerX: number;
  clipWidth: number;
  clipX: number;
  noteY: number;
  spanEdgeY: number;
  type: "notch";
};

type PositionedNotchRegionGraphic = {
  pathData: string;
  type: "notch";
};

type GroundMarkGraphic = {
  fill: string;
  markType: "ground" | "root";
  pitch: number;
  sliceX: number;
  type: "ground";
};

type PositionedGroundMarkGraphic = {
  fill: string;
  height: number;
  width: number;
  x: number;
  y: number;
  type: "ground";
};

type CubicCurve = [Point, Point, Point, Point];

type CenterSpanNotchEdges = {
  bottom: boolean;
  top: boolean;
};

type CenterSpanNotchSets = {
  spanEnds: Set<number>;
  spanStarts: Set<number>;
};

type PitchedRenderEvent = RenderSegmentLayout["segment"]["events"][number] & {
  pitches: number[];
  type: "pitched";
  x: number;
};

function getSpanRect(maxPitch: number, span: Span): SpanRect {
  if (span.start === span.end) {
    const centerY = getYForPitch(maxPitch, span.start);
    const halfHeight = SINGLE_PITCH_SPAN_HEIGHT_PX / 2;

    return {
      bottom: centerY + halfHeight,
      height: SINGLE_PITCH_SPAN_HEIGHT_PX,
      top: centerY - halfHeight,
    };
  }

  const top = getYForPitch(maxPitch, span.end) + SPAN_EVENT_CLEARANCE_PX;
  const bottom = getYForPitch(maxPitch, span.start) - SPAN_EVENT_CLEARANCE_PX;

  return {
    bottom,
    height: bottom - top,
    top,
  };
}

function getSpanVerticalBounds(maxPitch: number, span: Span): VerticalBounds {
  const rect = getSpanRect(maxPitch, span);

  return {
    height: rect.height,
    y: rect.top,
  };
}

function getCombinedVerticalBounds(
  bounds: VerticalBounds[],
): VerticalBounds | undefined {
  if (bounds.length === 0) {
    return undefined;
  }

  const top = Math.min(...bounds.map((bound) => bound.y));
  const bottom = Math.max(...bounds.map((bound) => bound.y + bound.height));

  return {
    height: bottom - top,
    y: top,
  };
}

export function getProjectedRegionsVerticalBounds(
  maxPitch: number,
  renderSegmentLayouts: RenderSegmentLayout[],
): { height: number; y: number } | undefined {
  const spanBounds = renderSegmentLayouts.flatMap((renderSegmentLayout) =>
    renderSegmentLayout.segment.harmonicSlices.flatMap((harmonicSlice) =>
      [...harmonicSlice.center.spans, ...harmonicSlice.field.spans].map(
        (span) => getSpanVerticalBounds(maxPitch, span),
      ),
    ),
  );

  return getCombinedVerticalBounds(spanBounds);
}

type SpanNotchGeometry = {
  apexX: number;
  apexY: number;
  baseY: number;
};

type HighlightStrength = "base" | "mid" | "strong";

type SuppressedNotchEdges = {
  bottom: Set<number>;
  top: Set<number>;
};

export function regionToWheel24(
  pitchClasses: PitchClass[],
): number | undefined {
  return getRegionMidpointInHalfFifths(pitchClasses);
}

function wheel24ToColor(wheelIndex: number): string {
  const normalizedIndex = mod(wheelIndex, HARMONIC_WHEEL_SIZE);
  return HARMONIC_WHEEL_24[normalizedIndex]!;
}

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parseRgbColor(color: string): [number, number, number] | undefined {
  const match = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);

  if (match === null) {
    return undefined;
  }

  const [, red, green, blue] = match;

  return [
    Number.parseInt(red!, 10),
    Number.parseInt(green!, 10),
    Number.parseInt(blue!, 10),
  ];
}

export function wheel24ToDarkColor(wheelIndex: number): string {
  const normalizedIndex = mod(wheelIndex, HARMONIC_WHEEL_SIZE);
  return HARMONIC_WHEEL_24_DARK[normalizedIndex]!;
}

export function flattenColorOverWhite(color: string, alpha: number): string {
  const parsedColor = parseRgbColor(color);

  if (parsedColor === undefined) {
    return color;
  }

  const [red, green, blue] = parsedColor;
  const flattenChannel = (channel: number): number =>
    clampChannel(255 - alpha * (255 - channel));

  return `rgb(${flattenChannel(red)}, ${flattenChannel(green)}, ${flattenChannel(blue)})`;
}

export function regionToColor(pitchClasses: PitchClass[]): string | undefined {
  const wheelIndex = regionToWheel24(pitchClasses);

  if (wheelIndex === undefined) {
    return undefined;
  }

  return wheel24ToColor(wheelIndex);
}

type HorizontalBounds = {
  width: number;
  x: number;
};

type SliceGeometryContext = {
  nextJoinGapPx: number;
  notchSets: CenterSpanNotchSets;
  pitchedEvents: PitchedRenderEvent[];
  prevJoinGapPx: number;
  sliceBounds: HorizontalBounds;
};

function getCenterDarkColor(centerPitchClasses: number[]): string {
  const wheelIndex = regionToWheel24(centerPitchClasses);

  return wheelIndex === undefined ? "#111111" : wheel24ToDarkColor(wheelIndex);
}

function isDrawableSpanRect(rect: SpanRect): boolean {
  return rect.height > 0;
}

function appendGroundMark(
  group: SVGGElement,
  positionedGroundMark: PositionedGroundMarkGraphic,
): void {
  const rect = createSvgElement("rect");

  setAttributes(rect, {
    fill: positionedGroundMark.fill,
    height: positionedGroundMark.height,
    width: positionedGroundMark.width,
    x: positionedGroundMark.x,
    y: positionedGroundMark.y,
  });

  group.append(rect);
}

function appendProjectedSpan(
  group: SVGGElement,
  positionedSpan: PositionedSpanRegionGraphic,
): void {
  positionedSpan.paint.layers.forEach((attributes) => {
    const path = createSvgElement("path");
    setAttributes(path, {
      ...attributes,
      d: positionedSpan.pathData,
    });
    group.append(path);
  });
}

function getProjectedSpanPath(
  maxPitch: number,
  nextJoinGapPx: number,
  prevJoinGapPx: number,
  bounds: HorizontalBounds,
  projectedSpan: ProjectedSpan,
): string | undefined {
  const nextJoinExtension = nextJoinGapPx / 2;
  const prevJoinExtension = prevJoinGapPx / 2;
  const currentRect = getSpanRect(maxPitch, projectedSpan);

  if (!isDrawableSpanRect(currentRect)) {
    return undefined;
  }

  const prevHalf =
    projectedSpan.prev === undefined
      ? undefined
      : getJoinHalf(
          maxPitch,
          prevJoinGapPx,
          bounds,
          projectedSpan,
          projectedSpan.prev,
          "prev",
        );
  const nextHalf =
    projectedSpan.next === undefined
      ? undefined
      : getJoinHalf(
          maxPitch,
          nextJoinGapPx,
          bounds,
          projectedSpan,
          projectedSpan.next,
          "next",
        );
  const leftX =
    bounds.x - (projectedSpan.prev === undefined ? prevJoinExtension : 0);
  const rightX =
    bounds.x +
    bounds.width +
    (projectedSpan.next === undefined ? nextJoinExtension : 0);

  return [
    prevHalf === undefined
      ? `M ${leftX} ${currentRect.top}`
      : `M ${prevHalf.midTop.x} ${prevHalf.midTop.y}`,
    ...(prevHalf === undefined
      ? []
      : [getHalfCubicCommand(prevHalf.top, "prev", "top")]),
    `L ${rightX} ${currentRect.top}`,
    ...(nextHalf === undefined
      ? []
      : [getHalfCubicCommand(nextHalf.top, "next", "top")]),
    nextHalf === undefined
      ? `L ${rightX} ${currentRect.bottom}`
      : `L ${nextHalf.midBottom.x} ${nextHalf.midBottom.y}`,
    ...(nextHalf === undefined
      ? []
      : [getHalfCubicCommand(nextHalf.bottom, "next", "bottom")]),
    `L ${leftX} ${currentRect.bottom}`,
    ...(prevHalf === undefined
      ? []
      : [getHalfCubicCommand(prevHalf.bottom, "prev", "bottom")]),
    "Z",
  ].join(" ");
}

function splitCubicAtHalf(curve: CubicCurve): {
  left: CubicCurve;
  right: CubicCurve;
} {
  const startControl = midpoint(curve[0], curve[1]);
  const innerControl = midpoint(curve[1], curve[2]);
  const endControl = midpoint(curve[2], curve[3]);
  const leftControl = midpoint(startControl, innerControl);
  const rightControl = midpoint(innerControl, endControl);
  const middle = midpoint(leftControl, rightControl);

  return {
    left: [curve[0], startControl, leftControl, middle],
    right: [middle, rightControl, endControl, curve[3]],
  };
}

function midpoint(left: Point, right: Point): Point {
  return {
    x: (left.x + right.x) / 2,
    y: (left.y + right.y) / 2,
  };
}

function getHalfCubicCommand(
  halfCurve: CubicCurve,
  direction: "next" | "prev",
  edge: "bottom" | "top",
): string {
  if (direction === "next") {
    if (edge === "top") {
      return `C ${halfCurve[1].x} ${halfCurve[1].y} ${halfCurve[2].x} ${halfCurve[2].y} ${halfCurve[3].x} ${halfCurve[3].y}`;
    }

    return `C ${halfCurve[2].x} ${halfCurve[2].y} ${halfCurve[1].x} ${halfCurve[1].y} ${halfCurve[0].x} ${halfCurve[0].y}`;
  }

  if (edge === "top") {
    return `C ${halfCurve[1].x} ${halfCurve[1].y} ${halfCurve[2].x} ${halfCurve[2].y} ${halfCurve[3].x} ${halfCurve[3].y}`;
  }

  return `C ${halfCurve[2].x} ${halfCurve[2].y} ${halfCurve[1].x} ${halfCurve[1].y} ${halfCurve[0].x} ${halfCurve[0].y}`;
}

function getJoinHalf(
  maxPitch: number,
  gapPx: number,
  bounds: HorizontalBounds,
  currentSpan: Span,
  joinedSpan: Span,
  direction: "next" | "prev",
):
  | {
      bottom: CubicCurve;
      midBottom: Point;
      midTop: Point;
      top: CubicCurve;
    }
  | undefined {
  const fullJoinCurves = getFullJoinCurves(
    maxPitch,
    gapPx,
    bounds,
    currentSpan,
    joinedSpan,
    direction,
  );

  if (fullJoinCurves === undefined) {
    return undefined;
  }

  const { bottomCurve, topCurve } = fullJoinCurves;
  const topHalf = splitCubicAtHalf(topCurve);
  const bottomHalf = splitCubicAtHalf(bottomCurve);

  if (direction === "next") {
    return {
      bottom: bottomHalf.left,
      midBottom: bottomHalf.left[3],
      midTop: topHalf.left[3],
      top: topHalf.left,
    };
  }

  return {
    bottom: bottomHalf.right,
    midBottom: bottomHalf.right[0],
    midTop: topHalf.right[0],
    top: topHalf.right,
  };
}

function getFullJoinCurves(
  maxPitch: number,
  gapPx: number,
  bounds: HorizontalBounds,
  currentSpan: Span,
  joinedSpan: Span,
  direction: "next" | "prev",
):
  | {
      bottomCurve: CubicCurve;
      topCurve: CubicCurve;
    }
  | undefined {
  const currentRect = getSpanRect(maxPitch, currentSpan);
  const joinedRect = getSpanRect(maxPitch, joinedSpan);

  if (!isDrawableSpanRect(currentRect) || !isDrawableSpanRect(joinedRect)) {
    return undefined;
  }

  const currentEdgeX =
    direction === "next" ? bounds.x + bounds.width : bounds.x;
  const joinedEdgeX = currentEdgeX + (direction === "next" ? gapPx : -gapPx);
  const leftX = Math.min(currentEdgeX, joinedEdgeX);
  const rightX = Math.max(currentEdgeX, joinedEdgeX);
  const leftRect = currentEdgeX <= joinedEdgeX ? currentRect : joinedRect;
  const rightRect = currentEdgeX <= joinedEdgeX ? joinedRect : currentRect;
  const joinControlX = gapPx * JOIN_CURVE_CONTROL_X_RATIO;
  const fullTopCurve: CubicCurve = [
    { x: leftX, y: leftRect.top },
    { x: leftX + joinControlX, y: leftRect.top },
    { x: rightX - joinControlX, y: rightRect.top },
    { x: rightX, y: rightRect.top },
  ];
  const fullBottomCurve: CubicCurve = [
    { x: leftX, y: leftRect.bottom },
    { x: leftX + joinControlX, y: leftRect.bottom },
    { x: rightX - joinControlX, y: rightRect.bottom },
    { x: rightX, y: rightRect.bottom },
  ];
  return {
    bottomCurve: fullBottomCurve,
    topCurve: fullTopCurve,
  };
}

function getFieldPaint(): RegionPaint {
  return {
    layers: [{ fill: "#ffffff", opacity: 1 }],
  };
}

function getCenterPaint(
  color: string,
  highlightStrength: HighlightStrength,
): RegionPaint {
  return {
    layers: [
      {
        fill: flattenColorOverWhite(
          color,
          highlightStrength === "strong"
            ? 1
            : highlightStrength === "mid"
              ? 0.55
              : 0.4,
        ),
        opacity: 1,
      },
    ],
  };
}

function spanContainsPitch(span: Span, pitch: number): boolean {
  return (
    pitch >= span.start && pitch <= span.end && (pitch - span.start) % 2 === 0
  );
}

function spanContainsPitchClass(span: Span, pitchClass: PitchClass): boolean {
  for (let pitch = span.start; pitch <= span.end; pitch += 2) {
    if (mod(pitch, 12) === pitchClass) {
      return true;
    }
  }

  return false;
}

function appendCenterSpanNotches(
  maxPitch: number,
  sliceBounds: HorizontalBounds,
  renderSegmentLayout: RenderSegmentLayout,
  projectedSpan: ProjectedSpan,
  notchEdges: CenterSpanNotchEdges,
  pitchedEvents: PitchedRenderEvent[],
): NotchRegionGraphic[] {
  const spanRect = getSpanRect(maxPitch, projectedSpan);
  const notchGraphics: NotchRegionGraphic[] = [];
  const suppressedNotchEdges = getSuppressedInternalNotchEdges(pitchedEvents);

  if (!isDrawableSpanRect(spanRect)) {
    return notchGraphics;
  }

  pitchedEvents.forEach((event) => {
    const centerX = getRenderedEventCenterX(renderSegmentLayout, event);

    event.pitches.forEach((pitch) => {
      if (
        pitch === projectedSpan.end &&
        notchEdges.top &&
        !suppressedNotchEdges.top.has(pitch)
      ) {
        notchGraphics.push({
          centerX,
          clipWidth: sliceBounds.width,
          clipX: sliceBounds.x,
          noteY: getYForPitch(maxPitch, pitch),
          spanEdgeY: spanRect.top,
          type: "notch",
        });
      }

      if (
        pitch === projectedSpan.start &&
        notchEdges.bottom &&
        !suppressedNotchEdges.bottom.has(pitch)
      ) {
        notchGraphics.push({
          centerX,
          clipWidth: sliceBounds.width,
          clipX: sliceBounds.x,
          noteY: getYForPitch(maxPitch, pitch),
          spanEdgeY: spanRect.bottom,
          type: "notch",
        });
      }
    });
  });

  return notchGraphics;
}

function getSuppressedInternalNotchEdges(
  pitchedEvents: PitchedRenderEvent[],
): SuppressedNotchEdges {
  const suppressedEdges: SuppressedNotchEdges = {
    bottom: new Set<number>(),
    top: new Set<number>(),
  };

  pitchedEvents.forEach((event) => {
    const sortedPitches = [...event.pitches].sort(
      (left, right) => left - right,
    );

    sortedPitches.slice(0, -1).forEach((pitch, index) => {
      const nextPitch = sortedPitches[index + 1]!;

      if (nextPitch - pitch > 3) {
        return;
      }

      suppressedEdges.top.add(pitch);
      suppressedEdges.bottom.add(nextPitch);
    });
  });

  return suppressedEdges;
}

function getCenterSpanNotchSets(spans: ProjectedSpan[]): CenterSpanNotchSets {
  return {
    spanEnds: new Set(spans.map((span) => span.end)),
    spanStarts: new Set(spans.map((span) => span.start)),
  };
}

function getPitchedRenderEvents(
  renderSegmentLayout: RenderSegmentLayout,
  harmonicSlice: RenderSegmentLayout["segment"]["harmonicSlices"][number],
): PitchedRenderEvent[] {
  return renderSegmentLayout.segment.events.filter(
    (event): event is PitchedRenderEvent =>
      event.type === "pitched" &&
      sliceContainsOffset(harmonicSlice, event.offset),
  );
}

function getSliceGeometryContext(
  projectedSegment: RenderSegmentLayout["segment"],
  renderSegmentLayout: RenderSegmentLayout,
  harmonicSlice: RenderSegmentLayout["segment"]["harmonicSlices"][number],
): SliceGeometryContext {
  const sliceBounds = getRenderedHarmonicSliceBounds(
    renderSegmentLayout,
    harmonicSlice,
  );

  return {
    nextJoinGapPx:
      harmonicSlice.touchesSegmentEnd ||
      harmonicSlice.startOffset + harmonicSlice.duration <
        projectedSegment.totalDuration
        ? SEGMENT_GAP_PX
        : 0,
    notchSets: getCenterSpanNotchSets(harmonicSlice.center.spans),
    pitchedEvents: getPitchedRenderEvents(renderSegmentLayout, harmonicSlice),
    prevJoinGapPx:
      harmonicSlice.touchesSegmentStart || harmonicSlice.startOffset > 0
        ? SEGMENT_GAP_PX
        : 0,
    sliceBounds,
  };
}

function getCenterSpanNotchEdges(
  notchSets: CenterSpanNotchSets,
  projectedSpan: ProjectedSpan,
): CenterSpanNotchEdges {
  return {
    bottom: notchSets.spanEnds.has(projectedSpan.start - 1),
    top: notchSets.spanStarts.has(projectedSpan.end + 1),
  };
}

function getSpanNotchGeometry(
  centerX: number,
  noteY: number,
  spanEdgeY: number,
): SpanNotchGeometry {
  const adjacentSpanDirection = Math.sign(noteY - spanEdgeY) || -1;
  const adjacentSpanBaseOffset =
    PITCH_STEP_HEIGHT_PX + SPAN_EVENT_CLEARANCE_PX * 2;
  const adjacentSpanApexOffset =
    PITCH_STEP_HEIGHT_PX -
    SPAN_EVENT_CLEARANCE_PX +
    CENTER_SPAN_NOTCH_HEIGHT_EXTENSION_PX;
  const apexX =
    centerX - adjacentSpanDirection * CENTER_SPAN_NOTCH_APEX_X_OFFSET_PX;
  const baseY = spanEdgeY + adjacentSpanDirection * adjacentSpanBaseOffset;

  return {
    apexX,
    apexY: baseY + adjacentSpanDirection * adjacentSpanApexOffset,
    baseY,
  };
}

function getNotchPath(
  leftX: number,
  rightX: number,
  centerX: number,
  noteY: number,
  spanEdgeY: number,
): string {
  const halfWidth = (rightX - leftX) / 2;
  const controlInset = halfWidth * CENTER_SPAN_NOTCH_CONTROL_X_RATIO;

  return [
    `M ${leftX} ${spanEdgeY}`,
    `C ${leftX + controlInset} ${spanEdgeY} ${centerX - controlInset} ${noteY} ${centerX} ${noteY}`,
    `C ${centerX + controlInset} ${noteY} ${rightX - controlInset} ${spanEdgeY} ${rightX} ${spanEdgeY}`,
    `L ${leftX} ${spanEdgeY}`,
    "Z",
  ].join(" ");
}

function buildRegionGraphics(
  layout: NotationLayout,
  renderSegmentLayout: RenderSegmentLayout,
): RegionGraphic[] {
  const { segment: projectedSegment } = renderSegmentLayout;
  const globalHighlightPitch = projectedSegment.globalHighlightPitch;
  const regionGraphics: RegionGraphic[] = [];

  projectedSegment.harmonicSlices.forEach((harmonicSlice) => {
    const centerColor =
      regionToColor(harmonicSlice.harmonic.center.pitchClasses) ?? "#111111";
    const centerDarkColor = getCenterDarkColor(
      harmonicSlice.harmonic.center.pitchClasses,
    );
    const {
      nextJoinGapPx,
      notchSets,
      pitchedEvents,
      prevJoinGapPx,
      sliceBounds,
    } = getSliceGeometryContext(
      projectedSegment,
      renderSegmentLayout,
      harmonicSlice,
    );

    harmonicSlice.field.spans.forEach((projectedSpan) => {
      regionGraphics.push({
        bounds: sliceBounds,
        nextJoinGapPx,
        paint: getFieldPaint(),
        prevJoinGapPx,
        projectedSpan,
        type: "span",
      });
    });
    harmonicSlice.center.spans.forEach((projectedSpan) => {
      const highlightStrength: HighlightStrength =
        globalHighlightPitch === undefined
          ? "base"
          : spanContainsPitch(projectedSpan, globalHighlightPitch)
            ? "strong"
            : spanContainsPitchClass(
                  projectedSpan,
                  mod(globalHighlightPitch, 12),
                )
              ? "mid"
              : "base";

      regionGraphics.push({
        bounds: sliceBounds,
        nextJoinGapPx,
        paint: getCenterPaint(centerColor, highlightStrength),
        prevJoinGapPx,
        projectedSpan,
        type: "span",
      });
      const notchEdges = getCenterSpanNotchEdges(notchSets, projectedSpan);
      regionGraphics.push(
        ...appendCenterSpanNotches(
          layout.maxPitch,
          sliceBounds,
          renderSegmentLayout,
          projectedSpan,
          notchEdges,
          pitchedEvents,
        ),
      );
    });
    harmonicSlice.projectedGroundingMarks?.marks.forEach((mark) => {
      regionGraphics.push({
        fill: centerDarkColor,
        markType: mark.type,
        pitch: mark.pitch,
        sliceX: sliceBounds.x,
        type: "ground",
      });
    });
  });

  return regionGraphics;
}

function positionRegionGraphic(
  layout: NotationLayout,
  regionGraphic: RegionGraphic,
): PositionedRegionGraphic | undefined {
  switch (regionGraphic.type) {
    case "span": {
      const pathData = getProjectedSpanPath(
        layout.maxPitch,
        regionGraphic.nextJoinGapPx,
        regionGraphic.prevJoinGapPx,
        regionGraphic.bounds,
        regionGraphic.projectedSpan,
      );

      if (pathData === undefined) {
        return undefined;
      }

      return {
        paint: regionGraphic.paint,
        pathData,
        type: "span",
      };
    }
    case "notch": {
      const leftX = Math.max(
        regionGraphic.centerX - CENTER_SPAN_NOTCH_HALF_WIDTH_PX,
        regionGraphic.clipX,
      );
      const rightX = Math.min(
        regionGraphic.centerX + CENTER_SPAN_NOTCH_HALF_WIDTH_PX,
        regionGraphic.clipX + regionGraphic.clipWidth,
      );

      if (rightX <= leftX) {
        return undefined;
      }

      const notchGeometry = getSpanNotchGeometry(
        regionGraphic.centerX,
        regionGraphic.noteY,
        regionGraphic.spanEdgeY,
      );

      return {
        pathData: getNotchPath(
          leftX,
          rightX,
          notchGeometry.apexX,
          notchGeometry.apexY,
          notchGeometry.baseY,
        ),
        type: "notch",
      };
    }
    case "ground": {
      const y = getYForPitch(layout.maxPitch, regionGraphic.pitch);
      const width =
        regionGraphic.markType === "ground"
          ? GROUNDING_MARK_WIDTH_PX / 2
          : GROUNDING_MARK_WIDTH_PX;

      return {
        fill: regionGraphic.fill,
        height: GROUNDING_MARK_HEIGHT_PX,
        type: "ground",
        width,
        x: regionGraphic.sliceX - SEGMENT_GAP_PX / 2,
        y: y - GROUNDING_MARK_HEIGHT_PX / 2,
      };
    }
  }
}

function appendPositionedRegionGraphic(
  group: SVGGElement,
  positionedGraphic: PositionedRegionGraphic,
): void {
  switch (positionedGraphic.type) {
    case "span":
      appendProjectedSpan(group, positionedGraphic);
      return;
    case "notch": {
      const notchPath = createSvgElement("path");
      setAttributes(notchPath, {
        d: positionedGraphic.pathData,
        fill: "#ffffff",
        opacity: 1,
      });
      group.append(notchPath);
      return;
    }
    case "ground":
      appendGroundMark(group, positionedGraphic);
  }
}

function buildPositionedRegionGraphics(
  layout: NotationLayout,
  renderSegmentLayout: RenderSegmentLayout,
): PositionedRegionGraphic[] {
  const positionedGraphics = buildPositionedGraphics(
    buildRegionGraphics(layout, renderSegmentLayout),
    (regionGraphic) => positionRegionGraphic(layout, regionGraphic),
  );

  return [
    ...positionedGraphics.filter((graphic) => graphic.type !== "notch"),
    ...positionedGraphics.filter((graphic) => graphic.type === "notch"),
  ];
}

export function appendProjectedSegmentRegions(
  group: SVGGElement,
  layout: NotationLayout,
  renderSegmentLayout: RenderSegmentLayout,
): void {
  appendPositionedGraphics(
    buildPositionedRegionGraphics(layout, renderSegmentLayout),
    (positionedGraphic) => {
      appendPositionedRegionGraphic(group, positionedGraphic);
    },
  );
}
