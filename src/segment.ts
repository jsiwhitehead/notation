import type { SegmentInput } from "./model";

export function getSegmentTotalDuration(segment: SegmentInput): number {
  const layerOffsets = new Map<number, number>();
  let totalDuration = 0;

  segment.events.forEach((event) => {
    const layer = event.layer ?? 0;
    const inferredOffset = layerOffsets.get(layer) ?? 0;
    const offset = event.offset ?? inferredOffset;
    const eventEnd = offset + event.duration;

    layerOffsets.set(layer, eventEnd);
    totalDuration = Math.max(totalDuration, eventEnd);
  });

  return Math.max(totalDuration, 1);
}
