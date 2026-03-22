import type { EventOffset, PieceInput } from "../model";
import {
  buildProjectionTimePositions,
  getSegmentWidthUnits,
  type ProjectionTimePosition,
} from "./spacing";

export type ProjectionEvent =
  | {
      duration: number;
      offset: EventOffset;
      pitches: number[];
      type: "pitched";
      x: number;
    }
  | {
      duration: number;
      offset: EventOffset;
      pitch: number;
      type: "rest";
      x: number;
    };

export function buildProjectionEvents(
  segment: PieceInput["segments"][number],
  middlePitch: number,
): {
  events: ProjectionEvent[];
  segmentWidthUnits: number;
  timePositions: ProjectionTimePosition[];
  totalDuration: number;
} {
  const layerOffsets = new Map<number, number>();
  let totalDuration = 0;

  const unpositionedEvents = segment.events.map((event) => {
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

  const spacing = buildProjectionTimePositions(
    unpositionedEvents,
    Math.max(totalDuration, 1),
  );
  const timePositionXByOffset = new Map(
    spacing.timePositions.map((timePosition) => [
      timePosition.offset,
      timePosition.x,
    ]),
  );
  const events = unpositionedEvents.map((event) => ({
    ...event,
    x: timePositionXByOffset.get(event.offset)!,
  }));

  return {
    events,
    segmentWidthUnits: getSegmentWidthUnits(spacing.spacingWeightTotal),
    timePositions: spacing.timePositions,
    totalDuration: Math.max(totalDuration, 1),
  };
}
