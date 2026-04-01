import { buildCenterShape } from "./builder";
import { getRegionPitchClasses } from "./region";

import type { HarmonicRegion, PitchClass } from "../model";
import type { SegmentEvidence } from "./evidence";

const SPLIT_CENTER_COMPACTNESS_WEIGHT = 0.1;

type ScoredCenterCandidate = {
  center: HarmonicRegion;
  pitchClassCount: number;
  score: number;
  spanCount: number;
  subsetSize: number;
  subsetWeight: number;
};

type OrderedSubsetMask = {
  mask: number;
  size: number;
  weight: number;
};

function getPitchClassSubset(mask: number, values: PitchClass[]): PitchClass[] {
  return values.filter((_, index) => (mask & (1 << index)) !== 0);
}

function getSubsetWeight(
  subset: PitchClass[],
  weightByPitchClass: Map<PitchClass, number>,
): number {
  return subset.reduce(
    (totalWeight, pitchClass) =>
      totalWeight + (weightByPitchClass.get(pitchClass) ?? 0),
    0,
  );
}

function getSubsetWeightFromMask(
  mask: number,
  values: PitchClass[],
  weightByPitchClass: Map<PitchClass, number>,
): number {
  return values.reduce(
    (totalWeight, pitchClass, index) =>
      (mask & (1 << index)) === 0
        ? totalWeight
        : totalWeight + (weightByPitchClass.get(pitchClass) ?? 0),
    0,
  );
}

function scoreCenterCandidate(
  pitchClassCount: number,
  capturedWeight: number,
  omittedWeight: number,
): number {
  if (pitchClassCount === 0) {
    return -omittedWeight;
  }

  return (
    capturedWeight -
    omittedWeight -
    pitchClassCount * SPLIT_CENTER_COMPACTNESS_WEIGHT
  );
}

function buildScoredCenterCandidate(
  center: HarmonicRegion,
  weightByPitchClass: Map<PitchClass, number>,
  subsetSize: number,
  subsetWeight: number,
): ScoredCenterCandidate {
  const centerPitchClasses = getRegionPitchClasses(center);
  const centerPitchClassSet = new Set(centerPitchClasses);
  const capturedWeight = centerPitchClasses.reduce(
    (totalWeight, pitchClass) =>
      totalWeight + (weightByPitchClass.get(pitchClass) ?? 0),
    0,
  );
  const omittedWeight = [...weightByPitchClass.entries()].reduce(
    (totalWeight, [pitchClass, weight]) =>
      centerPitchClassSet.has(pitchClass) ? totalWeight : totalWeight + weight,
    0,
  );

  return {
    center,
    pitchClassCount: centerPitchClasses.length,
    score: scoreCenterCandidate(
      centerPitchClasses.length,
      capturedWeight,
      omittedWeight,
    ),
    spanCount: center.spans.length,
    subsetSize,
    subsetWeight,
  };
}

function getOrderedPitchClassSubsets(
  segmentEvidence: SegmentEvidence,
): Iterable<PitchClass[]> {
  const { localPitchClasses, pitchClassWeightByPitchClass } = segmentEvidence;
  const fullMask = (1 << localPitchClasses.length) - 1;
  const orderedSubsetMasks: OrderedSubsetMask[] = Array.from(
    { length: fullMask },
    (_, index) => {
      const mask = fullMask - index - 1;
      const size = mask.toString(2).replaceAll("0", "").length;

      return {
        mask,
        size,
        weight: getSubsetWeightFromMask(
          mask,
          localPitchClasses,
          pitchClassWeightByPitchClass,
        ),
      };
    },
  ).sort((left, right) => {
    return right.weight - left.weight || right.size - left.size;
  });

  return {
    *[Symbol.iterator](): Iterator<PitchClass[]> {
      for (const { mask } of orderedSubsetMasks) {
        yield getPitchClassSubset(mask, localPitchClasses);
      }
    },
  };
}

function getUniqueCenterCandidates(
  segmentEvidence: SegmentEvidence,
): { center: HarmonicRegion; subsetSize: number; subsetWeight: number }[] {
  const candidatesByPitchClasses = new Map<
    string,
    { center: HarmonicRegion; subsetSize: number; subsetWeight: number }
  >();

  for (const subset of getOrderedPitchClassSubsets(segmentEvidence)) {
    const candidate = buildCenterShape(subset);
    const candidatePitchClasses = getRegionPitchClasses(candidate);

    if (candidatePitchClasses.length === 0) {
      continue;
    }

    const key = candidatePitchClasses.join(",");
    const subsetWeight = getSubsetWeight(
      subset,
      segmentEvidence.pitchClassWeightByPitchClass,
    );
    const existingCandidate = candidatesByPitchClasses.get(key);

    if (
      existingCandidate === undefined ||
      subsetWeight > existingCandidate.subsetWeight ||
      (subsetWeight === existingCandidate.subsetWeight &&
        subset.length > existingCandidate.subsetSize)
    ) {
      candidatesByPitchClasses.set(key, {
        center: candidate,
        subsetSize: subset.length,
        subsetWeight,
      });
    }
  }

  return [...candidatesByPitchClasses.values()];
}

function chooseBestCenterCandidate(
  scoredCandidates: ScoredCenterCandidate[],
): HarmonicRegion {
  return scoredCandidates.reduce((bestCandidate, candidate) => {
    if (candidate.score !== bestCandidate.score) {
      return candidate.score > bestCandidate.score ? candidate : bestCandidate;
    }

    if (candidate.subsetWeight !== bestCandidate.subsetWeight) {
      return candidate.subsetWeight > bestCandidate.subsetWeight
        ? candidate
        : bestCandidate;
    }

    if (candidate.subsetSize !== bestCandidate.subsetSize) {
      return candidate.subsetSize > bestCandidate.subsetSize
        ? candidate
        : bestCandidate;
    }

    if (candidate.spanCount !== bestCandidate.spanCount) {
      return candidate.spanCount < bestCandidate.spanCount
        ? candidate
        : bestCandidate;
    }

    return candidate.pitchClassCount < bestCandidate.pitchClassCount
      ? candidate
      : bestCandidate;
  }).center;
}

function getFullSetCenterCandidate(
  segmentEvidence: SegmentEvidence,
): HarmonicRegion | undefined {
  const candidate = buildCenterShape(segmentEvidence.localPitchClasses);

  return getRegionPitchClasses(candidate).length > 0 ? candidate : undefined;
}

function getSubsetFallbackCenterCandidate(
  segmentEvidence: SegmentEvidence,
): HarmonicRegion | undefined {
  const scoredCandidates: ScoredCenterCandidate[] = [
    buildScoredCenterCandidate(
      { spans: [] },
      segmentEvidence.pitchClassWeightByPitchClass,
      0,
      0,
    ),
    ...getUniqueCenterCandidates(segmentEvidence).map((candidate) =>
      buildScoredCenterCandidate(
        candidate.center,
        segmentEvidence.pitchClassWeightByPitchClass,
        candidate.subsetSize,
        candidate.subsetWeight,
      ),
    ),
  ];
  const bestCandidate = chooseBestCenterCandidate(scoredCandidates);

  return getRegionPitchClasses(bestCandidate).length > 0
    ? bestCandidate
    : undefined;
}

function getSingletonFallbackCenter(
  segmentEvidence: SegmentEvidence,
): HarmonicRegion {
  return {
    spans: segmentEvidence.localPitchClasses.map((pitchClass) => ({
      end: pitchClass,
      start: pitchClass,
    })),
  };
}

export function buildCenter(segmentEvidence: SegmentEvidence): HarmonicRegion {
  const fullSetCandidate = getFullSetCenterCandidate(segmentEvidence);

  if (fullSetCandidate !== undefined) {
    return fullSetCandidate;
  }

  const subsetFallbackCandidate = getSubsetFallbackCenterCandidate(segmentEvidence);

  if (subsetFallbackCandidate !== undefined) {
    return subsetFallbackCandidate;
  }

  return getSingletonFallbackCenter(segmentEvidence);
}

export function scoreCenterWithWeightMap(
  center: HarmonicRegion,
  weightByPitchClass: Map<PitchClass, number>,
): number {
  return buildScoredCenterCandidate(center, weightByPitchClass, 0, 0).score;
}
