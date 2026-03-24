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
import { SEGMENT_SEAM_PX, VERTICAL_PADDING_PX } from "./metrics";
import { appendProjectedSegmentRegions } from "./regions";
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
  layout: NotationLayout,
  renderSegmentLayout: RenderSegmentLayout,
): void {
  const label = createSvgElement("text");
  const { segment, x } = renderSegmentLayout;

  appendProjectedSegmentEvents(
    layerGroups.fillGroup,
    layerGroups.foregroundGroup,
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

  layerGroups.foregroundGroup.append(label);
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
  getSeamXs(renderSegmentLayouts).forEach((seamX) => {
    appendSegmentBoundarySeam(group, layout, seamX);
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

  renderSystemLayout.segmentLayouts.forEach((renderSegmentLayout) => {
    const group = createSvgElement("g");
    appendProjectedSegmentRegions(group, layout, renderSegmentLayout);
    layerGroups.regionGroup.append(group);
  });

  appendAllSegmentSeams(
    layerGroups.seamGroup,
    layout,
    renderSystemLayout.segmentLayouts,
  );

  renderSystemLayout.segmentLayouts.forEach((renderSegmentLayout) => {
    appendSegmentForeground(layerGroups, layout, renderSegmentLayout);
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
