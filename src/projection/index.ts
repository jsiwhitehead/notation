import type {
  Grounding,
  HarmonicRegion,
  HarmonicStructure,
  PieceInput,
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
  const projectedPlacements = buildProjectedPlacements(
    harmonicStructure,
    visibleWindow,
  );
  const segments: ProjectionSegment[] = input.segments.map((segment, index) => {
    const harmonicSegment = harmonicStructure.segments[index]!;
    const placement = projectedPlacements[index]!;
    const projectedEvents = buildProjectionEvents(
      segment,
      placement.restAnchorPitch,
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
    restAnchorPitch: Math.round(
      (visibleWindow.maxPitch + visibleWindow.minPitch) / 2,
    ),
  }));
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
