import type {
  EventOffset,
  Grounding,
  HarmonicRegion,
  HarmonicStructure,
  PieceInput,
  PitchClass,
} from "./model";
import { getEventPitches } from "./pitch";

const STAFF_PADDING = 1;
const REST_ONLY_WINDOW_RADIUS = 5;
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

export type PitchWindow = {
  maxPitch: number;
  minPitch: number;
};

export type ProjectionPlacement = {
  centerSpans: RegionSpan[];
  fieldSpans: RegionSpan[];
  groundingMarks: GroundingMark[];
  restPitch: number;
  visibleWindow: PitchWindow;
};

export type ProjectionHarmonic = {
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

export type RegionSpanClass = {
  end: PitchClass;
  start: PitchClass;
};

export type RegionSpan = {
  end: number;
  start: number;
};

export type GroundingMark = {
  pitch: number;
  type: "ground" | "root";
};

export function buildProjection(
  input: PieceInput,
  harmonicStructure: HarmonicStructure,
): Projection {
  const segmentWindows = buildSegmentWindows(input, getPitchWindow(input));
  const projectionWindow = getCombinedPitchWindow(segmentWindows);

  return {
    maxPitch: projectionWindow.maxPitch,
    minPitch: projectionWindow.minPitch,
    segments: input.segments.map((segment, index) => {
      const harmonicSegment = harmonicStructure.segments[index]!;
      const segmentWindow = segmentWindows[index]!;
      const placement = buildProjectionPlacement(
        harmonicSegment,
        segmentWindow,
      );
      const events = buildProjectionEvents(segment, placement.restPitch);

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
    }),
  };
}

export function repeatPitchClassesAcrossRange(
  maxPitch: number,
  minPitch: number,
  pitchClasses: number[],
): number[] {
  const repeated: number[] = [];

  pitchClasses.forEach((pitchClass) => {
    for (
      let pitch = Math.floor(minPitch / 12) * 12 + pitchClass;
      pitch <= maxPitch;
      pitch += 12
    ) {
      if (pitch >= minPitch) {
        repeated.push(pitch);
      }
    }
  });

  return repeated.sort((left, right) => left - right);
}

export function buildRegionSpanClasses(
  region: HarmonicRegion,
): RegionSpanClass[] {
  if (region.pitchClasses.length === 0) {
    return [];
  }

  const sortedPitchClasses = [...region.pitchClasses].sort(
    (left, right) => left - right,
  );
  const spans: RegionSpanClass[] = [
    { end: sortedPitchClasses[0]!, start: sortedPitchClasses[0]! },
  ];

  sortedPitchClasses.slice(1).forEach((pitchClass) => {
    const currentSpan = spans[spans.length - 1]!;

    if (pitchClass - currentSpan.end <= 2) {
      currentSpan.end = pitchClass;
      return;
    }

    spans.push({ end: pitchClass, start: pitchClass });
  });

  return spans;
}

export function repeatRegionSpanClassesAcrossRange(
  visibleWindow: PitchWindow,
  regionSpanClass: RegionSpanClass,
): RegionSpan[] {
  const repeated: RegionSpan[] = [];

  for (
    let octaveBase = Math.floor(visibleWindow.minPitch / 12) * 12;
    octaveBase <= visibleWindow.maxPitch;
    octaveBase += 12
  ) {
    const startPitch = octaveBase + regionSpanClass.start;
    const endPitch = octaveBase + regionSpanClass.end;

    if (
      startPitch > visibleWindow.maxPitch ||
      endPitch < visibleWindow.minPitch
    ) {
      continue;
    }

    repeated.push({
      end: Math.min(Math.max(startPitch, endPitch), visibleWindow.maxPitch),
      start: Math.max(Math.min(startPitch, endPitch), visibleWindow.minPitch),
    });
  }

  return repeated;
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

function buildSegmentWindows(
  input: PieceInput,
  piecePitchWindow: PitchWindow,
): PitchWindow[] {
  const segmentPitchRanges = input.segments.map((segment) => {
    return getPaddedPitchWindow(segment.events.flatMap(getEventPitches));
  });

  return input.segments.map((_, index) => {
    const directRange = segmentPitchRanges[index];

    if (directRange !== undefined) {
      return directRange;
    }

    const nearestRange = findNearestSegmentPitchRange(
      segmentPitchRanges,
      index,
    );
    const baseRange = nearestRange ?? {
      maxPitch: piecePitchWindow.maxPitch,
      minPitch: piecePitchWindow.minPitch,
    };
    const middle = Math.round((baseRange.maxPitch + baseRange.minPitch) / 2);

    return {
      maxPitch: Math.max(baseRange.maxPitch, middle + REST_ONLY_WINDOW_RADIUS),
      minPitch: Math.min(baseRange.minPitch, middle - REST_ONLY_WINDOW_RADIUS),
    };
  });
}

function findNearestSegmentPitchRange(
  segmentPitchRanges: Array<PitchWindow | undefined>,
  index: number,
): PitchWindow | undefined {
  for (let distance = 1; distance < segmentPitchRanges.length; distance += 1) {
    const left = segmentPitchRanges[index - distance];

    if (left !== undefined) {
      return left;
    }

    const right = segmentPitchRanges[index + distance];

    if (right !== undefined) {
      return right;
    }
  }

  return undefined;
}

function getCombinedPitchWindow(windows: PitchWindow[]): PitchWindow {
  return {
    maxPitch: Math.max(...windows.map((window) => window.maxPitch)),
    minPitch: Math.min(...windows.map((window) => window.minPitch)),
  };
}

function buildProjectionPlacement(
  harmonicSegment: HarmonicStructure["segments"][number],
  visibleWindow: PitchWindow,
): ProjectionPlacement {
  return {
    centerSpans: buildRegionSpans(harmonicSegment.center, visibleWindow),
    fieldSpans: buildRegionSpans(harmonicSegment.field, visibleWindow),
    groundingMarks: getGroundingMarksForRange(
      visibleWindow.maxPitch,
      visibleWindow.minPitch,
      harmonicSegment.grounding,
    ),
    restPitch: Math.round(
      (visibleWindow.maxPitch + visibleWindow.minPitch) / 2,
    ),
    visibleWindow,
  };
}

function buildRegionSpans(
  region: HarmonicRegion,
  visibleWindow: PitchWindow,
): RegionSpan[] {
  return buildRegionSpanClasses(region).flatMap((regionSpanClass) =>
    repeatRegionSpanClassesAcrossRange(visibleWindow, regionSpanClass),
  );
}

function getPaddedPitchWindow(pitches: number[]): PitchWindow | undefined {
  if (pitches.length === 0) {
    return undefined;
  }

  return {
    maxPitch: Math.max(...pitches) + STAFF_PADDING,
    minPitch: Math.min(...pitches) - STAFF_PADDING,
  };
}

function getGroundingMarksForRange(
  maxPitch: number,
  minPitch: number,
  grounding: Grounding | undefined,
): GroundingMark[] {
  if (grounding === undefined) {
    return [];
  }

  const rootMarks = repeatPitchClassesAcrossRange(maxPitch, minPitch, [
    grounding.root,
  ]).map((pitch) => ({
    pitch,
    type: "root" as const,
  }));
  const groundMarks = repeatPitchClassesAcrossRange(maxPitch, minPitch, [
    grounding.ground,
  ]).map((pitch) => ({
    pitch,
    type: "ground" as const,
  }));

  return [...rootMarks, ...groundMarks].sort(
    (left, right) => left.pitch - right.pitch,
  );
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
