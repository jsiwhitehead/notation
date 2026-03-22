import type { EventOffset } from "../model";

const MIN_TIME_POSITION_WEIGHT = 1;
const SEGMENT_WIDTH_UNITS_PER_SPACING_WEIGHT = 2;
const BASE_SEGMENT_WIDTH_UNITS = 15;
const TIME_POSITION_EDGE_WEIGHT = 1;

export type ProjectionTimePosition = {
  maxDuration: number;
  offset: EventOffset;
  x: number;
};

export function buildProjectionTimePositions(
  events: Array<{ duration: number; offset: EventOffset }>,
  totalDuration: number,
): {
  spacingWeightTotal: number;
  timePositions: ProjectionTimePosition[];
} {
  const groupedDurations = new Map<EventOffset, number[]>();

  events.forEach((event) => {
    const durationsAtOffset = groupedDurations.get(event.offset) ?? [];

    durationsAtOffset.push(event.duration);
    groupedDurations.set(event.offset, durationsAtOffset);
  });

  const timePositions = [...groupedDurations.entries()]
    .sort(([leftOffset], [rightOffset]) => leftOffset - rightOffset)
    .map(([offset, durations]) => ({
      maxDuration: Math.max(...durations),
      offset,
      x: 0,
    }));

  if (timePositions.length === 0) {
    return {
      spacingWeightTotal: TIME_POSITION_EDGE_WEIGHT * 2,
      timePositions: [],
    };
  }

  if (timePositions.length === 1) {
    return {
      spacingWeightTotal: TIME_POSITION_EDGE_WEIGHT * 2,
      timePositions: [{ ...timePositions[0]!, x: 0.5 }],
    };
  }

  const intervalWeights = timePositions
    .slice(0, -1)
    .map((timePosition, index) =>
      getTimePositionIntervalWeight(
        timePositions[index + 1]!.offset - timePosition.offset,
        timePosition.maxDuration,
        totalDuration,
      ),
    );
  const spacingWeightTotal =
    TIME_POSITION_EDGE_WEIGHT * 2 +
    intervalWeights.reduce((sum, weight) => sum + weight, 0);
  let accumulatedWeight = TIME_POSITION_EDGE_WEIGHT;

  return {
    timePositions: timePositions.map((timePosition, index) => {
      const positionedTimePosition = {
        ...timePosition,
        x: accumulatedWeight / spacingWeightTotal,
      };

      accumulatedWeight += intervalWeights[index] ?? 0;

      return positionedTimePosition;
    }),
    spacingWeightTotal,
  };
}

export function getSegmentWidthUnits(totalWeight: number): number {
  return (
    BASE_SEGMENT_WIDTH_UNITS +
    Math.max(0, totalWeight - TIME_POSITION_EDGE_WEIGHT * 2) *
      SEGMENT_WIDTH_UNITS_PER_SPACING_WEIGHT
  );
}

function getTimePositionIntervalWeight(
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
