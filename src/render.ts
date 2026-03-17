import {
  type Projection,
  type ProjectionEvent,
  type ProjectionSegment,
  type GroundingMark,
  type RegionSpan,
} from "./projection";
import {
  pitchClassToColor,
  pitchClassToDarkColor,
  regionToColor,
} from "./color";
import { toPitchClass } from "./pitch";

const SVG_NS = "http://www.w3.org/2000/svg";
const PADDING = 28;
const SEGMENT_GAP = 16;
const SEGMENT_WIDTH = 120;
const ROW_HEIGHT = 14;
const NOTE_RADIUS = 4;
const MIN_EVENT_WIDTH = 12;
const REST_WIDTH = 14;
const REST_HEIGHT = 2;

type ScoreLayout = {
  height: number;
  maxPitch: number;
  width: number;
};

type SpanRect = {
  height: number;
  y: number;
};

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
  return PADDING + (maxPitch - pitch) * ROW_HEIGHT;
}

function getXForSegment(index: number): number {
  return PADDING + index * (SEGMENT_WIDTH + SEGMENT_GAP);
}

function getSpanRect(maxPitch: number, span: RegionSpan): SpanRect | undefined {
  const top = getYForPitch(maxPitch, span.end);
  const bottom = getYForPitch(maxPitch, span.start);
  const height = bottom - top;

  if (height <= 0) {
    return undefined;
  }

  return {
    height,
    y: top,
  };
}

function appendFieldBlock(
  group: SVGGElement,
  maxPitch: number,
  segmentX: number,
  fieldSpan: RegionSpan,
): void {
  const rect = getSpanRect(maxPitch, fieldSpan);

  if (rect === undefined) {
    return;
  }

  appendSpanBlock(group, {
    fill: "#cccccc",
    height: rect.height,
    opacity: 0.5,
    width: SEGMENT_WIDTH,
    x: segmentX,
    y: rect.y,
  });
}

function appendCenterBlock(
  group: SVGGElement,
  maxPitch: number,
  segmentX: number,
  centerSpan: RegionSpan,
  color: string,
): void {
  const rect = getSpanRect(maxPitch, centerSpan);

  if (rect === undefined) {
    return;
  }

  appendSpanBlock(group, {
    fill: "#ffffff",
    height: rect.height,
    opacity: 1,
    width: SEGMENT_WIDTH,
    x: segmentX,
    y: rect.y,
  });

  appendSpanBlock(group, {
    fill: color,
    height: rect.height,
    opacity: 0.5,
    width: SEGMENT_WIDTH,
    x: segmentX,
    y: rect.y,
  });
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

function appendSpanBlock(
  group: SVGGElement,
  attributes: Record<string, number | string>,
): void {
  const rect = createSvgElement("rect");
  setAttributes(rect, attributes);
  group.append(rect);
}

function appendNote(
  group: SVGGElement,
  centerX: number,
  width: number,
  maxPitch: number,
  pitch: number,
): void {
  const circle = createSvgElement("circle");
  const durationLine = createSvgElement("line");
  const halfWidth = Math.max(width, MIN_EVENT_WIDTH) / 2;
  const y = getYForPitch(maxPitch, pitch);

  setAttributes(circle, {
    cx: centerX,
    cy: y,
    fill: pitchClassToColor(toPitchClass(pitch)),
    r: NOTE_RADIUS,
    stroke: "#111111",
    "stroke-width": 1,
  });

  setAttributes(durationLine, {
    stroke: "#111111",
    "stroke-width": 1,
    x1: centerX - halfWidth,
    x2: centerX + halfWidth,
    y1: y,
    y2: y,
  });

  group.append(durationLine, circle);
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
        appendNote(group, centerX, width, maxPitch, pitch);
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
  const label = createSvgElement("text");

  projectedSegment.placement.fieldSpans.forEach((fieldSpan) => {
    appendFieldBlock(group, layout.maxPitch, segmentX, fieldSpan);
  });

  projectedSegment.placement.centerSpans.forEach((centerSpan) => {
    appendCenterBlock(
      group,
      layout.maxPitch,
      segmentX,
      centerSpan,
      centerColor,
    );
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
    y: PADDING - 10,
  });
  label.textContent = String(projectedSegment.index + 1);

  group.append(label);
}

function getScoreLayout(projection: Projection): ScoreLayout {
  return {
    height:
      PADDING * 2 + (projection.maxPitch - projection.minPitch) * ROW_HEIGHT,
    maxPitch: projection.maxPitch,
    width:
      PADDING * 2 +
      projection.segments.length * SEGMENT_WIDTH +
      Math.max(projection.segments.length - 1, 0) * SEGMENT_GAP,
  };
}

function createScoreSvg(projection: Projection): SVGSVGElement {
  const svg = createSvgElement("svg");
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
