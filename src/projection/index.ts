import type {
  AnalyzedHarmonicSegment,
  EventLayer,
  EventOffset,
  HarmonicSegment,
  HarmonicStructure,
  PieceInput,
  SegmentInput,
  TimeSignature,
} from "../model";
import {
  getEventPitches,
  repeatPitchClassesAcrossRange,
  toPitchClass,
} from "../pitch";
import {
  buildProjectionEvents,
  type ProjectedOwnedSpan,
  type ProjectedPitchOwnership,
  type ProjectionEvent,
} from "./events";
import {
  buildProjectedGroundingOverlays,
  type ProjectedGroundingMarks,
} from "./grounding";
import type { ProjectionTimePosition } from "./spacing";
import {
  buildLinkedProjectedRegionGroups,
  type ProjectedRegion,
  type ProjectedSpan,
  type PitchWindow,
} from "./spans";

const EVENT_PITCH_WINDOW_PADDING = 1;
const VISIBLE_PITCH_WINDOW_PADDING = 1;
const DEFAULT_PITCH_WINDOW: PitchWindow = { maxPitch: 71, minPitch: 60 };

type SegmentVisibleDefaults = {
  restAnchorPitch: number;
};

type ProjectionHarmonicSlice = {
  center: ProjectedRegion;
  duration: number;
  endX: number;
  field: ProjectedRegion;
  harmonic: HarmonicSegment;
  projectedGroundingMarks: ProjectedGroundingMarks | undefined;
  startOffset: EventOffset;
  startX: number;
  touchesSegmentEnd: boolean;
  touchesSegmentStart: boolean;
};

type ProjectionSliceGraphics = Pick<
  ProjectionHarmonicSlice,
  "center" | "field" | "projectedGroundingMarks"
>;

type ProjectionSliceLayout = Omit<
  ProjectionHarmonicSlice,
  "center" | "field" | "projectedGroundingMarks"
>;

export type ProjectionSegment = {
  harmonicSlices: ProjectionHarmonicSlice[];
  globalHighlightPitch?: number;
  index: number;
  events: ProjectionEvent[];
  visibleDefaults: SegmentVisibleDefaults;
  segmentWidthUnits: number;
  timeSignature: TimeSignature | undefined;
  timePositions: ProjectionTimePosition[];
  totalDuration: number;
};

export type Projection = {
  maxPitch: number;
  minPitch: number;
  segments: ProjectionSegment[];
};
export type { ProjectedPitchOwnership, ProjectionEvent } from "./events";

export function buildProjection(
  input: PieceInput,
  harmonicStructure: HarmonicStructure,
): Projection {
  const visibleWindow = getPaddedPieceWindow(getPitchWindow(input));
  const restAnchorPitchBySegmentAndLayer =
    getRestAnchorPitchBySegmentAndLayer(input);
  const segmentLayouts = zipProjectionSegments(
    input.segments,
    harmonicStructure.segments,
  ).map(({ harmonicSegment, index, segment }) => {
    const projectedEvents = buildProjectionEvents(
      segment,
      restAnchorPitchBySegmentAndLayer[index]!,
    );
    return {
      events: projectedEvents.events,
      harmonicSlices: buildSliceLayoutTimings(
        harmonicSegment,
        projectedEvents.totalDuration,
        projectedEvents.timePositions,
      ),
      index,
      visibleDefaults: {
        restAnchorPitch: restAnchorPitchBySegmentAndLayer[index]!.get(0)!,
      },
      segmentWidthUnits: projectedEvents.segmentWidthUnits,
      timeSignature: segment.timeSignature,
      timePositions: projectedEvents.timePositions,
      totalDuration: projectedEvents.totalDuration,
    };
  });
  const globalHighlightPitch = getGlobalHighlightPitch(input, visibleWindow);
  const projectedHarmonicSlices = buildProjectedHarmonicSlices(
    segmentLayouts.map((segmentLayout) => segmentLayout.harmonicSlices),
    visibleWindow,
  );
  const segments = segmentLayouts.map((segmentLayout, index) => ({
    events: attachProjectedEventOwnerships(
      segmentLayout.events,
      projectedHarmonicSlices[index]!,
    ),
    harmonicSlices: projectedHarmonicSlices[index]!,
    index: segmentLayout.index,
    ...(globalHighlightPitch === undefined ? {} : { globalHighlightPitch }),
    visibleDefaults: segmentLayout.visibleDefaults,
    segmentWidthUnits: segmentLayout.segmentWidthUnits,
    timePositions: segmentLayout.timePositions,
    timeSignature: segmentLayout.timeSignature,
    totalDuration: segmentLayout.totalDuration,
  }));

  return {
    maxPitch: visibleWindow.maxPitch,
    minPitch: visibleWindow.minPitch,
    segments,
  };
}

function getGlobalHighlightPitch(
  input: PieceInput,
  visibleWindow: PitchWindow,
): number | undefined {
  const pitchClassWeights = new Map<number, number>();
  let totalPitchWeight = 0;
  let weightedPitchSum = 0;

  input.segments.forEach((segment) => {
    segment.events.forEach((event) => {
      const pitches = getEventPitches(event);

      pitches.forEach((pitch) => {
        const pitchClass = toPitchClass(pitch);
        const nextWeight =
          (pitchClassWeights.get(pitchClass) ?? 0) + event.duration;

        pitchClassWeights.set(pitchClass, nextWeight);
        totalPitchWeight += event.duration;
        weightedPitchSum += pitch * event.duration;
      });
    });
  });

  if (pitchClassWeights.size === 0 || totalPitchWeight <= 0) {
    return undefined;
  }

  const weightedMeanPitch = weightedPitchSum / totalPitchWeight;
  const highlightPitchClass = [...pitchClassWeights.entries()].reduce(
    (best, candidate) => {
      if (best === undefined || candidate[1] > best[1]) {
        return candidate;
      }

      if (candidate[1] < best[1]) {
        return best;
      }

      const bestPitch = getClosestRepeatedPitch(
        visibleWindow,
        best[0],
        weightedMeanPitch,
      );
      const candidatePitch = getClosestRepeatedPitch(
        visibleWindow,
        candidate[0],
        weightedMeanPitch,
      );

      if (bestPitch === undefined) {
        return candidate;
      }

      if (candidatePitch === undefined) {
        return best;
      }

      return Math.abs(candidatePitch - weightedMeanPitch) <
        Math.abs(bestPitch - weightedMeanPitch)
        ? candidate
        : best;
    },
    undefined as [number, number] | undefined,
  )?.[0];

  return highlightPitchClass === undefined
    ? undefined
    : getClosestRepeatedPitch(
        visibleWindow,
        highlightPitchClass,
        weightedMeanPitch,
      );
}

function getClosestRepeatedPitch(
  visibleWindow: PitchWindow,
  pitchClass: number,
  targetPitch: number,
): number | undefined {
  const repeatedPitches = repeatPitchClassesAcrossRange(
    visibleWindow.maxPitch,
    visibleWindow.minPitch,
    [pitchClass],
  );

  return repeatedPitches.reduce<number | undefined>((best, candidate) => {
    if (best === undefined) {
      return candidate;
    }

    const candidateDistance = Math.abs(candidate - targetPitch);
    const bestDistance = Math.abs(best - targetPitch);

    return candidateDistance < bestDistance ||
      (candidateDistance === bestDistance && candidate < best)
      ? candidate
      : best;
  }, undefined);
}

function buildProjectedHarmonicSlices(
  sliceLayoutsBySegment: ProjectionSliceLayout[][],
  visibleWindow: PitchWindow,
): ProjectionHarmonicSlice[][] {
  const projectedSliceGraphics = buildProjectedSliceGraphics(
    sliceLayoutsBySegment,
    visibleWindow,
  );

  return sliceLayoutsBySegment.map((sliceLayouts, segmentIndex) =>
    sliceLayouts.map((sliceLayout, sliceIndex) => {
      return projectHarmonicSlice(
        sliceLayout,
        projectedSliceGraphics[segmentIndex]![sliceIndex]!,
      );
    }),
  );
}

function projectHarmonicSlice(
  harmonicSlice: ProjectionSliceLayout,
  projectedGraphics: ProjectionSliceGraphics,
): ProjectionHarmonicSlice {
  return {
    center: projectedGraphics.center,
    duration: harmonicSlice.duration,
    endX: harmonicSlice.endX,
    field: projectedGraphics.field,
    harmonic: harmonicSlice.harmonic,
    projectedGroundingMarks: projectedGraphics.projectedGroundingMarks,
    startOffset: harmonicSlice.startOffset,
    startX: harmonicSlice.startX,
    touchesSegmentEnd: harmonicSlice.touchesSegmentEnd,
    touchesSegmentStart: harmonicSlice.touchesSegmentStart,
  };
}

function buildProjectedSliceGraphics(
  sliceLayoutsBySegment: ProjectionSliceLayout[][],
  visibleWindow: PitchWindow,
): ProjectionSliceGraphics[][] {
  const projectedCenters = buildLinkedProjectedRegionGroups(
    sliceLayoutsBySegment.map((sliceLayouts) =>
      sliceLayouts.map((sliceLayout) => sliceLayout.harmonic.center),
    ),
    visibleWindow,
  );
  const projectedFields = buildLinkedProjectedRegionGroups(
    sliceLayoutsBySegment.map((sliceLayouts) =>
      sliceLayouts.map((sliceLayout) => sliceLayout.harmonic.field),
    ),
    visibleWindow,
  );
  const projectedGroundingOverlays = buildProjectedGroundingOverlays(
    sliceLayoutsBySegment.flatMap((sliceLayouts) =>
      sliceLayouts.map((sliceLayout) => ({
        center: sliceLayout.harmonic.center,
        field: sliceLayout.harmonic.field,
        ...(sliceLayout.harmonic.grounding === undefined
          ? {}
          : { grounding: sliceLayout.harmonic.grounding }),
      })),
    ),
    projectedCenters.flat(),
    projectedFields.flat(),
  );
  const groupedGroundingOverlays = groupProjectedGroundingOverlays(
    sliceLayoutsBySegment,
    projectedGroundingOverlays,
  );

  return sliceLayoutsBySegment.map((sliceLayouts, segmentIndex) =>
    sliceLayouts.map((_, sliceIndex) => {
      return {
        center: projectedCenters[segmentIndex]![sliceIndex]!,
        field: projectedFields[segmentIndex]![sliceIndex]!,
        projectedGroundingMarks:
          groupedGroundingOverlays[segmentIndex]![sliceIndex],
      };
    }),
  );
}

function groupProjectedGroundingOverlays(
  sliceLayoutsBySegment: ProjectionSliceLayout[][],
  projectedGroundingOverlays: Array<ProjectedGroundingMarks | undefined>,
): Array<Array<ProjectedGroundingMarks | undefined>> {
  let nextOverlayIndex = 0;

  return sliceLayoutsBySegment.map((sliceLayouts) =>
    sliceLayouts.map(() => projectedGroundingOverlays[nextOverlayIndex++]),
  );
}

function attachProjectedEventOwnerships(
  events: ProjectionEvent[],
  harmonicSlices: ProjectionHarmonicSlice[],
): ProjectionEvent[] {
  return events.map((event) => {
    if (event.type !== "pitched") {
      return event;
    }

    const owningSlice = getOwningSlice(harmonicSlices, event.offset);

    return {
      ...event,
      pitchOwnerships: event.pitches.map((pitch) =>
        toProjectedPitchOwnership(
          pitch,
          getOwningFieldSpan(owningSlice?.field.spans ?? [], pitch),
        ),
      ),
    };
  });
}

function toProjectedPitchOwnership(
  pitch: number,
  fieldSpan: ProjectedSpan | undefined,
): ProjectedPitchOwnership {
  if (fieldSpan === undefined) {
    return { pitch };
  }

  return { fieldSpan: toProjectedOwnedSpan(fieldSpan), pitch };
}

function toProjectedOwnedSpan(fieldSpan: ProjectedSpan): ProjectedOwnedSpan {
  return {
    end: fieldSpan.end,
    start: fieldSpan.start,
  };
}

function getOwningSlice(
  harmonicSlices: ProjectionHarmonicSlice[],
  offset: EventOffset,
): ProjectionHarmonicSlice | undefined {
  return harmonicSlices
    .filter((harmonicSlice) => sliceContainsOffset(harmonicSlice, offset))
    .sort(
      (left, right) =>
        left.duration - right.duration || left.startOffset - right.startOffset,
    )[0];
}

function getOwningFieldSpan(
  spans: ProjectedSpan[],
  pitch: number,
): ProjectedSpan | undefined {
  return spans
    .filter(
      (span) =>
        span.start <= pitch &&
        pitch <= span.end &&
        (pitch - span.start) % 2 === 0,
    )
    .sort(
      (left, right) =>
        left.end - left.start - (right.end - right.start) ||
        left.start - right.start,
    )[0];
}

export function sliceContainsOffset(
  harmonicSlice: Pick<ProjectionHarmonicSlice, "duration" | "startOffset">,
  offset: EventOffset,
): boolean {
  return (
    harmonicSlice.startOffset <= offset &&
    offset < harmonicSlice.startOffset + harmonicSlice.duration
  );
}

function getMedianPitch(pitches: number[]): number {
  const sortedPitches = [...pitches].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedPitches.length / 2);

  if (sortedPitches.length % 2 === 1) {
    return sortedPitches[middleIndex]!;
  }

  return Math.round(
    (sortedPitches[middleIndex - 1]! + sortedPitches[middleIndex]!) / 2,
  );
}

function buildSliceLayoutTimings(
  harmonicSegment: AnalyzedHarmonicSegment,
  totalDuration: number,
  timePositions: ProjectionTimePosition[],
): ProjectionSliceLayout[] {
  return harmonicSegment.harmonicSlices.map((harmonicSlice, index) => ({
    duration: harmonicSlice.duration,
    endX: getBoundaryX(
      timePositions,
      totalDuration,
      harmonicSlice.startOffset + harmonicSlice.duration,
    ),
    harmonic: harmonicSlice.harmonic,
    startOffset: harmonicSlice.startOffset,
    startX: getBoundaryX(
      timePositions,
      totalDuration,
      harmonicSlice.startOffset,
    ),
    touchesSegmentEnd: index === harmonicSegment.harmonicSlices.length - 1,
    touchesSegmentStart: index === 0,
  }));
}

function zipProjectionSegments(
  inputSegments: SegmentInput[],
  harmonicSegments: AnalyzedHarmonicSegment[],
): Array<{
  harmonicSegment: AnalyzedHarmonicSegment;
  index: number;
  segment: SegmentInput;
}> {
  if (inputSegments.length !== harmonicSegments.length) {
    throw new Error(
      `Projection requires one analyzed harmonic segment per input segment (got ${harmonicSegments.length} for ${inputSegments.length}).`,
    );
  }

  return inputSegments.map((segment, index) => ({
    harmonicSegment: harmonicSegments[index]!,
    index,
    segment,
  }));
}

function getBoundaryX(
  timePositions: ProjectionTimePosition[],
  totalDuration: number,
  offset: EventOffset,
): number {
  if (offset <= 0) {
    return 0;
  }

  if (offset >= totalDuration) {
    return 1;
  }

  const exactTimePosition = timePositions.find(
    (timePosition) => timePosition.offset === offset,
  );

  if (exactTimePosition !== undefined) {
    return exactTimePosition.x;
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

function getRestAnchorPitchBySegmentAndLayer(
  input: PieceInput,
): Map<EventLayer, number>[] {
  const pitchesBySegmentAndLayer = input.segments.map((segment) => {
    const pitchesByLayer = new Map<EventLayer, number[]>();

    segment.events.forEach((event) => {
      const pitches = getEventPitches(event);

      if (pitches.length === 0) {
        return;
      }

      const layer = event.layer ?? 0;
      const existingPitches = pitchesByLayer.get(layer) ?? [];

      existingPitches.push(...pitches);
      pitchesByLayer.set(layer, existingPitches);
    });

    return pitchesByLayer;
  });
  const restAnchorPitchBySegmentAndLayer: Map<EventLayer, number>[] = [];

  pitchesBySegmentAndLayer.forEach((_, segmentIndex) => {
    const restAnchorPitchByLayer = new Map<EventLayer, number>();
    const layers = new Set<EventLayer>(
      pitchesBySegmentAndLayer.flatMap((pitchesByLayer) => [
        ...pitchesByLayer.keys(),
      ]),
    );

    layers.forEach((layer) => {
      const weightedPitches = [
        ...getLayerPitches(pitchesBySegmentAndLayer[segmentIndex - 1], layer),
        ...getLayerPitches(pitchesBySegmentAndLayer[segmentIndex], layer),
        ...getLayerPitches(pitchesBySegmentAndLayer[segmentIndex], layer),
        ...getLayerPitches(pitchesBySegmentAndLayer[segmentIndex + 1], layer),
      ];

      if (weightedPitches.length > 0) {
        restAnchorPitchByLayer.set(layer, getMedianPitch(weightedPitches));
        return;
      }

      restAnchorPitchByLayer.set(
        layer,
        getNearestLayerAnchorPitch(
          pitchesBySegmentAndLayer,
          segmentIndex,
          layer,
        ),
      );
    });

    restAnchorPitchBySegmentAndLayer.push(restAnchorPitchByLayer);
  });

  return restAnchorPitchBySegmentAndLayer;
}

function getLayerPitches(
  pitchesByLayer: Map<EventLayer, number[]> | undefined,
  layer: EventLayer,
): number[] {
  return pitchesByLayer?.get(layer) ?? [];
}

function getNearestLayerAnchorPitch(
  pitchesBySegmentAndLayer: Map<EventLayer, number[]>[],
  segmentIndex: number,
  layer: EventLayer,
): number {
  for (
    let distance = 1;
    distance < pitchesBySegmentAndLayer.length;
    distance += 1
  ) {
    const previousPitches = getLayerPitches(
      pitchesBySegmentAndLayer[segmentIndex - distance],
      layer,
    );

    if (previousPitches.length > 0) {
      return getMedianPitch(previousPitches);
    }

    const nextPitches = getLayerPitches(
      pitchesBySegmentAndLayer[segmentIndex + distance],
      layer,
    );

    if (nextPitches.length > 0) {
      return getMedianPitch(nextPitches);
    }
  }

  throw new Error(`Missing pitches for layer ${layer}.`);
}

function getPitchWindow(input: PieceInput): PitchWindow {
  return (
    getPaddedPitchWindow(
      input.segments.flatMap((segment) =>
        segment.events.flatMap(getEventPitches),
      ),
    ) ?? DEFAULT_PITCH_WINDOW
  );
}

function getPaddedPieceWindow(window: PitchWindow): PitchWindow {
  return {
    maxPitch: window.maxPitch + VISIBLE_PITCH_WINDOW_PADDING,
    minPitch: window.minPitch - VISIBLE_PITCH_WINDOW_PADDING,
  };
}

function getPaddedPitchWindow(pitches: number[]): PitchWindow | undefined {
  if (pitches.length === 0) {
    return undefined;
  }

  return {
    maxPitch: Math.max(...pitches) + EVENT_PITCH_WINDOW_PADDING,
    minPitch: Math.min(...pitches) - EVENT_PITCH_WINDOW_PADDING,
  };
}
