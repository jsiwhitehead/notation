import type { HarmonicField } from "./model";
import type {
  Placement,
  PositionedEvent,
  PositionedSegment,
} from "./placement";

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

function repeatFieldAcrossRange(
  maxPitch: number,
  minPitch: number,
  field: HarmonicField,
): HarmonicField[] {
  const repeated: HarmonicField[] = [];

  for (
    let octaveBase = Math.floor(minPitch / 12) * 12;
    octaveBase <= maxPitch;
    octaveBase += 12
  ) {
    const startPitch = octaveBase + field.start;
    const endPitch = octaveBase + field.end;

    if (startPitch > maxPitch || endPitch < minPitch) {
      continue;
    }

    repeated.push({
      end: Math.min(Math.max(startPitch, endPitch), maxPitch),
      start: Math.max(Math.min(startPitch, endPitch), minPitch),
    });
  }

  return repeated;
}

function repeatPitchClassesAcrossRange(
  maxPitch: number,
  minPitch: number,
  pitchClasses: number[],
): number[] {
  const repeated: number[] = [];

  pitchClasses.forEach((pitchClass) => {
    for (
      let pitch = Math.floor(minPitch / 12) * 12 + pitchClass;
      pitch <= maxPitch;
      pitch += 12
    ) {
      if (pitch >= minPitch) {
        repeated.push(pitch);
      }
    }
  });

  return repeated.sort((left, right) => left - right);
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
  field: HarmonicField,
): void {
  const rect = createSvgElement("rect");
  const top = getYForPitch(maxPitch, field.end) - ROW_HEIGHT / 2;
  const bottom = getYForPitch(maxPitch, field.start) + ROW_HEIGHT / 2;

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
  groundingMark: { pitch: number; type: "ground" | "root" },
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

function buildGroundingMarks(
  placement: Placement,
  positionedSegment: PositionedSegment,
): { pitch: number; type: "ground" | "root" }[] {
  if (positionedSegment.grounding === undefined) {
    return [];
  }

  const rootMarks = repeatPitchClassesAcrossRange(
    placement.maxPitch,
    placement.minPitch,
    [positionedSegment.grounding.root],
  ).map((pitch) => ({
    pitch,
    type: "root" as const,
  }));
  const groundMarks = repeatPitchClassesAcrossRange(
    placement.maxPitch,
    placement.minPitch,
    [positionedSegment.grounding.ground],
  ).map((pitch) => ({
    pitch,
    type: "ground" as const,
  }));

  return [...rootMarks, ...groundMarks].sort(
    (left, right) => left.pitch - right.pitch,
  );
}

function appendEventMark(
  group: SVGGElement,
  maxPitch: number,
  segmentX: number,
  positionedSegment: PositionedSegment,
  positionedEvent: PositionedEvent,
): void {
  const startX =
    segmentX +
    (positionedEvent.offset / positionedSegment.totalDuration) * SEGMENT_WIDTH;
  const endX =
    segmentX +
    ((positionedEvent.offset + positionedEvent.duration) /
      positionedSegment.totalDuration) *
      SEGMENT_WIDTH;
  const centerX = (startX + endX) / 2;
  const width = Math.max(endX - startX, MIN_EVENT_WIDTH);

  switch (positionedEvent.type) {
    case "pitched":
      positionedEvent.pitches.forEach((pitch) => {
        appendNote(group, centerX, width, maxPitch, pitch);
      });
      return;
    case "rest":
      appendRest(group, centerX, width, maxPitch, positionedEvent.pitch);
  }
}

function appendSegment(
  group: SVGGElement,
  placement: Placement,
  positionedSegment: PositionedSegment,
): void {
  const { maxPitch, minPitch } = placement;
  const segmentX = getXForSegment(positionedSegment.index);
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

  positionedSegment.fields
    .flatMap((field) => repeatFieldAcrossRange(maxPitch, minPitch, field))
    .forEach((field) => {
      appendFieldBlock(group, maxPitch, segmentX, field);
    });

  repeatPitchClassesAcrossRange(
    maxPitch,
    minPitch,
    positionedSegment.centerPitchClasses,
  ).forEach((pitch) => {
    appendCenterMark(group, maxPitch, segmentX, pitch);
  });

  buildGroundingMarks(placement, positionedSegment).forEach((groundingMark) => {
    appendGroundingMark(group, maxPitch, segmentX, groundingMark);
  });

  positionedSegment.positionedEvents.forEach((positionedEvent) => {
    appendEventMark(
      group,
      maxPitch,
      segmentX,
      positionedSegment,
      positionedEvent,
    );
  });

  setAttributes(label, {
    fill: "#111111",
    "font-size": 12,
    x: segmentX,
    y: PADDING - 10,
  });
  label.textContent = String(positionedSegment.index + 1);

  group.append(label);
}

function createScoreSvg(placement: Placement): SVGSVGElement {
  const svg = createSvgElement("svg");
  const width =
    PADDING * 2 +
    placement.segments.length * SEGMENT_WIDTH +
    Math.max(placement.segments.length - 1, 0) * SEGMENT_GAP;
  const height =
    PADDING * 2 + (placement.maxPitch - placement.minPitch + 1) * ROW_HEIGHT;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Simple harmonic score");

  appendGrid(svg, placement.maxPitch, placement.minPitch, width);

  placement.segments.forEach((placedSegment) => {
    const group = createSvgElement("g");
    appendSegment(group, placement, placedSegment);
    svg.append(group);
  });

  return svg;
}

export function renderApp(placement: Placement): HTMLElement {
  const app = document.createElement("main");
  const heading = document.createElement("h1");
  const score = document.createElement("div");

  app.className = "app";
  heading.textContent = "Notation";
  score.className = "score";
  score.append(createScoreSvg(placement));

  app.append(heading, score);
  return app;
}
