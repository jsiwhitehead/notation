import { getRegionPitchClasses } from "../harmony/region";
import { sliceContainsOffset } from "../projection";
import { getPitchedEventNoteCenterX } from "./events";
import type {
  JoinInsetDirection,
  ProjectedSpan,
  Span,
} from "../projection/spans";
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
  CENTER_SPAN_NOTCH_BASE_OUTSET_PX,
  CENTER_SPAN_NOTCH_CONTROL_X_RATIO,
  CENTER_SPAN_NOTCH_HEIGHT_EXTENSION_PX,
  CENTER_SPAN_NOTCH_HALF_WIDTH_PX,
  GROUNDING_MARK_HEIGHT_PX,
  GROUNDING_MARK_WIDTH_PX,
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
  sliceBounds: HorizontalBounds;
};

function getCenterDarkColor(centerPitchClasses: number[]): string {
  const wheelIndex = regionToWheel24(centerPitchClasses);

  return wheelIndex === undefined ? "#111111" : wheel24ToDarkColor(wheelIndex);
}

function getSpanPitchClasses(span: Span): PitchClass[] {
  const pitchClasses: PitchClass[] = [];

  for (let pitch = span.start; pitch <= span.end; pitch += 2) {
    pitchClasses.push(mod(pitch, 12));
  }

  return pitchClasses;
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
  bounds: HorizontalBounds,
  projectedSpan: ProjectedSpan,
): string | undefined {
  const currentRect = getSpanRect(maxPitch, projectedSpan);

  if (!isDrawableSpanRect(currentRect)) {
    return undefined;
  }

  const leftX = bounds.x;
  const rightX = bounds.x + bounds.width;
  const pathSegments = [[
    `M ${leftX} ${currentRect.top}`,
    `L ${rightX} ${currentRect.top}`,
    `L ${rightX} ${currentRect.bottom}`,
    `L ${leftX} ${currentRect.bottom}`,
    "Z",
  ].join(" ")];

  projectedSpan.join?.forEach((join) => {
    if (nextJoinGapPx <= 0) {
      return;
    }

    if (join.start === join.end) {
      const leftCenterY = getSpanJoinEdgeCenterY(
        maxPitch,
        projectedSpan,
        join.start,
      );
      const rightCenterY = getJoinTargetCenterY(
        join.targetInsetDirection,
        maxPitch,
        join.start,
      );
      const halfHeight = SINGLE_PITCH_SPAN_HEIGHT_PX / 2;

      pathSegments.push(
        [
          `M ${rightX} ${leftCenterY - halfHeight}`,
          `L ${rightX + nextJoinGapPx} ${rightCenterY - halfHeight}`,
          `L ${rightX + nextJoinGapPx} ${rightCenterY + halfHeight}`,
          `L ${rightX} ${leftCenterY + halfHeight}`,
          "Z",
        ].join(" "),
      );
      return;
    }

    const joinRect = getSpanRect(maxPitch, join);

    if (!isDrawableSpanRect(joinRect)) {
      return;
    }

    pathSegments.push(
      [
        `M ${rightX} ${joinRect.top}`,
        `L ${rightX + nextJoinGapPx} ${joinRect.top}`,
        `L ${rightX + nextJoinGapPx} ${joinRect.bottom}`,
        `L ${rightX} ${joinRect.bottom}`,
        "Z",
      ].join(" "),
    );
  });

  return pathSegments.join(" ");
}

function getSpanJoinEdgeCenterY(
  maxPitch: number,
  span: Span,
  pitch: number,
): number {
  const halfHeight = SINGLE_PITCH_SPAN_HEIGHT_PX / 2;

  if (span.start === span.end) {
    return getYForPitch(maxPitch, pitch);
  }

  if (pitch === span.start) {
    return getYForPitch(maxPitch, span.start) - SPAN_EVENT_CLEARANCE_PX - halfHeight;
  }

  if (pitch === span.end) {
    return getYForPitch(maxPitch, span.end) + SPAN_EVENT_CLEARANCE_PX + halfHeight;
  }

  return getYForPitch(maxPitch, pitch);
}

function getJoinTargetCenterY(
  targetInsetDirection: JoinInsetDirection,
  maxPitch: number,
  pitch: number,
): number {
  const halfHeight = SINGLE_PITCH_SPAN_HEIGHT_PX / 2;
  const centerY = getYForPitch(maxPitch, pitch);

  if (targetInsetDirection === "up") {
    return centerY + SPAN_EVENT_CLEARANCE_PX + halfHeight;
  }

  if (targetInsetDirection === "down") {
    return centerY - SPAN_EVENT_CLEARANCE_PX - halfHeight;
  }

  return centerY;
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

function getCenterSpanHighlightStrength(
  projectedSpan: ProjectedSpan,
  globalHighlightPitch: number | undefined,
): HighlightStrength {
  if (globalHighlightPitch === undefined) {
    return "base";
  }

  if (spanContainsPitch(projectedSpan, globalHighlightPitch)) {
    return "strong";
  }

  return spanContainsPitchClass(projectedSpan, mod(globalHighlightPitch, 12))
    ? "mid"
    : "base";
}

function getResolvedCenterSpanColor(
  centerColor: string | undefined,
  projectedSpan: ProjectedSpan,
): string {
  return centerColor ?? regionToColor(getSpanPitchClasses(projectedSpan)) ?? "#111111";
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

  if (!isDrawableSpanRect(spanRect)) {
    return notchGraphics;
  }

  pitchedEvents.forEach((event) => {
    const eventCenterX = getRenderedEventCenterX(renderSegmentLayout, event);

    event.pitches.forEach((pitch) => {
      const centerX = getPitchedEventNoteCenterX(
        eventCenterX,
        event.duration,
        event.layer,
        event.pitchOwnerships,
        pitch,
      );

      if (
        pitch === projectedSpan.end &&
        notchEdges.top
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
        notchEdges.bottom
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
  _projectedSegment: RenderSegmentLayout["segment"],
  renderSegmentLayout: RenderSegmentLayout,
  harmonicSlice: RenderSegmentLayout["segment"]["harmonicSlices"][number],
): SliceGeometryContext {
  const sliceBounds = getRenderedHarmonicSliceBounds(
    renderSegmentLayout,
    harmonicSlice,
  );

  return {
    nextJoinGapPx: SEGMENT_GAP_PX,
    notchSets: getCenterSpanNotchSets(harmonicSlice.center.spans),
    pitchedEvents: getPitchedRenderEvents(renderSegmentLayout, harmonicSlice),
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
    CENTER_SPAN_NOTCH_HEIGHT_EXTENSION_PX +
    CENTER_SPAN_NOTCH_BASE_OUTSET_PX;
  const apexX =
    centerX - adjacentSpanDirection * CENTER_SPAN_NOTCH_APEX_X_OFFSET_PX;
  const baseY =
    spanEdgeY +
    adjacentSpanDirection *
      (adjacentSpanBaseOffset - CENTER_SPAN_NOTCH_BASE_OUTSET_PX);

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
    const centerPitchClasses = getRegionPitchClasses(harmonicSlice.harmonic.center);
    const centerColor = regionToColor(centerPitchClasses);
    const centerDarkColor = getCenterDarkColor(centerPitchClasses);
    const {
      nextJoinGapPx,
      notchSets,
      pitchedEvents,
      sliceBounds,
    } = getSliceGeometryContext(
      projectedSegment,
      renderSegmentLayout,
      harmonicSlice,
    );

    regionGraphics.push(
      ...buildFieldSpanRegionGraphics(sliceBounds, nextJoinGapPx, harmonicSlice.field.spans),
      ...buildCenterSpanRegionGraphics(
        layout.maxPitch,
        sliceBounds,
        renderSegmentLayout,
        nextJoinGapPx,
        harmonicSlice.center.spans,
        centerColor,
        globalHighlightPitch,
        notchSets,
        pitchedEvents,
      ),
    );
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

function buildFieldSpanRegionGraphics(
  sliceBounds: HorizontalBounds,
  nextJoinGapPx: number,
  projectedSpans: ProjectedSpan[],
): RegionGraphic[] {
  return projectedSpans.map((projectedSpan) => ({
    bounds: sliceBounds,
    nextJoinGapPx,
    paint: getFieldPaint(),
    projectedSpan,
    type: "span" as const,
  }));
}

function buildCenterSpanRegionGraphics(
  maxPitch: number,
  sliceBounds: HorizontalBounds,
  renderSegmentLayout: RenderSegmentLayout,
  nextJoinGapPx: number,
  projectedSpans: ProjectedSpan[],
  centerColor: string | undefined,
  globalHighlightPitch: number | undefined,
  notchSets: CenterSpanNotchSets,
  pitchedEvents: PitchedRenderEvent[],
): RegionGraphic[] {
  const regionGraphics: RegionGraphic[] = [];

  projectedSpans.forEach((projectedSpan) => {
    regionGraphics.push({
      bounds: sliceBounds,
      nextJoinGapPx,
      paint: getCenterPaint(
        getResolvedCenterSpanColor(centerColor, projectedSpan),
        getCenterSpanHighlightStrength(projectedSpan, globalHighlightPitch),
      ),
      projectedSpan,
      type: "span",
    });

    regionGraphics.push(
      ...appendCenterSpanNotches(
        maxPitch,
        sliceBounds,
        renderSegmentLayout,
        projectedSpan,
        getCenterSpanNotchEdges(notchSets, projectedSpan),
        pitchedEvents,
      ),
    );
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
        x: regionGraphic.sliceX,
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
    ...positionedGraphics.filter((graphic) => graphic.type === "span"),
    ...positionedGraphics.filter((graphic) => graphic.type === "notch"),
    ...positionedGraphics.filter((graphic) => graphic.type === "ground"),
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
