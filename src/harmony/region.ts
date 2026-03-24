import {
  buildToneSpacedPitchClassSpans,
  getCircularInterval12,
  getOrderedFifthsPositions,
  mod12,
  toFifthsPosition,
  toPitchClassFromFifthsPosition,
  uniqueSortedPitchClasses,
} from "../pitch";

import type { HarmonicRegion, HarmonicRegionSpan, PitchClass } from "../model";

const MIN_SETTLED_REGION_EVIDENCE = 3;
const MAX_GAP_FILL_SIZE = 3;

export function uniqueFifthsOrderedPitchClasses(
  values: PitchClass[],
): PitchClass[] {
  return [...new Set(values)].sort(
    (left, right) =>
      toFifthsPosition(left) - toFifthsPosition(right) || left - right,
  );
}

function fillFifthsGaps(
  pitchClasses: PitchClass[],
  maxGapFillSize: number,
): PitchClass[] {
  const positions = getOrderedFifthsPositions(pitchClasses);
  const filled = new Set(positions);

  positions.forEach((position, index) => {
    const nextPosition = positions[(index + 1) % positions.length]!;
    const gap = getCircularInterval12(position, nextPosition);

    if (gap <= 1 || gap > maxGapFillSize) {
      return;
    }

    for (let step = 1; step < gap; step += 1) {
      filled.add(mod12(position + step));
    }
  });

  return uniqueSortedPitchClasses(
    [...filled].map(toPitchClassFromFifthsPosition),
  );
}

function fillUniqueDyadFifthsPath(evidence: PitchClass[]): PitchClass[] {
  const positions = getOrderedFifthsPositions(evidence);

  if (positions.length !== 2) {
    return uniqueSortedPitchClasses(evidence);
  }

  const [left, right] = positions;
  const forwardGap = getCircularInterval12(left!, right!);

  if (forwardGap === 6) {
    return uniqueSortedPitchClasses(evidence);
  }

  const start = forwardGap < 6 ? left! : right!;
  const stepCount = forwardGap < 6 ? forwardGap : 12 - forwardGap;

  return uniqueSortedPitchClasses(
    Array.from({ length: stepCount + 1 }, (_, index) =>
      toPitchClassFromFifthsPosition(mod12(start + index)),
    ),
  );
}

function fillUniqueMinimalFifthsRun(evidence: PitchClass[]): PitchClass[] {
  const positions = getOrderedFifthsPositions(evidence);

  if (positions.length < 2) {
    return uniqueSortedPitchClasses(evidence);
  }

  let largestGap = -1;
  let largestGapEnd = positions[0]!;
  let largestGapCount = 0;

  positions.forEach((position, index) => {
    const nextPosition = positions[(index + 1) % positions.length]!;
    const gap = getCircularInterval12(position, nextPosition);

    if (gap > largestGap) {
      largestGap = gap;
      largestGapEnd = nextPosition;
      largestGapCount = 1;
      return;
    }

    if (gap === largestGap) {
      largestGapCount += 1;
    }
  });

  const runLength = 12 - largestGap;

  if (largestGapCount !== 1 || runLength > 6) {
    return uniqueSortedPitchClasses(evidence);
  }

  return uniqueSortedPitchClasses(
    Array.from({ length: runLength + 1 }, (_, index) =>
      toPitchClassFromFifthsPosition(mod12(largestGapEnd + index)),
    ),
  );
}

export function isBaselineValidRegion(pitchClasses: PitchClass[]): boolean {
  return getCanonicalPairLanes(pitchClasses) !== undefined;
}

function areDisjointOrderedSpans(
  left: HarmonicRegionSpan,
  right: HarmonicRegionSpan,
): boolean {
  return left.end < right.start;
}

function isTwoApartFifthsRun(pitchClasses: PitchClass[]): boolean {
  return pitchClasses.every((pitchClass, index) => {
    if (index === 0) {
      return true;
    }

    return (
      mod12(
        toFifthsPosition(pitchClass) -
          toFifthsPosition(pitchClasses[index - 1]!),
      ) === 2
    );
  });
}

function getCircularFifthsOrderedPitchClasses(
  pitchClasses: PitchClass[],
): PitchClass[] {
  const positions = getOrderedFifthsPositions(pitchClasses);

  if (positions.length < 2) {
    return positions.map(toPitchClassFromFifthsPosition);
  }

  let largestGap = -1;
  let largestGapStart = positions[0]!;
  let largestGapEnd = positions[0]!;

  positions.forEach((position, index) => {
    const nextPosition = positions[(index + 1) % positions.length]!;
    const gap = getCircularInterval12(position, nextPosition);

    if (gap > largestGap) {
      largestGap = gap;
      largestGapStart = position;
      largestGapEnd = nextPosition;
    }
  });

  const startIndex = positions.indexOf(largestGapEnd);
  const orderedPositions = [
    ...positions.slice(startIndex),
    ...positions.slice(0, startIndex),
  ];

  void largestGapStart;

  return orderedPositions.map(toPitchClassFromFifthsPosition);
}

function getCanonicalPairLanes(
  pitchClasses: PitchClass[],
): [HarmonicRegionSpan, HarmonicRegionSpan] | undefined {
  const contiguousSpans = buildToneSpacedPitchClassSpans(pitchClasses);

  if (contiguousSpans.length === 2) {
    return [...contiguousSpans].sort(
      (left, right) => left.start - right.start || left.end - right.end,
    ) as [HarmonicRegionSpan, HarmonicRegionSpan];
  }

  const orderedPitchClasses =
    getCircularFifthsOrderedPitchClasses(pitchClasses);

  if (orderedPitchClasses.length < 2) {
    return undefined;
  }

  const lanePitchClasses: [PitchClass[], PitchClass[]] = [[], []];

  orderedPitchClasses.forEach((pitchClass, index) => {
    lanePitchClasses[index % 2]!.push(pitchClass);
  });

  const laneSpans = lanePitchClasses.map((lanePitchClassesForSpan) => {
    if (
      lanePitchClassesForSpan.length === 0 ||
      !isTwoApartFifthsRun(lanePitchClassesForSpan)
    ) {
      return undefined;
    }

    const spans = buildToneSpacedPitchClassSpans(lanePitchClassesForSpan);

    return spans.length === 1 ? spans[0] : undefined;
  }) as [HarmonicRegionSpan | undefined, HarmonicRegionSpan | undefined];

  if (laneSpans[0] === undefined || laneSpans[1] === undefined) {
    return undefined;
  }

  const definedLaneSpans = [laneSpans[0], laneSpans[1]];
  const sortedLaneSpans = definedLaneSpans.sort(
    (left, right) => left.start - right.start || left.end - right.end,
  ) as [HarmonicRegionSpan, HarmonicRegionSpan];

  if (!areDisjointOrderedSpans(sortedLaneSpans[0], sortedLaneSpans[1])) {
    return undefined;
  }

  return sortedLaneSpans;
}

function getCanonicalLanes(pitchClasses: PitchClass[]): HarmonicRegionSpan[] {
  return (
    getCanonicalPairLanes(pitchClasses) ??
    buildToneSpacedPitchClassSpans(pitchClasses)
  );
}

export function buildRegion(evidence: PitchClass[]): HarmonicRegion {
  const pitchClasses = uniqueFifthsOrderedPitchClasses(evidence);
  const lanes = getCanonicalLanes(pitchClasses);

  return {
    lanes,
    pitchClasses,
  };
}

export function getFilledFifthsRegion(evidence: PitchClass[]): PitchClass[] {
  const uniquelyBoundedRunPitchClasses = fillUniqueMinimalFifthsRun(evidence);

  if (uniquelyBoundedRunPitchClasses.length !== evidence.length) {
    return uniquelyBoundedRunPitchClasses;
  }

  if (evidence.length === 2) {
    return fillUniqueDyadFifthsPath(evidence);
  }

  if (evidence.length < MIN_SETTLED_REGION_EVIDENCE) {
    return uniqueSortedPitchClasses(evidence);
  }

  return fillFifthsGaps(evidence, MAX_GAP_FILL_SIZE);
}

export function buildCenterFromPitchClasses(
  directPitchClasses: PitchClass[],
  eventPitchClasses: PitchClass[],
): HarmonicRegion {
  const filledPitchClasses = getFilledFifthsRegion(directPitchClasses);

  if (!isBaselineValidRegion(filledPitchClasses)) {
    if (
      eventPitchClasses.length > 0 &&
      isBaselineValidRegion(directPitchClasses)
    ) {
      return buildRegion(directPitchClasses);
    }

    return buildRegion([]);
  }

  return buildRegion(filledPitchClasses);
}
