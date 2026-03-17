import {
  buildFieldSpans,
  buildGroundingMarks,
  type FieldSpan,
  type GroundingMark,
  type ProjectionEvent,
  type ProjectionSegment,
  type Projection,
  repeatPitchClassesAcrossRange,
  repeatFieldSpansAcrossRange,
} from "./projection";

const SVG_NS = "http://www.w3.org/2000/svg";
const PADDING = 24;
const SEGMENT_GAP = 16;
const SEGMENT_WIDTH = 120;
const ROW_HEIGHT = 14;
const NOTE_RADIUS = 4;
const MIN_EVENT_WIDTH = 12;
const REST_WIDTH = 14;
const REST_HEIGHT = 2;

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

function appendGrid(
  svg: SVGSVGElement,
  maxPitch: number,
  minPitch: number,
  width: number,
): void {
  for (let pitch = minPitch; pitch <= maxPitch; pitch += 1) {
    const line = createSvgElement("line");
    const y = getYForPitch(maxPitch, pitch);

    setAttributes(line, {
      stroke: "#d7d7d7",
      "stroke-width": 1,
      x1: PADDING,
      x2: width - PADDING,
      y1: y,
      y2: y,
    });

    svg.append(line);
  }
}

function appendFieldBlock(
  group: SVGGElement,
  maxPitch: number,
  segmentX: number,
  fieldSpan: FieldSpan,
): void {
  const rect = createSvgElement("rect");
  const top = getYForPitch(maxPitch, fieldSpan.end) - ROW_HEIGHT / 2;
  const bottom = getYForPitch(maxPitch, fieldSpan.start) + ROW_HEIGHT / 2;

  setAttributes(rect, {
    fill: "#e8e8e8",
    height: bottom - top,
    stroke: "#c4c4c4",
    "stroke-width": 1,
    width: SEGMENT_WIDTH,
    x: segmentX,
    y: top,
  });

  group.append(rect);
}

function appendCenterMark(
  group: SVGGElement,
  maxPitch: number,
  segmentX: number,
  pitch: number,
): void {
  const line = createSvgElement("line");
  const y = getYForPitch(maxPitch, pitch);

  setAttributes(line, {
    stroke: "#111111",
    "stroke-width": 2,
    x1: segmentX + 10,
    x2: segmentX + SEGMENT_WIDTH - 10,
    y1: y,
    y2: y,
  });

  group.append(line);
}

function appendGroundingMark(
  group: SVGGElement,
  maxPitch: number,
  segmentX: number,
  groundingMark: GroundingMark,
): void {
  const line = createSvgElement("line");
  const y = getYForPitch(maxPitch, groundingMark.pitch);
  const x1 = groundingMark.type === "root" ? segmentX + 2 : segmentX + 6;
  const x2 = groundingMark.type === "root" ? segmentX + 14 : segmentX + 12;

  setAttributes(line, {
    stroke: groundingMark.type === "root" ? "#111111" : "#555555",
    "stroke-width": groundingMark.type === "root" ? 3 : 2,
    x1,
    x2,
    y1: y,
    y2: y,
  });

  group.append(line);
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

  setAttributes(circle, {
    cx: centerX,
    cy: getYForPitch(maxPitch, pitch),
    fill: "#111111",
    r: NOTE_RADIUS,
  });

  setAttributes(durationLine, {
    stroke: "#111111",
    "stroke-width": 1,
    x1: centerX - halfWidth,
    x2: centerX + halfWidth,
    y1: getYForPitch(maxPitch, pitch),
    y2: getYForPitch(maxPitch, pitch),
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
  projection: Projection,
  projectedSegment: ProjectionSegment,
): void {
  const { maxPitch, minPitch } = projection;
  const segmentX = getXForSegment(projectedSegment.index);
  const boundary = createSvgElement("rect");
  const label = createSvgElement("text");

  setAttributes(boundary, {
    fill: "none",
    height: (maxPitch - minPitch + 1) * ROW_HEIGHT,
    stroke: "#b5b5b5",
    "stroke-width": 1,
    width: SEGMENT_WIDTH,
    x: segmentX,
    y: PADDING - ROW_HEIGHT / 2,
  });

  group.append(boundary);

  buildFieldSpans(projectedSegment.field)
    .flatMap((fieldSpan) =>
      repeatFieldSpansAcrossRange(maxPitch, minPitch, fieldSpan),
    )
    .forEach((fieldSpan) => {
      appendFieldBlock(group, maxPitch, segmentX, fieldSpan);
    });

  repeatPitchClassesAcrossRange(
    maxPitch,
    minPitch,
    projectedSegment.center.pitchClasses,
  ).forEach((pitch) => {
    appendCenterMark(group, maxPitch, segmentX, pitch);
  });

  buildGroundingMarks(projection, projectedSegment).forEach((groundingMark) => {
    appendGroundingMark(group, maxPitch, segmentX, groundingMark);
  });

  projectedSegment.events.forEach((projectedEvent) => {
    appendEventMark(
      group,
      maxPitch,
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

function createScoreSvg(projection: Projection): SVGSVGElement {
  const svg = createSvgElement("svg");
  const width =
    PADDING * 2 +
    projection.segments.length * SEGMENT_WIDTH +
    Math.max(projection.segments.length - 1, 0) * SEGMENT_GAP;
  const height =
    PADDING * 2 + (projection.maxPitch - projection.minPitch + 1) * ROW_HEIGHT;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Simple harmonic score");

  appendGrid(svg, projection.maxPitch, projection.minPitch, width);

  projection.segments.forEach((projectedSegment) => {
    const group = createSvgElement("g");
    appendSegment(group, projection, projectedSegment);
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
