import { type Projection } from "../projection";
import { appendProjectedSegmentEvents } from "./events";
import {
  getNotationLayout,
  getRenderSystemLayouts,
  getSeamXs,
  type NotationLayout,
  type RenderSegmentLayout,
  type RenderSystemLayout,
} from "./layout";
import {
  BAR_NUMBER_GAP_PX,
  BAR_NUMBER_FONT_SIZE_PX,
  INK_COLOR,
  SEGMENT_SEAM_PX,
} from "./metrics";
import {
  appendProjectedSegmentRegions,
  getProjectedRegionsVerticalBounds,
  type VerticalBounds,
} from "./regions";
import { createSvgElement, setAttributes } from "./svg";

type RenderSystemLayerGroups = {
  fillGroup: SVGGElement;
  foregroundGroup: SVGGElement;
  regionGroup: SVGGElement;
  seamGroup: SVGGElement;
};

const RENDER_SYSTEM_PAINT_ORDER: (keyof RenderSystemLayerGroups)[] = [
  "regionGroup",
  "seamGroup",
  "fillGroup",
  "foregroundGroup",
];

function appendSegmentForeground(
  layerGroups: RenderSystemLayerGroups,
  maxPitch: number,
  seamBounds: VerticalBounds,
  renderSegmentLayout: RenderSegmentLayout,
): void {
  const label = createSvgElement("text");
  const { segment, x } = renderSegmentLayout;
  const seamX = x;

  appendProjectedSegmentEvents(
    layerGroups.fillGroup,
    layerGroups.foregroundGroup,
    maxPitch,
    renderSegmentLayout,
  );

  setAttributes(label, {
    fill: INK_COLOR,
    "font-size": BAR_NUMBER_FONT_SIZE_PX,
    "text-anchor": "middle",
    x: seamX,
    y: seamBounds.y - BAR_NUMBER_GAP_PX,
  });
  label.textContent = String(segment.index + 1);

  layerGroups.foregroundGroup.append(label);
}

function appendSegmentBoundarySeam(
  group: SVGGElement,
  seamBounds: VerticalBounds,
  seamX: number,
): void {
  const rect = createSvgElement("rect");

  setAttributes(rect, {
    fill: INK_COLOR,
    height: seamBounds.height,
    width: SEGMENT_SEAM_PX,
    x: seamX - SEGMENT_SEAM_PX / 2,
    y: seamBounds.y,
  });

  group.append(rect);
}

function appendAllSegmentSeams(
  group: SVGGElement,
  seamBounds: VerticalBounds,
  renderSegmentLayouts: RenderSegmentLayout[],
): void {
  getSeamXs(renderSegmentLayouts).forEach((seamX) => {
    appendSegmentBoundarySeam(group, seamBounds, seamX);
  });
}

function createRenderSystemLayerGroups(): RenderSystemLayerGroups {
  return {
    fillGroup: createSvgElement("g"),
    foregroundGroup: createSvgElement("g"),
    regionGroup: createSvgElement("g"),
    seamGroup: createSvgElement("g"),
  };
}

function buildRenderSystemLayerGroups(
  layout: NotationLayout,
  renderSystemLayout: RenderSystemLayout,
): RenderSystemLayerGroups {
  const layerGroups = createRenderSystemLayerGroups();
  const seamBounds = getProjectedRegionsVerticalBounds(
    layout.maxPitch,
    renderSystemLayout.segmentLayouts,
  ) ?? { height: layout.height, y: 0 };

  renderSystemLayout.segmentLayouts.forEach((renderSegmentLayout) => {
    const group = createSvgElement("g");
    appendProjectedSegmentRegions(group, layout, renderSegmentLayout);
    layerGroups.regionGroup.append(group);
  });

  appendAllSegmentSeams(
    layerGroups.seamGroup,
    seamBounds,
    renderSystemLayout.segmentLayouts,
  );

  renderSystemLayout.segmentLayouts.forEach((renderSegmentLayout) => {
    appendSegmentForeground(
      layerGroups,
      layout.maxPitch,
      seamBounds,
      renderSegmentLayout,
    );
  });

  return layerGroups;
}

function appendRenderSystemLayers(
  systemGroup: SVGGElement,
  layerGroups: RenderSystemLayerGroups,
): void {
  systemGroup.append(
    ...RENDER_SYSTEM_PAINT_ORDER.map((layerName) => layerGroups[layerName]),
  );
}

export function renderNotationSvg(projection: Projection): SVGSVGElement {
  const svg = createSvgElement("svg");
  const renderSystemLayouts = getRenderSystemLayouts(projection);
  const layout = getNotationLayout(projection, renderSystemLayouts);

  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("width", String(layout.width));
  svg.setAttribute("height", String(layout.height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Simple harmonic notation view");

  renderSystemLayouts.forEach((renderSystemLayout) => {
    svg.append(createRenderSystemGroup(layout, renderSystemLayout));
  });

  return svg;
}

function createRenderSystemGroup(
  layout: NotationLayout,
  renderSystemLayout: RenderSystemLayout,
): SVGGElement {
  const systemGroup = createSvgElement("g");
  const layerGroups = buildRenderSystemLayerGroups(layout, renderSystemLayout);

  systemGroup.setAttribute("transform", `translate(0 ${renderSystemLayout.y})`);
  appendRenderSystemLayers(systemGroup, layerGroups);

  return systemGroup;
}
