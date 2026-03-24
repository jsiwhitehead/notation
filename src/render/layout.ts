import { sliceContainsOffset } from "../projection";
import type { Projection, ProjectionSegment } from "../projection";
import {
  getSegmentWidthPx,
  HORIZONTAL_PADDING_PX,
  PITCH_STEP_HEIGHT_PX,
  SEGMENT_GAP_PX,
  VERTICAL_PADDING_PX,
} from "./metrics";

export type NotationLayout = {
  height: number;
  maxPitch: number;
  minPitch: number;
  width: number;
};

export type RenderSegmentLayout = {
  contentWidthPx: number;
  segment: ProjectionSegment;
  widthPx: number;
  x: number;
};

export type RenderSystemLayout = {
  segmentLayouts: RenderSegmentLayout[];
  width: number;
  y: number;
};

type HorizontalBounds = {
  width: number;
  x: number;
};

type LocalTimePosition = {
  maxDuration: number;
  offset: number;
  x: number;
};

type RenderedSliceLayout = {
  endPx: number;
  gapBeforePx: number;
  hasSegmentSeamBefore: boolean;
  harmonicSlice: ProjectionSegment["harmonicSlices"][number];
  index: number;
  startPx: number;
};

export type SliceFrame = {
  bodyBounds: HorizontalBounds;
  endOffset: number;
  gapBeforePx: number;
  harmonicSlice: ProjectionSegment["harmonicSlices"][number];
  hasSegmentSeamBefore: boolean;
  rawBounds: HorizontalBounds;
  seamAfter: number;
  seamBefore: number;
  startOffset: number;
};

const MAX_SYSTEM_WIDTH_PX = 1400;
const MIN_TIME_POSITION_WEIGHT = 1;
const SYSTEM_GAP_PX = 56;
const TIME_POSITION_EDGE_WEIGHT = 1;

export function buildPositionedGraphics<Graphic, PositionedGraphic>(
  graphics: Graphic[],
  positionGraphic: (graphic: Graphic) => PositionedGraphic | undefined,
): PositionedGraphic[] {
  return graphics.flatMap((graphic) => {
    const positionedGraphic = positionGraphic(graphic);

    return positionedGraphic === undefined ? [] : [positionedGraphic];
  });
}

export function appendPositionedGraphics<PositionedGraphic>(
  positionedGraphics: PositionedGraphic[],
  appendGraphic: (positionedGraphic: PositionedGraphic) => void,
): void {
  positionedGraphics.forEach((positionedGraphic) => {
    appendGraphic(positionedGraphic);
  });
}

export function getNotationLayout(
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

export function getRenderSystemLayouts(
  projection: Projection,
): RenderSystemLayout[] {
  const renderSystemLayouts: RenderSystemLayout[] = [];
  const systemHeight = getSystemHeight(projection);
  let currentSystemSegmentLayouts: RenderSegmentLayout[] = [];
  let currentX = HORIZONTAL_PADDING_PX;
  let currentY = 0;

  projection.segments.forEach((segment) => {
    const contentWidthPx = getSegmentWidthPx(segment.segmentWidthUnits);
    const widthPx = getRenderedSegmentWidthPx(contentWidthPx, segment);
    const hasSegmentsInSystem = currentSystemSegmentLayouts.length > 0;
    const nextRightEdge = currentX + widthPx;

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
      contentWidthPx,
      segment,
      widthPx,
      x: currentX,
    });
    currentX += widthPx;
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

export function getSeamXs(
  renderSegmentLayouts: RenderSegmentLayout[],
): number[] {
  if (renderSegmentLayouts.length === 0) {
    return [];
  }

  const seamXs = [renderSegmentLayouts[0]!.x];

  renderSegmentLayouts.forEach((renderSegmentLayout) => {
    seamXs.push(renderSegmentLayout.x + renderSegmentLayout.widthPx);
  });

  return seamXs;
}

export function getRenderedHarmonicSliceBounds(
  renderSegmentLayout: RenderSegmentLayout,
  harmonicSlice: ProjectionSegment["harmonicSlices"][number],
): HorizontalBounds {
  return getSliceFrame(renderSegmentLayout, harmonicSlice).bodyBounds;
}

export function getSliceFrame(
  renderSegmentLayout: RenderSegmentLayout,
  harmonicSlice: ProjectionSegment["harmonicSlices"][number],
): SliceFrame {
  const renderedSliceLayout = getRenderedSliceLayouts(renderSegmentLayout).find(
    (candidateSlice) => candidateSlice.harmonicSlice === harmonicSlice,
  );

  if (renderedSliceLayout === undefined) {
    throw new Error("Missing rendered slice layout for harmonic slice.");
  }

  const rawBounds = {
    width: Math.max(0, renderedSliceLayout.endPx - renderedSliceLayout.startPx),
    x: renderedSliceLayout.startPx,
  };

  return {
    bodyBounds: rawBounds,
    endOffset: harmonicSlice.startOffset + harmonicSlice.duration,
    gapBeforePx: renderedSliceLayout.gapBeforePx,
    harmonicSlice,
    hasSegmentSeamBefore: renderedSliceLayout.hasSegmentSeamBefore,
    rawBounds,
    seamAfter: 0,
    seamBefore: 0,
    startOffset: harmonicSlice.startOffset,
  };
}

export function getRenderedEventCenterX(
  renderSegmentLayout: RenderSegmentLayout,
  projectedEvent: ProjectionSegment["events"][number],
): number {
  const sliceFrame = getSliceFrameByOffset(
    renderSegmentLayout,
    projectedEvent.offset,
  );

  if (sliceFrame === undefined) {
    return (
      renderSegmentLayout.x + projectedEvent.x * renderSegmentLayout.widthPx
    );
  }

  return mapOffsetIntoSliceFrame(
    renderSegmentLayout,
    projectedEvent.offset,
    sliceFrame,
  );
}

export function getSliceFrameByOffset(
  renderSegmentLayout: RenderSegmentLayout,
  offset: number,
): SliceFrame | undefined {
  const renderedSliceLayout = getRenderedSliceLayoutByOffset(
    renderSegmentLayout,
    offset,
  );

  return renderedSliceLayout === undefined
    ? undefined
    : getSliceFrame(renderSegmentLayout, renderedSliceLayout.harmonicSlice);
}

function getRenderedSliceLayouts(
  renderSegmentLayout: RenderSegmentLayout,
): RenderedSliceLayout[] {
  return renderSegmentLayout.segment.harmonicSlices.map(
    (harmonicSlice, index) => {
      const gapBeforePx = index === 0 ? 0 : SEGMENT_GAP_PX;
      const canonicalStartX = harmonicSlice.startX;
      const canonicalEndX = harmonicSlice.endX;

      return {
        endPx: getRenderedCanonicalX(renderSegmentLayout, canonicalEndX, index),
        gapBeforePx,
        hasSegmentSeamBefore: false,
        harmonicSlice,
        index,
        startPx: getRenderedCanonicalX(
          renderSegmentLayout,
          canonicalStartX,
          index,
        ),
      };
    },
  );
}

function getRenderedSliceLayoutByOffset(
  renderSegmentLayout: RenderSegmentLayout,
  offset: number,
): RenderedSliceLayout | undefined {
  return getRenderedSliceLayouts(renderSegmentLayout).find((candidateSlice) =>
    sliceContainsOffset(candidateSlice.harmonicSlice, offset),
  );
}

function getRenderedCanonicalX(
  renderSegmentLayout: RenderSegmentLayout,
  canonicalX: number,
  sliceIndex: number,
): number {
  const contentStartX = renderSegmentLayout.x + SEGMENT_GAP_PX / 2;

  return (
    contentStartX +
    canonicalX * renderSegmentLayout.contentWidthPx +
    Math.max(sliceIndex, 0) * SEGMENT_GAP_PX
  );
}

function mapOffsetIntoSliceFrame(
  renderSegmentLayout: RenderSegmentLayout,
  offset: number,
  sliceFrame: SliceFrame,
): number {
  if (sliceFrame.bodyBounds.width <= 0) {
    return sliceFrame.bodyBounds.x;
  }

  const localOffset = offset - sliceFrame.startOffset;
  const localTimePositions = getLocalTimePositions(
    renderSegmentLayout,
    sliceFrame.harmonicSlice,
  );
  const localX = getLocalOffsetX(
    localTimePositions,
    sliceFrame.harmonicSlice.duration,
    localOffset,
  );

  return sliceFrame.bodyBounds.x + localX * sliceFrame.bodyBounds.width;
}

function getLocalOffsetX(
  timePositions: LocalTimePosition[],
  totalDuration: number,
  offset: number,
): number {
  const exactTimePosition = timePositions.find(
    (timePosition) => timePosition.offset === offset,
  );

  if (exactTimePosition !== undefined) {
    return exactTimePosition.x;
  }

  if (offset <= 0) {
    return 0;
  }

  if (offset >= totalDuration) {
    return 1;
  }

  const previousTimePosition = [...timePositions]
    .reverse()
    .find((timePosition) => timePosition.offset < offset);
  const nextTimePosition = timePositions.find(
    (timePosition) => timePosition.offset > offset,
  );
  const previousOffset = previousTimePosition?.offset ?? 0;
  const previousX = previousTimePosition?.x ?? 0;
  const nextOffset = nextTimePosition?.offset ?? totalDuration;
  const nextX = nextTimePosition?.x ?? 1;

  if (nextOffset === previousOffset) {
    return previousX;
  }

  return (
    previousX +
    ((offset - previousOffset) / (nextOffset - previousOffset)) *
      (nextX - previousX)
  );
}

function getLocalTimePositions(
  renderSegmentLayout: RenderSegmentLayout,
  harmonicSlice: ProjectionSegment["harmonicSlices"][number],
): LocalTimePosition[] {
  const sliceEvents = renderSegmentLayout.segment.events.filter((event) =>
    sliceContainsOffset(harmonicSlice, event.offset),
  );
  const groupedDurations = new Map<number, number[]>();

  sliceEvents.forEach((event) => {
    const localOffset = event.offset - harmonicSlice.startOffset;
    const durationsAtOffset = groupedDurations.get(localOffset) ?? [];

    durationsAtOffset.push(event.duration);
    groupedDurations.set(localOffset, durationsAtOffset);
  });

  const timePositions = [...groupedDurations.entries()]
    .sort(([leftOffset], [rightOffset]) => leftOffset - rightOffset)
    .map(([offset, durations]) => ({
      maxDuration: Math.max(...durations),
      offset,
      x: 0,
    }));

  if (timePositions.length === 0) {
    return [];
  }

  if (timePositions.length === 1) {
    return [{ ...timePositions[0]!, x: 0.5 }];
  }

  const intervalWeights = timePositions
    .slice(0, -1)
    .map((timePosition, index) =>
      getLocalTimePositionIntervalWeight(
        timePositions[index + 1]!.offset - timePosition.offset,
        timePosition.maxDuration,
        harmonicSlice.duration,
      ),
    );
  const spacingWeightTotal =
    TIME_POSITION_EDGE_WEIGHT * 2 +
    intervalWeights.reduce((sum, weight) => sum + weight, 0);
  let accumulatedWeight = TIME_POSITION_EDGE_WEIGHT;

  return timePositions.map((timePosition, index) => {
    const positionedTimePosition = {
      ...timePosition,
      x: accumulatedWeight / spacingWeightTotal,
    };

    accumulatedWeight += intervalWeights[index] ?? 0;

    return positionedTimePosition;
  });
}

function getLocalTimePositionIntervalWeight(
  gapDuration: number,
  maxDuration: number,
  totalDuration: number,
): number {
  const normalizedGapDuration = Math.max(gapDuration, 0) / totalDuration;
  const normalizedMaxDuration = Math.max(maxDuration, 0) / totalDuration;

  return (
    MIN_TIME_POSITION_WEIGHT +
    Math.sqrt(normalizedGapDuration) +
    Math.max(0, Math.sqrt(normalizedMaxDuration) - 0.5)
  );
}

function getSystemHeight(projection: Projection): number {
  return (
    VERTICAL_PADDING_PX * 2 +
    (projection.maxPitch - projection.minPitch) * PITCH_STEP_HEIGHT_PX
  );
}

function getRenderedSegmentWidthPx(
  contentWidthPx: number,
  segment: ProjectionSegment,
): number {
  return contentWidthPx + segment.harmonicSlices.length * SEGMENT_GAP_PX;
}
