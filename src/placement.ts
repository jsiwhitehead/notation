import type { Grounding, HarmonicOutput } from "./engine";
import type { EventOffset, HarmonicRegion, PieceInput } from "./model";

const STAFF_PADDING = 1;

export type PositionedEvent =
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

export type PositionedSegment = {
  corePitchClasses: number[];
  grounding: Grounding | undefined;
  index: number;
  positionedEvents: PositionedEvent[];
  regions: HarmonicRegion[];
  totalDuration: number;
};

export type Placement = {
  maxPitch: number;
  minPitch: number;
  segments: PositionedSegment[];
};

function getPitchRange(input: PieceInput): { max: number; min: number } {
  const pitches = input.segments.flatMap((segment) =>
    segment.events.flatMap((event) => {
      switch (event.type) {
        case "note":
          return [event.pitch];
        case "chord":
          return event.pitches;
        case "rest":
          return [];
      }
    }),
  );

  if (pitches.length === 0) {
    return { max: 71, min: 60 };
  }

  return {
    max: Math.max(...pitches) + STAFF_PADDING,
    min: Math.min(...pitches) - STAFF_PADDING,
  };
}

function buildPlacedEvents(
  segment: PieceInput["segments"][number],
  middlePitch: number,
): { positionedEvents: PositionedEvent[]; totalDuration: number } {
  const layerOffsets = new Map<number, number>();
  let totalDuration = 0;

  const positionedEvents = segment.events.map((event) => {
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
    positionedEvents,
    totalDuration: Math.max(totalDuration, 1),
  };
}

export function buildPlacement(
  input: PieceInput,
  harmonicOutput: HarmonicOutput,
): Placement {
  const pitchRange = getPitchRange(input);
  const middlePitch = Math.round((pitchRange.max + pitchRange.min) / 2);

  return {
    maxPitch: pitchRange.max,
    minPitch: pitchRange.min,
    segments: input.segments.map((segment, index) => {
      const harmonicSegment = harmonicOutput.segments[index]!;
      const placedEvents = buildPlacedEvents(segment, middlePitch);

      return {
        corePitchClasses: harmonicSegment.core,
        grounding: harmonicSegment.grounding,
        index,
        positionedEvents: placedEvents.positionedEvents,
        regions: harmonicSegment.regions,
        totalDuration: placedEvents.totalDuration,
      };
    }),
  };
}
