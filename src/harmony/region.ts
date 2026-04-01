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

function uniqueFifthsOrderedPitchClasses(
  values: PitchClass[],
): PitchClass[] {
  return [...new Set(values)].sort(
    (left, right) =>
      toFifthsPosition(left) - toFifthsPosition(right) || left - right,
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

function areDisjointRepeatedSpans(
  left: HarmonicRegionSpan,
  right: HarmonicRegionSpan,
): boolean {
  return right.end < left.start + 12;
}

function getValidatedSortedPairLanes(
  spans: [HarmonicRegionSpan, HarmonicRegionSpan],
): [HarmonicRegionSpan, HarmonicRegionSpan] | undefined {
  const sortedLaneSpans = [...spans].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  ) as [HarmonicRegionSpan, HarmonicRegionSpan];

  if (
    !areDisjointOrderedSpans(sortedLaneSpans[0], sortedLaneSpans[1]) ||
    !areDisjointRepeatedSpans(sortedLaneSpans[0], sortedLaneSpans[1])
  ) {
    return undefined;
  }

  return sortedLaneSpans;
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
    return getValidatedSortedPairLanes(
      contiguousSpans as [HarmonicRegionSpan, HarmonicRegionSpan],
    );
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

  return getValidatedSortedPairLanes([
    laneSpans[0],
    laneSpans[1],
  ] as [HarmonicRegionSpan, HarmonicRegionSpan]);
}

function getCanonicalLanes(pitchClasses: PitchClass[]): HarmonicRegionSpan[] {
  return (
    getCanonicalPairLanes(pitchClasses) ??
    buildToneSpacedPitchClassSpans(pitchClasses)
  );
}

function getPitchClassesForSpan(span: HarmonicRegionSpan): PitchClass[] {
  const pitchClasses: PitchClass[] = [];

  for (let pitch = span.start; pitch <= span.end; pitch += 2) {
    pitchClasses.push(mod12(pitch));
  }

  return pitchClasses;
}

function getPitchClassesForSpans(spans: HarmonicRegionSpan[]): PitchClass[] {
  return uniqueSortedPitchClasses(
    spans.flatMap((span) => getPitchClassesForSpan(span)),
  );
}

export function buildRegion(evidence: PitchClass[]): HarmonicRegion {
  const pitchClasses = uniqueFifthsOrderedPitchClasses(evidence);
  const spans = buildSpansFromPitchClasses(pitchClasses);

  return {
    spans,
  };
}

function buildSpansFromPitchClasses(
  pitchClasses: PitchClass[],
): HarmonicRegionSpan[] {
  return getCanonicalLanes(uniqueFifthsOrderedPitchClasses(pitchClasses));
}

export function getRegionSpans(region: HarmonicRegion): HarmonicRegionSpan[] {
  return region.spans;
}

export function getRegionPitchClasses(region: HarmonicRegion): PitchClass[] {
  return uniqueFifthsOrderedPitchClasses(getPitchClassesForSpans(region.spans));
}
