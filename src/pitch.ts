import type { EventInput, PitchClass } from "./model";

const FIFTHS_CYCLE_SIZE = 12;

export function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function mod12(value: number): number {
  return mod(value, 12);
}

function getCircularInterval(start: number, end: number, size: number): number {
  return mod(end - start, size);
}

export function toPitchClass(value: number): PitchClass {
  return mod12(value);
}

export function toFifthsPosition(pitchClass: PitchClass): number {
  return (toPitchClass(pitchClass) * 7) % FIFTHS_CYCLE_SIZE;
}

export function uniqueSortedPitchClasses(values: PitchClass[]): PitchClass[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

export function uniqueFifthsOrderedPitchClasses(
  values: PitchClass[],
): PitchClass[] {
  return [...new Set(values)].sort(
    (left, right) =>
      toFifthsPosition(left) - toFifthsPosition(right) || left - right,
  );
}

export function toPitchClassFromFifthsPosition(position: number): PitchClass {
  return toPitchClass(position * 7);
}

export function getOrderedFifthsPositions(
  pitchClasses: PitchClass[],
): number[] {
  return [...new Set(pitchClasses.map(toFifthsPosition))].sort(
    (left, right) => left - right,
  );
}

export function getLargestFifthsGap(
  positions: number[],
): { end: number; size: number; start: number } | undefined {
  if (positions.length === 0) {
    return undefined;
  }

  let largestGap = -1;
  let largestGapStart = positions[0]!;
  let largestGapEnd = positions[0]!;

  positions.forEach((position, index) => {
    const nextPosition = positions[(index + 1) % positions.length]!;
    const gap = getCircularInterval(position, nextPosition, FIFTHS_CYCLE_SIZE);

    if (gap > largestGap) {
      largestGap = gap;
      largestGapStart = position;
      largestGapEnd = nextPosition;
    }
  });

  return {
    end: largestGapEnd,
    size: largestGap,
    start: largestGapStart,
  };
}

export function fillFifthsGaps(
  pitchClasses: PitchClass[],
  maxGapFillSize: number,
): PitchClass[] {
  const positions = getOrderedFifthsPositions(pitchClasses);
  const filled = new Set(positions);

  positions.forEach((position, index) => {
    const nextPosition = positions[(index + 1) % positions.length]!;
    const gap = getCircularInterval(position, nextPosition, FIFTHS_CYCLE_SIZE);

    if (gap <= 1 || gap > maxGapFillSize) {
      return;
    }

    for (let step = 1; step < gap; step += 1) {
      filled.add(mod(position + step, FIFTHS_CYCLE_SIZE));
    }
  });

  return uniqueSortedPitchClasses(
    [...filled].map(toPitchClassFromFifthsPosition),
  );
}

export function hasAdjacentSemitonePairs(pitchClasses: PitchClass[]): boolean {
  const sorted = uniqueSortedPitchClasses(pitchClasses);

  if (sorted.length < 3) {
    return false;
  }

  const intervals = sorted.map((pitchClass, index) => {
    const nextPitchClass = sorted[(index + 1) % sorted.length]!;

    return getCircularInterval(pitchClass, nextPitchClass, 12);
  });

  return intervals.some(
    (interval, index) =>
      interval === 1 && intervals[(index + 1) % intervals.length] === 1,
  );
}

export function getRegionMidpointInHalfFifths(
  pitchClasses: PitchClass[],
): number | undefined {
  const positions = getOrderedFifthsPositions(pitchClasses);

  if (positions.length === 0) {
    return undefined;
  }

  if (positions.length === 1) {
    return mod(positions[0]! * 2, 24);
  }

  const largestGap = getLargestFifthsGap(positions)!;
  const regionStart = largestGap.end;
  const regionSpan = getCircularInterval(
    regionStart,
    largestGap.start,
    FIFTHS_CYCLE_SIZE,
  );

  return mod(regionStart * 2 + regionSpan, 24);
}

export function repeatPitchClassesAcrossRange(
  maxPitch: number,
  minPitch: number,
  pitchClasses: PitchClass[],
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

export function getEventPitches(event: EventInput): number[] {
  switch (event.type) {
    case "note":
      return [event.pitch];
    case "chord":
      return event.pitches;
    case "rest":
      return [];
  }
}

export function getEventPitchClasses(event: EventInput): PitchClass[] {
  return getEventPitches(event).map(toPitchClass);
}
