import {
  type Projection,
  type ProjectionEvent,
  type ProjectionSegment,
  type GroundingMark,
  type ProjectedRegion,
  type ProjectedSpan,
  type Span,
} from "./projection";
import {
  pitchClassToColor,
  pitchClassToDarkColor,
  regionToColor,
} from "./color";
import { toPitchClass } from "./pitch";

const SVG_NS = "http://www.w3.org/2000/svg";

// Layout scale:
// - ROW_HEIGHT is the vertical semitone spacing
// - NOTE_RADIUS sets note size
// - SPAN_TUCK / SEGMENT_SEAM / JOIN_CONTROL_X_RATIO tune region readability
const JOIN_CONTROL_X_RATIO = 0.65;
const HORIZONTAL_PADDING = 28;
const SEGMENT_SEAM = 1;
const SEGMENT_GAP = 20;
const SEGMENT_WIDTH = 120;
const VERTICAL_PADDING = 100;
const ROW_HEIGHT = 3;
const NOTE_RADIUS = 3.5;
const MIN_EVENT_WIDTH = 12;
const REST_WIDTH = 14;
const REST_HEIGHT = 2;
const SPAN_CLEARANCE = 1;
const SPAN_TUCK = Math.max(0, NOTE_RADIUS - ROW_HEIGHT) + SPAN_CLEARANCE;

type ScoreLayout = {
  height: number;
  maxPitch: number;
  minPitch: number;
  width: number;
};

type SpanRect = {
  bottom: number;
  height: number;
  top: number;
};

type Point = {
  x: number;
  y: number;
};

type PaintLayer = {
  fill: string;
  opacity: number;
};

type RegionPaint = {
  layers: PaintLayer[];
};

type CubicCurve = [Point, Point, Point, Point];

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tagName: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tagName);
}

function setAttributes(
  element: Element,
  attributes: Record<string, number | string>,
): void {
  Object.entries(attributes).forEach(([name, value]) => {
    element.setAttribute(name, String(value));
  });
}

function getYForPitch(maxPitch: number, pitch: number): number {
  return VERTICAL_PADDING + (maxPitch - pitch) * ROW_HEIGHT;
}

function getXForSegment(index: number): number {
  return HORIZONTAL_PADDING + index * (SEGMENT_WIDTH + SEGMENT_GAP);
}

function getSpanRect(maxPitch: number, span: Span): SpanRect {
  const top = getYForPitch(maxPitch, span.end) + SPAN_TUCK;
  const bottom = getYForPitch(maxPitch, span.start) - SPAN_TUCK;
  const height = bottom - top;

  return {
    bottom,
    height,
    top,
  };
}

function isDrawableSpanRect(rect: SpanRect): boolean {
  return rect.height > 0;
}

function appendGroundingMark(
  group: SVGGElement,
  maxPitch: number,
  segmentX: number,
  groundingMark: GroundingMark,
): void {
  const rect = createSvgElement("rect");
  const y = getYForPitch(maxPitch, groundingMark.pitch);
  const height = 6;
  const width = 10;
  const x = segmentX + 4;

  setAttributes(rect, {
    fill: pitchClassToDarkColor(toPitchClass(groundingMark.pitch)),
    height,
    stroke: "#111111",
    "stroke-width": 1,
    width,
    x,
    y: y - height / 2,
  });

  group.append(rect);
}

function appendRest(
  group: SVGGElement,
  centerX: number,
  width: number,
  maxPitch: number,
  pitch: number,
): void {
  const rect = createSvgElement("rect");
  const y = getYForPitch(maxPitch, pitch) - REST_HEIGHT / 2;
  const rectWidth = Math.max(REST_WIDTH, width);

  setAttributes(rect, {
    fill: "#666666",
    height: REST_HEIGHT,
    width: rectWidth,
    x: centerX - rectWidth / 2,
    y,
  });

  group.append(rect);
}

function appendProjectedSpan(
  group: SVGGElement,
  maxPitch: number,
  segmentX: number,
  projectedSpan: ProjectedSpan,
  paint: RegionPaint,
): void {
  const d = getProjectedSpanPath(maxPitch, segmentX, projectedSpan);

  if (d === undefined) {
    return;
  }

  paint.layers.forEach((attributes) => {
    const path = createSvgElement("path");
    setAttributes(path, {
      ...attributes,
      d,
    });
    group.append(path);
  });
}

function getProjectedSpanPath(
  maxPitch: number,
  segmentX: number,
  projectedSpan: ProjectedSpan,
): string | undefined {
  const currentRect = getSpanRect(maxPitch, projectedSpan);

  if (!isDrawableSpanRect(currentRect)) {
    return undefined;
  }

  const prevHalf =
    projectedSpan.prev === undefined
      ? undefined
      : getJoinHalf(
          maxPitch,
          segmentX,
          projectedSpan,
          projectedSpan.prev,
          "prev",
        );
  const nextHalf =
    projectedSpan.next === undefined
      ? undefined
      : getJoinHalf(
          maxPitch,
          segmentX,
          projectedSpan,
          projectedSpan.next,
          "next",
        );
  const rightX = segmentX + SEGMENT_WIDTH;

  return [
    prevHalf === undefined
      ? `M ${segmentX} ${currentRect.top}`
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
    `L ${segmentX} ${currentRect.bottom}`,
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
  segmentX: number,
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
    segmentX,
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
  segmentX: number,
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
    direction === "next" ? segmentX + SEGMENT_WIDTH : segmentX;
  const joinedEdgeX =
    currentEdgeX + (direction === "next" ? SEGMENT_GAP : -SEGMENT_GAP);
  const leftX = Math.min(currentEdgeX, joinedEdgeX);
  const rightX = Math.max(currentEdgeX, joinedEdgeX);
  const leftRect = currentEdgeX <= joinedEdgeX ? currentRect : joinedRect;
  const rightRect = currentEdgeX <= joinedEdgeX ? joinedRect : currentRect;
  const joinControlX = SEGMENT_GAP * JOIN_CONTROL_X_RATIO;
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
    layers: [{ fill: "#cccccc", opacity: 0.3 }],
  };
}

function getCenterPaint(color: string): RegionPaint {
  return {
    layers: [
      { fill: "#ffffff", opacity: 1 },
      { fill: color, opacity: 0.5 },
    ],
  };
}

function appendNote(
  group: SVGGElement,
  centerX: number,
  maxPitch: number,
  pitch: number,
): void {
  const circle = createSvgElement("circle");
  const y = getYForPitch(maxPitch, pitch);

  setAttributes(circle, {
    cx: centerX,
    cy: y,
    fill: pitchClassToColor(toPitchClass(pitch)),
    r: NOTE_RADIUS,
    stroke: "#111111",
    "stroke-width": 1,
  });

  group.append(circle);
}

function appendEventMark(
  group: SVGGElement,
  maxPitch: number,
  segmentX: number,
  projectedSegment: ProjectionSegment,
  projectedEvent: ProjectionEvent,
): void {
  const startX =
    segmentX +
    (projectedEvent.offset / projectedSegment.totalDuration) * SEGMENT_WIDTH;
  const endX =
    segmentX +
    ((projectedEvent.offset + projectedEvent.duration) /
      projectedSegment.totalDuration) *
      SEGMENT_WIDTH;
  const centerX = (startX + endX) / 2;
  const width = Math.max(endX - startX, MIN_EVENT_WIDTH);

  switch (projectedEvent.type) {
    case "pitched":
      projectedEvent.pitches.forEach((pitch) => {
        appendNote(group, centerX, maxPitch, pitch);
      });
      return;
    case "rest":
      appendRest(group, centerX, width, maxPitch, projectedEvent.pitch);
  }
}

function appendSegment(
  group: SVGGElement,
  layout: ScoreLayout,
  projectedSegment: ProjectionSegment,
): void {
  const segmentX = getXForSegment(projectedSegment.index);
  const centerColor =
    regionToColor(projectedSegment.harmonic.center.pitchClasses) ?? "#111111";
  const fieldPaint = getFieldPaint();
  const centerPaint = getCenterPaint(centerColor);
  const label = createSvgElement("text");

  appendRegion(projectedSegment.placement.field, {
    appendSpan: (span) =>
      appendProjectedSpan(group, layout.maxPitch, segmentX, span, fieldPaint),
  });
  appendRegion(projectedSegment.placement.center, {
    appendSpan: (span) =>
      appendProjectedSpan(group, layout.maxPitch, segmentX, span, centerPaint),
  });

  projectedSegment.placement.groundingMarks.forEach((groundingMark) => {
    appendGroundingMark(group, layout.maxPitch, segmentX, groundingMark);
  });

  projectedSegment.events.forEach((projectedEvent) => {
    appendEventMark(
      group,
      layout.maxPitch,
      segmentX,
      projectedSegment,
      projectedEvent,
    );
  });

  setAttributes(label, {
    fill: "#111111",
    "font-size": 12,
    x: segmentX,
    y: VERTICAL_PADDING - 10,
  });
  label.textContent = String(projectedSegment.index + 1);

  group.append(label);
}

function appendRegion(
  projectedRegion: ProjectedRegion,
  handlers: {
    appendSpan: (span: ProjectedSpan) => void;
  },
): void {
  projectedRegion.spans.forEach((projectedSpan) => {
    handlers.appendSpan(projectedSpan);
  });
}

function appendSegmentBoundarySeam(
  group: SVGGElement,
  layout: ScoreLayout,
  segmentIndex: number,
  segmentCount: number,
): void {
  if (segmentIndex >= segmentCount - 1) {
    return;
  }

  const rect = createSvgElement("rect");
  const seamX = getXForSegment(segmentIndex) + SEGMENT_WIDTH + SEGMENT_GAP / 2;

  setAttributes(rect, {
    fill: "#ffffff",
    height: layout.height,
    width: SEGMENT_SEAM,
    x: seamX - SEGMENT_SEAM / 2,
    y: 0,
  });

  group.append(rect);
}

function getScoreLayout(projection: Projection): ScoreLayout {
  return {
    height:
      VERTICAL_PADDING * 2 +
      (projection.maxPitch - projection.minPitch) * ROW_HEIGHT,
    maxPitch: projection.maxPitch,
    minPitch: projection.minPitch,
    width:
      HORIZONTAL_PADDING * 2 +
      projection.segments.length * SEGMENT_WIDTH +
      Math.max(projection.segments.length - 1, 0) * SEGMENT_GAP,
  };
}

function createScoreSvg(projection: Projection): SVGSVGElement {
  const svg = createSvgElement("svg");
  const seamGroup = createSvgElement("g");
  const layout = getScoreLayout(projection);

  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("width", String(layout.width));
  svg.setAttribute("height", String(layout.height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Simple harmonic score");

  projection.segments.forEach((projectedSegment) => {
    const group = createSvgElement("g");
    appendSegment(group, layout, projectedSegment);
    svg.append(group);
  });

  projection.segments.forEach((projectedSegment) => {
    appendSegmentBoundarySeam(
      seamGroup,
      layout,
      projectedSegment.index,
      projection.segments.length,
    );
  });

  svg.append(seamGroup);

  return svg;
}

export function renderApp(projection: Projection): HTMLElement {
  const app = document.createElement("main");
  const heading = document.createElement("h1");
  const score = document.createElement("div");

  app.className = "app";
  heading.textContent = "Notation";
  score.className = "score";
  score.append(createScoreSvg(projection));

  app.append(heading, score);
  return app;
}
