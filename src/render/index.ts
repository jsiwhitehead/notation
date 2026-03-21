import { type Projection, type ProjectionSegment } from "../projection";
import { appendProjectedEvent } from "./events";
import {
  getEventCenterX,
  getSeamX,
  getXForSegment,
  HORIZONTAL_PADDING_PX,
  PITCH_STEP_HEIGHT_PX,
  SEGMENT_GAP_PX,
  SEGMENT_SEAM_PX,
  SEGMENT_WIDTH_PX,
  VERTICAL_PADDING_PX,
} from "./metrics";
import { appendProjectedSegmentRegions } from "./regions";
import { createSvgElement, setAttributes } from "./svg";

type ScoreLayout = {
  height: number;
  maxPitch: number;
  minPitch: number;
  width: number;
};

function appendSegmentForeground(
  group: SVGGElement,
  layout: ScoreLayout,
  projectedSegment: ProjectionSegment,
): void {
  const segmentX = getXForSegment(projectedSegment.index);
  const label = createSvgElement("text");

  projectedSegment.events.forEach((projectedEvent) => {
    const centerX = getEventCenterX(
      segmentX,
      projectedSegment.totalDuration,
      projectedEvent.offset,
      projectedEvent.duration,
    );

    appendProjectedEvent(group, centerX, layout.maxPitch, projectedEvent);
  });

  setAttributes(label, {
    fill: "#111111",
    "font-size": 12,
    x: segmentX,
    y: VERTICAL_PADDING_PX - 10,
  });
  label.textContent = String(projectedSegment.index + 1);

  group.append(label);
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
    width: SEGMENT_SEAM_PX,
    x: seamX - SEGMENT_SEAM_PX / 2,
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
      VERTICAL_PADDING_PX * 2 +
      (projection.maxPitch - projection.minPitch) * PITCH_STEP_HEIGHT_PX,
    maxPitch: projection.maxPitch,
    minPitch: projection.minPitch,
    width:
      HORIZONTAL_PADDING_PX * 2 +
      projection.segments.length * SEGMENT_WIDTH_PX +
      Math.max(projection.segments.length - 1, 0) * SEGMENT_GAP_PX,
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
    appendProjectedSegmentRegions(
      group,
      layout.maxPitch,
      getXForSegment(projectedSegment.index),
      projectedSegment,
    );
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
