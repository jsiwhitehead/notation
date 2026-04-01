import { mod12, uniqueSortedPitchClasses } from "../pitch";

import type { HarmonicRegion, HarmonicRegionSpan, PitchClass } from "../model";

type ToneRunInterval = {
  coverageMask: number;
  length: number;
  span: HarmonicRegionSpan;
};

type ToneRunCover = {
  count: number;
  spans: HarmonicRegionSpan[];
  totalLength: number;
  unique: boolean;
};

function buildRegionFromSpans(spans: HarmonicRegionSpan[]): HarmonicRegion {
  return {
    spans: [...spans].sort(
      (left, right) => left.start - right.start || left.end - right.end,
    ),
  };
}

function hasSingletonSpan(spans: HarmonicRegionSpan[]): boolean {
  return spans.some((span) => span.start === span.end);
}

function pruneAddedSingletonSpans(
  spans: HarmonicRegionSpan[],
  evidencePitchClasses: PitchClass[],
): HarmonicRegionSpan[] {
  const evidencePitchClassSet = new Set(evidencePitchClasses);

  return spans.filter(
    (span) =>
      span.start !== span.end || evidencePitchClassSet.has(mod12(span.start)),
  );
}

function getToneRunChromaticInteriors(
  run: HarmonicRegionSpan,
): Set<PitchClass> {
  const interiors = new Set<PitchClass>();

  for (let pitch = run.start; pitch < run.end; pitch += 2) {
    interiors.add(mod12(pitch + 1));
  }

  return interiors;
}

function getParityPitchClasses(
  pitchClasses: PitchClass[],
  parity: number,
): PitchClass[] {
  return pitchClasses.filter((pitchClass) => mod12(pitchClass) % 2 === parity);
}

function getValidToneRunIntervals(
  parityEvidence: PitchClass[],
  oppositeEvidence: Set<PitchClass>,
): ToneRunInterval[] {
  const evidence = uniqueSortedPitchClasses(parityEvidence);
  const evidenceIndexByPitch = new Map(
    evidence.map((pitchClass, index) => [pitchClass, index]),
  );

  if (evidence.length === 0) {
    return [];
  }

  const intervals = new Map<string, ToneRunInterval>();

  for (const start of evidence) {
    let end = start;
    let coverageMask = 0;
    const startIndex = evidenceIndexByPitch.get(start);

    if (startIndex !== undefined) {
      coverageMask |= 1 << startIndex;
    }

    intervals.set(`${start}:${1}`, {
      coverageMask,
      length: 1,
      span: { end, start },
    });

    for (let length = 2; length <= 6; length += 1) {
      const nextPitch = mod12(end + 2);

      if (oppositeEvidence.has(mod12(end + 1))) {
        break;
      }

      end += 2;

      const nextPitchIndex = evidenceIndexByPitch.get(nextPitch);

      if (nextPitchIndex !== undefined) {
        coverageMask |= 1 << nextPitchIndex;
      }

      intervals.set(`${start}:${length}`, {
        coverageMask,
        length,
        span: { end, start },
      });
    }
  }

  return [...intervals.values()].filter((interval) => interval.coverageMask !== 0);
}

function getMinimalToneRunCover(
  parityEvidence: PitchClass[],
  oppositeEvidence: Set<PitchClass>,
): ToneRunCover | undefined {
  const evidence = uniqueSortedPitchClasses(parityEvidence);

  if (evidence.length === 0) {
    return {
      count: 0,
      spans: [],
      totalLength: 0,
      unique: true,
    };
  }

  const intervals = getValidToneRunIntervals(evidence, oppositeEvidence);
  const fullMask = (1 << evidence.length) - 1;
  const memo = new Map<number, ToneRunCover | undefined>();

  function search(mask: number): ToneRunCover | undefined {
    if (mask === fullMask) {
      return {
        count: 0,
        spans: [],
        totalLength: 0,
        unique: true,
      };
    }

    const cached = memo.get(mask);

    if (cached !== undefined) {
      return cached;
    }

    const firstMissingIndex = evidence.findIndex(
      (_, index) => (mask & (1 << index)) === 0,
    );
    let bestCover: ToneRunCover | undefined;

    intervals
      .filter((interval) => (interval.coverageMask & (1 << firstMissingIndex)) !== 0)
      .forEach((interval) => {
        const nextCover = search(mask | interval.coverageMask);

        if (nextCover === undefined) {
          return;
        }

        const candidate: ToneRunCover = {
          count: nextCover.count + 1,
          spans: [interval.span, ...nextCover.spans].sort(
            (left, right) => left.start - right.start || left.end - right.end,
          ),
          totalLength: nextCover.totalLength + interval.length,
          unique: nextCover.unique,
        };

        if (
          bestCover === undefined ||
          candidate.count < bestCover.count ||
          (candidate.count === bestCover.count &&
            candidate.totalLength < bestCover.totalLength)
        ) {
          bestCover = candidate;
          return;
        }

        if (
          candidate.count === bestCover.count &&
          candidate.totalLength === bestCover.totalLength
        ) {
          bestCover = {
            ...bestCover,
            unique: false,
          };
        }
      });

    memo.set(mask, bestCover);

    return bestCover;
  }

  return search(0);
}

function getAdjacentPairFifths(spans: HarmonicRegionSpan[]): PitchClass[] {
  const fifths = new Set<PitchClass>();

  spans.forEach((run) => {
    for (let pitch = run.start; pitch < run.end; pitch += 2) {
      fifths.add(mod12(pitch - 5));
    }
  });

  return uniqueSortedPitchClasses([...fifths]);
}

function getMinimalCoverCandidate(
  pitchClasses: PitchClass[],
): HarmonicRegion | undefined {
  if (pitchClasses.length === 0) {
    return undefined;
  }

  const evenEvidence = getParityPitchClasses(pitchClasses, 0);
  const oddEvidence = getParityPitchClasses(pitchClasses, 1);
  const initialEvenCover = getMinimalToneRunCover(
    evenEvidence,
    new Set(oddEvidence),
  );
  const initialOddCover = getMinimalToneRunCover(
    oddEvidence,
    new Set(evenEvidence),
  );

  if (
    initialEvenCover === undefined ||
    initialOddCover === undefined ||
    !initialEvenCover.unique ||
    !initialOddCover.unique
  ) {
    return undefined;
  }

  const evenInteriors = initialEvenCover.spans.flatMap((run) => [
    ...getToneRunChromaticInteriors(run),
  ]);
  const oddInteriors = initialOddCover.spans.flatMap((run) => [
    ...getToneRunChromaticInteriors(run),
  ]);
  const addedOddPitchClasses = getAdjacentPairFifths(
    initialEvenCover.spans,
  ).filter(
    (pitchClass) =>
      !oddEvidence.includes(pitchClass) && !evenInteriors.includes(pitchClass),
  );
  const addedEvenPitchClasses = getAdjacentPairFifths(
    initialOddCover.spans,
  ).filter(
    (pitchClass) =>
      !evenEvidence.includes(pitchClass) && !oddInteriors.includes(pitchClass),
  );
  const finalEvenPitchClasses = uniqueSortedPitchClasses([
    ...evenEvidence,
    ...addedEvenPitchClasses,
  ]);
  const finalOddPitchClasses = uniqueSortedPitchClasses([
    ...oddEvidence,
    ...addedOddPitchClasses,
  ]);
  const finalEvenCover = getMinimalToneRunCover(
    finalEvenPitchClasses,
    new Set(finalOddPitchClasses),
  );
  const finalOddCover = getMinimalToneRunCover(
    finalOddPitchClasses,
    new Set(finalEvenPitchClasses),
  );

  if (
    finalEvenCover === undefined ||
    finalOddCover === undefined ||
    !finalEvenCover.unique ||
    !finalOddCover.unique
  ) {
    return undefined;
  }

  const spans = pruneAddedSingletonSpans(
    [...finalEvenCover.spans, ...finalOddCover.spans],
    pitchClasses,
  );

  if (hasSingletonSpan(spans)) {
    return undefined;
  }

  return buildRegionFromSpans(spans);
}

export function buildCenterShape(
  pitchClasses: PitchClass[],
): HarmonicRegion {
  return getMinimalCoverCandidate(pitchClasses) ?? {
    spans: [],
  };
}
