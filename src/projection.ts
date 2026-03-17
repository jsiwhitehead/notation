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

export type ProjectionSegment = {
  center: HarmonicRegion;
  field: HarmonicRegion;
  grounding: Grounding | undefined;
  index: number;
  events: ProjectionEvent[];
  totalDuration: number;
};

export type Projection = {
  maxPitch: number;
  minPitch: number;
  segments: ProjectionSegment[];
};

export type FieldSpan = {
  end: PitchClass;
  start: PitchClass;
};

export type GroundingMark = {
  pitch: number;
  type: "ground" | "root";
};

export function buildProjection(
  input: PieceInput,
  harmonicStructure: HarmonicStructure,
): Projection {
  const pitchRange = getPitchRange(input);
  const middlePitch = Math.round((pitchRange.max + pitchRange.min) / 2);

  return {
    maxPitch: pitchRange.max,
    minPitch: pitchRange.min,
    segments: input.segments.map((segment, index) => {
      const harmonicSegment = harmonicStructure.segments[index]!;
      const events = buildProjectionEvents(segment, middlePitch);

      return {
        center: harmonicSegment.center,
        events: events.events,
        field: harmonicSegment.field,
        grounding: harmonicSegment.grounding,
        index,
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

export function buildFieldSpans(region: HarmonicRegion): FieldSpan[] {
  if (region.pitchClasses.length === 0) {
    return [];
  }

  const sortedPitchClasses = [...region.pitchClasses].sort(
    (left, right) => left - right,
  );
  const spans: FieldSpan[] = [
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

export function repeatFieldSpansAcrossRange(
  maxPitch: number,
  minPitch: number,
  fieldSpan: FieldSpan,
): FieldSpan[] {
  const repeated: FieldSpan[] = [];

  for (
    let octaveBase = Math.floor(minPitch / 12) * 12;
    octaveBase <= maxPitch;
    octaveBase += 12
  ) {
    const startPitch = octaveBase + fieldSpan.start;
    const endPitch = octaveBase + fieldSpan.end;

    if (startPitch > maxPitch || endPitch < minPitch) {
      continue;
    }

    repeated.push({
      end: Math.min(Math.max(startPitch, endPitch), maxPitch),
      start: Math.max(Math.min(startPitch, endPitch), minPitch),
    });
  }

  return repeated;
}

export function buildGroundingMarks(
  projection: Projection,
  segment: ProjectionSegment,
): GroundingMark[] {
  if (segment.grounding === undefined) {
    return [];
  }

  const rootMarks = repeatPitchClassesAcrossRange(
    projection.maxPitch,
    projection.minPitch,
    [segment.grounding.root],
  ).map((pitch) => ({
    pitch,
    type: "root" as const,
  }));
  const groundMarks = repeatPitchClassesAcrossRange(
    projection.maxPitch,
    projection.minPitch,
    [segment.grounding.ground],
  ).map((pitch) => ({
    pitch,
    type: "ground" as const,
  }));

  return [...rootMarks, ...groundMarks].sort(
    (left, right) => left.pitch - right.pitch,
  );
}

function getPitchRange(input: PieceInput): { max: number; min: number } {
  const pitches = input.segments.flatMap((segment) =>
    segment.events.flatMap(getEventPitches),
  );

  if (pitches.length === 0) {
    return { max: 71, min: 60 };
  }

  return {
    max: Math.max(...pitches) + STAFF_PADDING,
    min: Math.min(...pitches) - STAFF_PADDING,
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
