import {
  type Projection,
  type ProjectionEvent,
  type ProjectionSegment,
  type ProjectedSpan,
  type Span,
} from "./projection";
import { regionToColor, regionToWheel24, wheel24ToDarkColor } from "./color";
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
const NOTE_RADIUS = 4;
const MIN_EVENT_WIDTH = 12;
const REST_WIDTH = 14;
const REST_HEIGHT = 2;
const GROUNDING_MARK_HEIGHT = 3;
const GROUNDING_MARK_WIDTH = 10;
const SPAN_CLEARANCE = 0.5;
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

function getCenterDarkColor(projectedSegment: ProjectionSegment): string {
  const wheelIndex = regionToWheel24(
    projectedSegment.harmonic.center.pitchClasses,
  );

  return wheelIndex === undefined ? "#111111" : wheel24ToDarkColor(wheelIndex);
}

function getSeamX(segmentIndex: number, segmentCount: number): number {
  if (segmentIndex < 0) {
    return getXForSegment(0) - SEGMENT_GAP / 2;
  }

  if (segmentIndex >= segmentCount - 1) {
    return getXForSegment(segmentCount - 1) + SEGMENT_WIDTH + SEGMENT_GAP / 2;
  }

  return getXForSegment(segmentIndex) + SEGMENT_WIDTH + SEGMENT_GAP / 2;
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

function appendGroundMark(
  group: SVGGElement,
  fill: string,
  maxPitch: number,
  segmentX: number,
  pitch: number,
): void {
  const rect = createSvgElement("rect");
  const y = getYForPitch(maxPitch, pitch);
  const x = segmentX - SEGMENT_GAP / 2;

  setAttributes(rect, {
    fill,
    height: GROUNDING_MARK_HEIGHT,
    width: GROUNDING_MARK_WIDTH,
    x,
    y: y - GROUNDING_MARK_HEIGHT / 2,
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
  const joinExtension = SEGMENT_GAP / 2;
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
  const leftX =
    segmentX - (projectedSpan.prev === undefined ? joinExtension : 0);
  const rightX =
    segmentX +
    SEGMENT_WIDTH +
    (projectedSpan.next === undefined ? joinExtension : 0);

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
    fill: "#111111",
    r: NOTE_RADIUS,
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

function appendSegmentForeground(
  group: SVGGElement,
  layout: ScoreLayout,
  projectedSegment: ProjectionSegment,
): void {
  const segmentX = getXForSegment(projectedSegment.index);
  const label = createSvgElement("text");

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

function appendSegmentRegions(
  group: SVGGElement,
  layout: ScoreLayout,
  projectedSegment: ProjectionSegment,
): void {
  const segmentX = getXForSegment(projectedSegment.index);
  const centerColor =
    regionToColor(projectedSegment.harmonic.center.pitchClasses) ?? "#111111";
  const centerDarkColor = getCenterDarkColor(projectedSegment);
  const fieldPaint = getFieldPaint();
  const centerPaint = getCenterPaint(centerColor);

  projectedSegment.placement.field.spans.forEach((span) => {
    appendProjectedSpan(group, layout.maxPitch, segmentX, span, fieldPaint);
  });
  projectedSegment.placement.center.spans.forEach((span) => {
    appendProjectedSpan(group, layout.maxPitch, segmentX, span, centerPaint);
  });
  projectedSegment.placement.groundingOverlay?.marks.forEach((mark) => {
    appendGroundMark(
      group,
      centerDarkColor,
      layout.maxPitch,
      segmentX,
      mark.pitch,
    );
  });
}

function appendSegmentBoundarySeam(
  group: SVGGElement,
  layout: ScoreLayout,
  segmentIndex: number,
  segmentCount: number,
): void {
  const rect = createSvgElement("rect");
  const seamX = getSeamX(segmentIndex, segmentCount);

  setAttributes(rect, {
    fill: "#ffffff",
    height: layout.height,
    width: SEGMENT_SEAM,
    x: seamX - SEGMENT_SEAM / 2,
    y: 0,
  });

  group.append(rect);
}

function appendAllSegmentSeams(
  group: SVGGElement,
  layout: ScoreLayout,
  segmentCount: number,
): void {
  appendSegmentBoundarySeam(group, layout, -1, segmentCount);

  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
    appendSegmentBoundarySeam(group, layout, segmentIndex, segmentCount);
  }
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
  const regionGroup = createSvgElement("g");
  const seamGroup = createSvgElement("g");
  const foregroundGroup = createSvgElement("g");
  const layout = getScoreLayout(projection);

  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("width", String(layout.width));
  svg.setAttribute("height", String(layout.height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Simple harmonic score");

  projection.segments.forEach((projectedSegment) => {
    const group = createSvgElement("g");
    appendSegmentRegions(group, layout, projectedSegment);
    regionGroup.append(group);
  });

  appendAllSegmentSeams(seamGroup, layout, projection.segments.length);

  projection.segments.forEach((projectedSegment) => {
    const group = createSvgElement("g");
    appendSegmentForeground(group, layout, projectedSegment);
    foregroundGroup.append(group);
  });

  svg.append(regionGroup, seamGroup, foregroundGroup);

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
