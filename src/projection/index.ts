import type {
  EventOffset,
  Grounding,
  HarmonicRegion,
  HarmonicStructure,
  PitchClass,
  PieceInput,
} from "../model";
import { getEventPitches, repeatPitchClassesAcrossRange } from "../pitch";
import {
  buildLinkedProjectedRegions,
  type ProjectedRegion,
  type PitchWindow,
} from "./spans";

const EVENT_PITCH_WINDOW_PADDING = 1;
const VISIBLE_PITCH_WINDOW_PADDING = 1;
const DEFAULT_PITCH_WINDOW: PitchWindow = { maxPitch: 71, minPitch: 60 };

export type ProjectionEvent =
  | {
      duration: number;
      offset: EventOffset;
      pitches: number[];
      type: "pitched";
    }
  | {
      duration: number;
      offset: EventOffset;
      pitch: number;
      type: "rest";
    };

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
  totalDuration: number;
};

export type Projection = {
  maxPitch: number;
  minPitch: number;
  segments: ProjectionSegment[];
};

type ProjectedGroundingMark = {
  pitch: number;
  type: "ground" | "root";
};

type ProjectedGroundingOverlay = {
  marks: ProjectedGroundingMark[];
  groundPitchClass: PitchClass;
  rootPitchClass: PitchClass;
};

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
    const events = buildProjectionEvents(segment, placement.restAnchorPitch);

    return {
      events: events.events,
      harmonic: {
        center: harmonicSegment.center,
        field: harmonicSegment.field,
        grounding: harmonicSegment.grounding,
      },
      index,
      placement,
      totalDuration: events.totalDuration,
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

function buildProjectedGroundingOverlays(
  harmonicStructure: HarmonicStructure,
  projectedCenters: ProjectedRegion[],
  projectedFields: ProjectedRegion[],
): (ProjectedGroundingOverlay | undefined)[] {
  return harmonicStructure.segments.map((segment, index) =>
    buildProjectedGroundingOverlay(
      segment.grounding,
      getProjectedGroundingWindow(
        projectedCenters[index]!,
        projectedFields[index]!,
      ),
    ),
  );
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

function buildProjectedGroundingOverlay(
  grounding: Grounding | undefined,
  projectedGroundingWindow: PitchWindow | undefined,
): ProjectedGroundingOverlay | undefined {
  if (grounding === undefined || projectedGroundingWindow === undefined) {
    return undefined;
  }

  return {
    marks: [
      ...buildProjectedGroundingMarks(
        projectedGroundingWindow,
        grounding.root,
        "root",
      ),
      ...buildProjectedGroundingMarks(
        projectedGroundingWindow,
        grounding.ground,
        "ground",
      ),
    ].sort((left, right) => left.pitch - right.pitch),
    groundPitchClass: grounding.ground,
    rootPitchClass: grounding.root,
  };
}

function buildProjectedGroundingMarks(
  projectedGroundingWindow: PitchWindow,
  pitchClass: PitchClass,
  type: ProjectedGroundingMark["type"],
): ProjectedGroundingMark[] {
  return repeatPitchClassesAcrossRange(
    projectedGroundingWindow.maxPitch,
    projectedGroundingWindow.minPitch,
    [pitchClass],
  ).map((pitch) => ({
    pitch,
    type,
  }));
}

function getProjectedGroundingWindow(
  projectedCenter: ProjectedRegion,
  projectedField: ProjectedRegion,
): PitchWindow | undefined {
  const projectedSpans = [...projectedCenter.spans, ...projectedField.spans];

  if (projectedSpans.length === 0) {
    return undefined;
  }

  return {
    maxPitch: Math.max(...projectedSpans.map((span) => span.end)),
    minPitch: Math.min(...projectedSpans.map((span) => span.start)),
  };
}

function buildProjectionEvents(
  segment: PieceInput["segments"][number],
  middlePitch: number,
): { events: ProjectionEvent[]; totalDuration: number } {
  const layerOffsets = new Map<number, number>();
  let totalDuration = 0;

  const events = segment.events.map((event) => {
    const layer = event.layer ?? 0;
    const inferredOffset = layerOffsets.get(layer) ?? 0;
    const offset = event.offset ?? inferredOffset;
    const eventEnd = offset + event.duration;

    layerOffsets.set(layer, eventEnd);
    totalDuration = Math.max(totalDuration, eventEnd);

    switch (event.type) {
      case "note":
        return {
          duration: event.duration,
          offset,
          pitches: [event.pitch],
          type: "pitched" as const,
        };
      case "chord":
        return {
          duration: event.duration,
          offset,
          pitches: event.pitches,
          type: "pitched" as const,
        };
      case "rest":
        return {
          duration: event.duration,
          offset,
          pitch: middlePitch,
          type: "rest" as const,
        };
    }
  });

  return {
    events,
    totalDuration: Math.max(totalDuration, 1),
  };
}
