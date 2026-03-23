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

const MAX_SYSTEM_WIDTH_PX = 1400;
const SYSTEM_GAP_PX = 56;

type RenderSystemLayout = {
  segmentLayouts: RenderSegmentLayout[];
  width: number;
  y: number;
};

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

function getSystemHeight(projection: Projection): number {
  return (
    VERTICAL_PADDING_PX * 2 +
    (projection.maxPitch - projection.minPitch) * PITCH_STEP_HEIGHT_PX
  );
}

function getNotationLayout(
  projection: Projection,
  renderSystemLayouts: RenderSystemLayout[],
): NotationLayout {
  const systemHeight = getSystemHeight(projection);
  const maxSystemWidth = renderSystemLayouts.reduce(
    (maxWidth, renderSystemLayout) =>
      Math.max(maxWidth, renderSystemLayout.width),
    0,
  );

  return {
    height:
      systemHeight * renderSystemLayouts.length +
      Math.max(renderSystemLayouts.length - 1, 0) * SYSTEM_GAP_PX,
    maxPitch: projection.maxPitch,
    minPitch: projection.minPitch,
    width: maxSystemWidth,
  };
}

function getRenderSystemLayouts(projection: Projection): RenderSystemLayout[] {
  const renderSystemLayouts: RenderSystemLayout[] = [];
  const systemHeight = getSystemHeight(projection);
  let currentSystemSegmentLayouts: RenderSegmentLayout[] = [];
  let currentX = HORIZONTAL_PADDING_PX;
  let currentY = 0;

  projection.segments.forEach((segment) => {
    const widthPx = getSegmentWidthPx(segment.segmentWidthUnits);
    const hasSegmentsInSystem = currentSystemSegmentLayouts.length > 0;
    const nextRightEdge =
      currentX +
      widthPx +
      (hasSegmentsInSystem ? SEGMENT_GAP_PX / 2 : SEGMENT_GAP_PX / 2);

    if (
      hasSegmentsInSystem &&
      nextRightEdge + HORIZONTAL_PADDING_PX > MAX_SYSTEM_WIDTH_PX
    ) {
      renderSystemLayouts.push({
        segmentLayouts: currentSystemSegmentLayouts,
        width:
          currentSystemSegmentLayouts.at(-1)!.x +
          currentSystemSegmentLayouts.at(-1)!.widthPx +
          HORIZONTAL_PADDING_PX,
        y: currentY,
      });
      currentSystemSegmentLayouts = [];
      currentX = HORIZONTAL_PADDING_PX;
      currentY += systemHeight + SYSTEM_GAP_PX;
    }

    currentSystemSegmentLayouts.push({
      segment,
      widthPx,
      x: currentX,
    });
    currentX += widthPx + SEGMENT_GAP_PX;
  });

  if (currentSystemSegmentLayouts.length > 0) {
    renderSystemLayouts.push({
      segmentLayouts: currentSystemSegmentLayouts,
      width:
        currentSystemSegmentLayouts.at(-1)!.x +
        currentSystemSegmentLayouts.at(-1)!.widthPx +
        HORIZONTAL_PADDING_PX,
      y: currentY,
    });
  }

  return renderSystemLayouts;
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
  const renderSystemLayouts = getRenderSystemLayouts(projection);
  const layout = getNotationLayout(projection, renderSystemLayouts);

  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("width", String(layout.width));
  svg.setAttribute("height", String(layout.height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Simple harmonic notation view");

  renderSystemLayouts.forEach((renderSystemLayout) => {
    const systemGroup = createSvgElement("g");
    const regionGroup = createSvgElement("g");
    const seamGroup = createSvgElement("g");
    const knockoutGroup = createSvgElement("g");
    const fillGroup = createSvgElement("g");
    const foregroundGroup = createSvgElement("g");

    systemGroup.setAttribute(
      "transform",
      `translate(0 ${renderSystemLayout.y})`,
    );

    renderSystemLayout.segmentLayouts.forEach((renderSegmentLayout) => {
      const group = createSvgElement("g");
      appendProjectedSegmentRegions(group, layout, renderSegmentLayout);
      regionGroup.append(group);
    });

    appendAllSegmentSeams(seamGroup, layout, renderSystemLayout.segmentLayouts);

    renderSystemLayout.segmentLayouts.forEach((renderSegmentLayout) => {
      appendSegmentForeground(
        knockoutGroup,
        fillGroup,
        foregroundGroup,
        layout,
        renderSegmentLayout,
      );
    });

    systemGroup.append(
      regionGroup,
      seamGroup,
      knockoutGroup,
      fillGroup,
      foregroundGroup,
    );
    svg.append(systemGroup);
  });

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
