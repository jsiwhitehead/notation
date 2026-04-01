import type { EventInput, PitchClass } from "./model";

const FIFTHS_CYCLE_SIZE = 12;

export function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function mod12(value: number): number {
  return mod(value, 12);
}

function getCircularInterval(start: number, end: number, size: number): number {
  return mod(end - start, size);
}

export function getCircularInterval12(start: number, end: number): number {
  return getCircularInterval(start, end, 12);
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

function getLargestFifthsGap(
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

type ToneSpacedPitchClassSpan = {
  end: number;
  start: number;
};

export function buildToneSpacedPitchClassSpans(
  pitchClasses: PitchClass[],
): ToneSpacedPitchClassSpan[] {
  if (pitchClasses.length === 0) {
    return [];
  }

  const sortedPitchClasses = [...new Set(pitchClasses)].sort(
    (left, right) => left - right,
  );
  const spans: ToneSpacedPitchClassSpan[] = [
    { end: sortedPitchClasses[0]!, start: sortedPitchClasses[0]! },
  ];

  sortedPitchClasses.slice(1).forEach((pitchClass) => {
    const currentSpan = spans[spans.length - 1]!;

    if (pitchClass - currentSpan.end === 2) {
      currentSpan.end = pitchClass;
      return;
    }

    spans.push({ end: pitchClass, start: pitchClass });
  });

  if (
    spans.length > 1 &&
    sortedPitchClasses[0]! + 12 - spans[spans.length - 1]!.end === 2
  ) {
    spans[spans.length - 1]!.end = spans[0]!.end + 12;
    spans.shift();
  }

  return spans;
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
  const largestGapCount = positions.reduce((count, position, index) => {
    const nextPosition = positions[(index + 1) % positions.length]!;

    return (
      count +
      Number(
        getCircularInterval(position, nextPosition, FIFTHS_CYCLE_SIZE) ===
          largestGap.size,
      )
    );
  }, 0);

  if (largestGapCount !== 1) {
    return undefined;
  }

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
