import { type Projection } from "../projection";
import { appendProjectedSegmentEvents } from "./events";
import type { NotationLayout, RenderSegmentLayout } from "./layout";
import {
  getSegmentWidthPx,
  HORIZONTAL_PADDING_PX,
  PITCH_STEP_HEIGHT_PX,
  SEGMENT_GAP_PX,
  SEGMENT_SEAM_PX,
  VERTICAL_PADDING_PX,
} from "./metrics";
import { appendProjectedSegmentRegions } from "./regions";
import { createSvgElement, setAttributes } from "./svg";

function appendSegmentForeground(
  knockoutGroup: SVGGElement,
  fillGroup: SVGGElement,
  inkGroup: SVGGElement,
  layout: NotationLayout,
  renderSegmentLayout: RenderSegmentLayout,
): void {
  const label = createSvgElement("text");
  const { segment, x } = renderSegmentLayout;

  appendProjectedSegmentEvents(
    knockoutGroup,
    fillGroup,
    inkGroup,
    layout.maxPitch,
    renderSegmentLayout,
  );

  setAttributes(label, {
    fill: "#111111",
    "font-size": 12,
    x,
    y: VERTICAL_PADDING_PX - 10,
  });
  label.textContent = String(segment.index + 1);

  inkGroup.append(label);
}

function appendSegmentBoundarySeam(
  group: SVGGElement,
  layout: NotationLayout,
  seamX: number,
): void {
  const rect = createSvgElement("rect");

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
  layout: NotationLayout,
  renderSegmentLayouts: RenderSegmentLayout[],
): void {
  const seamXs = getSeamXs(renderSegmentLayouts);

  seamXs.forEach((seamX) => {
    appendSegmentBoundarySeam(group, layout, seamX);
  });
}

function getNotationLayout(
  projection: Projection,
  renderSegmentLayouts: RenderSegmentLayout[],
): NotationLayout {
  const totalSegmentWidth = renderSegmentLayouts.reduce(
    (sum, renderSegmentLayout) => sum + renderSegmentLayout.widthPx,
    0,
  );

  return {
    height:
      VERTICAL_PADDING_PX * 2 +
      (projection.maxPitch - projection.minPitch) * PITCH_STEP_HEIGHT_PX,
    maxPitch: projection.maxPitch,
    minPitch: projection.minPitch,
    width:
      HORIZONTAL_PADDING_PX * 2 +
      totalSegmentWidth +
      Math.max(renderSegmentLayouts.length - 1, 0) * SEGMENT_GAP_PX,
  };
}

function getRenderSegmentLayouts(
  projection: Projection,
): RenderSegmentLayout[] {
  const renderSegmentLayouts: RenderSegmentLayout[] = [];
  let currentX = HORIZONTAL_PADDING_PX;

  projection.segments.forEach((segment) => {
    const widthPx = getSegmentWidthPx(segment.segmentWidthUnits);

    renderSegmentLayouts.push({
      segment,
      widthPx,
      x: currentX,
    });
    currentX += widthPx + SEGMENT_GAP_PX;
  });

  return renderSegmentLayouts;
}

function getSeamXs(renderSegmentLayouts: RenderSegmentLayout[]): number[] {
  if (renderSegmentLayouts.length === 0) {
    return [];
  }

  const seamXs = [renderSegmentLayouts[0]!.x - SEGMENT_GAP_PX / 2];

  renderSegmentLayouts.forEach((renderSegmentLayout) => {
    seamXs.push(
      renderSegmentLayout.x + renderSegmentLayout.widthPx + SEGMENT_GAP_PX / 2,
    );
  });

  return seamXs;
}

function createNotationSvg(projection: Projection): SVGSVGElement {
  const svg = createSvgElement("svg");
  const regionGroup = createSvgElement("g");
  const seamGroup = createSvgElement("g");
  const knockoutGroup = createSvgElement("g");
  const fillGroup = createSvgElement("g");
  const foregroundGroup = createSvgElement("g");
  const renderSegmentLayouts = getRenderSegmentLayouts(projection);
  const layout = getNotationLayout(projection, renderSegmentLayouts);

  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("width", String(layout.width));
  svg.setAttribute("height", String(layout.height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Simple harmonic notation view");

  renderSegmentLayouts.forEach((renderSegmentLayout) => {
    const group = createSvgElement("g");
    appendProjectedSegmentRegions(group, layout, renderSegmentLayout);
    regionGroup.append(group);
  });

  appendAllSegmentSeams(seamGroup, layout, renderSegmentLayouts);

  renderSegmentLayouts.forEach((renderSegmentLayout) => {
    appendSegmentForeground(
      knockoutGroup,
      fillGroup,
      foregroundGroup,
      layout,
      renderSegmentLayout,
    );
  });

  svg.append(regionGroup, seamGroup, knockoutGroup, fillGroup, foregroundGroup);

  return svg;
}

export function renderApp(projection: Projection): HTMLElement {
  const app = document.createElement("main");
  const heading = document.createElement("h1");
  const notationView = document.createElement("div");

  app.className = "app";
  heading.textContent = "Notation";
  notationView.className = "notation-view";
  notationView.append(createNotationSvg(projection));

  app.append(heading, notationView);
  return app;
}
