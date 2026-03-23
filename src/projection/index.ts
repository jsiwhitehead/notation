import type {
  EventLayer,
  Grounding,
  HarmonicRegion,
  HarmonicStructure,
  PieceInput,
  TimeSignature,
} from "../model";
import { getEventPitches } from "../pitch";
import { buildProjectionEvents, type ProjectionEvent } from "./events";
import {
  buildProjectedGroundingOverlays,
  type ProjectedGroundingOverlay,
} from "./grounding";
import type { ProjectionTimePosition } from "./spacing";
import {
  buildLinkedProjectedRegions,
  type ProjectedRegion,
  type PitchWindow,
} from "./spans";

const EVENT_PITCH_WINDOW_PADDING = 1;
const VISIBLE_PITCH_WINDOW_PADDING = 1;
const DEFAULT_PITCH_WINDOW: PitchWindow = { maxPitch: 71, minPitch: 60 };

type ProjectionPlacement = {
  center: ProjectedRegion;
  field: ProjectedRegion;
  projectedGroundingOverlay: ProjectedGroundingOverlay | undefined;
  restAnchorPitch: number;
};

type ProjectionHarmonic = {
  center: HarmonicRegion;
  field: HarmonicRegion;
  grounding: Grounding | undefined;
};

export type ProjectionSegment = {
  harmonic: ProjectionHarmonic;
  index: number;
  events: ProjectionEvent[];
  placement: ProjectionPlacement;
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
export type { ProjectionEvent } from "./events";

export function buildProjection(
  input: PieceInput,
  harmonicStructure: HarmonicStructure,
): Projection {
  const visibleWindow = getPaddedPieceWindow(getPitchWindow(input));
  const restAnchorPitchBySegmentAndLayer =
    getRestAnchorPitchBySegmentAndLayer(input);
  const projectedPlacements = buildProjectedPlacements(
    harmonicStructure,
    restAnchorPitchBySegmentAndLayer,
    visibleWindow,
  );
  const segments: ProjectionSegment[] = input.segments.map((segment, index) => {
    const harmonicSegment = harmonicStructure.segments[index]!;
    const placement = projectedPlacements[index]!;
    const projectedEvents = buildProjectionEvents(
      segment,
      restAnchorPitchBySegmentAndLayer[index]!,
    );

    return {
      events: projectedEvents.events,
      harmonic: {
        center: harmonicSegment.center,
        field: harmonicSegment.field,
        grounding: harmonicSegment.grounding,
      },
      index,
      placement,
      segmentWidthUnits: projectedEvents.segmentWidthUnits,
      timeSignature: segment.timeSignature,
      timePositions: projectedEvents.timePositions,
      totalDuration: projectedEvents.totalDuration,
    };
  });

  return {
    maxPitch: visibleWindow.maxPitch,
    minPitch: visibleWindow.minPitch,
    segments,
  };
}

function buildProjectedPlacements(
  harmonicStructure: HarmonicStructure,
  restAnchorPitchBySegmentAndLayer: Map<EventLayer, number>[],
  visibleWindow: PitchWindow,
): ProjectionPlacement[] {
  const projectedCenters = buildLinkedProjectedRegions(
    harmonicStructure.segments.map((segment) => segment.center),
    visibleWindow,
  );
  const projectedFields = buildLinkedProjectedRegions(
    harmonicStructure.segments.map((segment) => segment.field),
    visibleWindow,
  );
  const projectedGroundingOverlays = buildProjectedGroundingOverlays(
    harmonicStructure,
    projectedCenters,
    projectedFields,
  );

  return harmonicStructure.segments.map((_, index) => ({
    center: projectedCenters[index]!,
    field: projectedFields[index]!,
    projectedGroundingOverlay: projectedGroundingOverlays[index],
    restAnchorPitch: restAnchorPitchBySegmentAndLayer[index]!.get(0)!,
  }));
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
