import { normalizeChordSymbol } from "./chord";
import {
  buildCenterFromPitchClasses,
  buildRegion,
  getFilledFifthsRegion,
  isBaselineValidRegion,
} from "./region";
import {
  getEventPitches,
  getEventPitchClasses,
  uniqueSortedPitchClasses,
} from "../pitch";
import { getSegmentTotalDuration } from "../segment";

import type {
  AnalyzedHarmonicSegment,
  EventInput,
  EventOffset,
  Grounding,
  HarmonicSegment,
  HarmonicSlice,
  HarmonicStructure,
  HarmonicRegion,
  PitchClass,
  PieceInput,
  SegmentInput,
  TimedChordSymbol,
} from "../model";

const MIN_SETTLED_REGION_EVIDENCE = 3;
const FIELD_CONTINUITY_OVERLAP = 3;
const MIN_SPLIT_SCORE_IMPROVEMENT = 1;
const SPLIT_DIVERGENCE_WEIGHT = 0.2;
const SPLIT_CENTER_COMPACTNESS_WEIGHT = 0.1;

type SegmentEvidence = {
  pitchClassWeightByPitchClass: Map<PitchClass, number>;
  chordGroundPitchClass?: PitchClass;
  chordRootPitchClass?: PitchClass;
  localPitchClasses: PitchClass[];
};

type TimedChordSymbolWindow = {
  duration: number;
  offset: EventOffset;
  symbol: string;
};

type SegmentationCandidate = {
  score: number;
  slices: HarmonicSlice[];
};

type SplitCandidateEvaluation = {
  leftHarmonic: HarmonicSegment;
  leftSegment: SegmentInput;
  rightHarmonic: HarmonicSegment;
  rightSegment: SegmentInput;
};

function countOverlap(left: PitchClass[], right: PitchClass[]): number {
  return left.filter((pitch) => right.includes(pitch)).length;
}

function addPitchClassWeight(
  weightByPitchClass: Map<PitchClass, number>,
  pitchClass: PitchClass,
  weight: number,
): void {
  weightByPitchClass.set(
    pitchClass,
    (weightByPitchClass.get(pitchClass) ?? 0) + weight,
  );
}

function getCapturedWeight(
  center: HarmonicRegion,
  weightByPitchClass: Map<PitchClass, number>,
): number {
  return center.pitchClasses.reduce(
    (totalWeight, pitchClass) =>
      totalWeight + (weightByPitchClass.get(pitchClass) ?? 0),
    0,
  );
}

function getOmittedWeight(
  center: HarmonicRegion,
  weightByPitchClass: Map<PitchClass, number>,
): number {
  return [...weightByPitchClass.entries()].reduce(
    (totalWeight, [pitchClass, weight]) =>
      center.pitchClasses.includes(pitchClass)
        ? totalWeight
        : totalWeight + weight,
    0,
  );
}

function collectSegmentEvidence(segment: SegmentInput): SegmentEvidence {
  const activeChordSymbol = getUnambiguousSegmentGroundingSymbol(segment);
  const normalizedChordSymbol =
    activeChordSymbol === undefined
      ? undefined
      : normalizeChordSymbol(activeChordSymbol);
  const pitchClassWeightByPitchClass = getPitchClassWeightByPitchClass(segment);

  const localPitchClasses = [...pitchClassWeightByPitchClass.keys()].sort(
    (left, right) => left - right,
  );

  return {
    pitchClassWeightByPitchClass,
    localPitchClasses,
    ...(normalizedChordSymbol === undefined
      ? {}
      : {
          chordGroundPitchClass: normalizedChordSymbol.groundPitchClass,
          chordRootPitchClass: normalizedChordSymbol.rootPitchClass,
        }),
  };
}

function getTimedChordSymbols(segment: SegmentInput): TimedChordSymbol[] {
  return segment.chordSymbols ?? [];
}

function getOrderedTimedChordSymbols(segment: SegmentInput): TimedChordSymbol[] {
  return [...getTimedChordSymbols(segment)].sort(
    (left, right) => left.offset - right.offset,
  );
}

function getUnambiguousSegmentGroundingSymbol(
  segment: SegmentInput,
): string | undefined {
  const timedChordSymbols = getOrderedTimedChordSymbols(segment);

  return timedChordSymbols.length === 1 ? timedChordSymbols[0]!.symbol : undefined;
}

function getActiveChordSymbol(
  segment: SegmentInput,
  offset: EventOffset = 0,
): string | undefined {
  return getOrderedTimedChordSymbols(segment)
    .filter((timedChordSymbol) => timedChordSymbol.offset <= offset)
    .at(-1)?.symbol;
}

function getTimedChordSymbolWindows(
  segment: SegmentInput,
  totalDuration: number,
): TimedChordSymbolWindow[] {
  const timedChordSymbols = getOrderedTimedChordSymbols(segment).filter(
    (timedChordSymbol) => timedChordSymbol.offset < totalDuration,
  );

  return timedChordSymbols.flatMap((timedChordSymbol, index) => {
    const nextOffset = timedChordSymbols[index + 1]?.offset ?? totalDuration;
    const duration = nextOffset - timedChordSymbol.offset;

    if (duration <= 0) {
      return [];
    }

    return [
      {
        duration,
        offset: timedChordSymbol.offset,
        symbol: timedChordSymbol.symbol,
      },
    ];
  });
}

function getPitchClassWeightByPitchClass(
  segment: SegmentInput,
): Map<PitchClass, number> {
  const pitchClassWeightByPitchClass = new Map<PitchClass, number>();
  const totalDuration = getSegmentTotalDuration(segment);

  segment.events.forEach((event) => {
    getEventPitchClasses(event).forEach((pitchClass) => {
      addPitchClassWeight(
        pitchClassWeightByPitchClass,
        pitchClass,
        event.duration,
      );
    });
  });

  getTimedChordSymbolWindows(segment, totalDuration).forEach(
    ({ duration, symbol }) => {
      const normalizedTimedChordSymbol = normalizeChordSymbol(symbol);

      if (normalizedTimedChordSymbol === undefined) {
        return;
      }

      normalizedTimedChordSymbol.pitchClasses.forEach((pitchClass) => {
        addPitchClassWeight(
          pitchClassWeightByPitchClass,
          pitchClass,
          duration,
        );
      });
    },
  );

  return pitchClassWeightByPitchClass;
}

function getPowerSet(values: PitchClass[]): PitchClass[][] {
  return Array.from({ length: 1 << values.length }, (_, mask) =>
    values.filter((_, index) => (mask & (1 << index)) !== 0),
  );
}

function isStrongRescuedCenter(
  center: HarmonicRegion,
  weightByPitchClass: Map<PitchClass, number>,
): boolean {
  const includedWeights = center.pitchClasses
    .map((pitchClass) => weightByPitchClass.get(pitchClass) ?? 0)
    .filter((weight) => weight > 0);
  const omittedWeight = getOmittedWeight(center, weightByPitchClass);

  return (
    includedWeights.length > 0 &&
    center.pitchClasses.length >= MIN_SETTLED_REGION_EVIDENCE &&
    getCapturedWeight(center, weightByPitchClass) > omittedWeight &&
    omittedWeight < Math.min(...includedWeights)
  );
}

function getDirectCenter(segmentEvidence: SegmentEvidence): HarmonicRegion {
  return buildCenterFromPitchClasses(
    segmentEvidence.localPitchClasses,
    segmentEvidence.localPitchClasses,
  );
}

function getRescueCandidateCenters(
  segmentEvidence: SegmentEvidence,
): HarmonicRegion[] {
  const candidateCenterByKey = new Map<string, HarmonicRegion>();

  getPowerSet(segmentEvidence.localPitchClasses).forEach((pitchClassSubset) => {
    const candidateLocalPitchClasses = uniqueSortedPitchClasses(
      pitchClassSubset,
    );
    const candidateCenter = buildCenterFromPitchClasses(
      candidateLocalPitchClasses,
      candidateLocalPitchClasses,
    );

    if (candidateCenter.pitchClasses.length === 0) {
      return;
    }

    candidateCenterByKey.set(
      candidateCenter.pitchClasses.join(","),
      candidateCenter,
    );
  });

  return [...candidateCenterByKey.values()];
}

function rankRescueCandidateCenters(
  segmentEvidence: SegmentEvidence,
  candidateCenters: HarmonicRegion[],
): HarmonicRegion | undefined {
  const strongCandidateCenters = candidateCenters.filter((candidateCenter) =>
    isStrongRescuedCenter(
      candidateCenter,
      segmentEvidence.pitchClassWeightByPitchClass,
    ),
  );

  if (strongCandidateCenters.length === 0) {
    return undefined;
  }

  return strongCandidateCenters.sort((left, right) => {
    const capturedWeightDifference =
      getCapturedWeight(
        right,
        segmentEvidence.pitchClassWeightByPitchClass,
      ) -
      getCapturedWeight(
        left,
        segmentEvidence.pitchClassWeightByPitchClass,
      );

    if (capturedWeightDifference !== 0) {
      return capturedWeightDifference;
    }

    const pitchClassCountDifference =
      right.pitchClasses.length - left.pitchClasses.length;

    if (pitchClassCountDifference !== 0) {
      return pitchClassCountDifference;
    }

    return (
      getOmittedWeight(
        left,
        segmentEvidence.pitchClassWeightByPitchClass,
      ) -
      getOmittedWeight(right, segmentEvidence.pitchClassWeightByPitchClass)
    );
  })[0]!;
}

function buildWeightedCenter(segmentEvidence: SegmentEvidence): HarmonicRegion {
  const directCenter = getDirectCenter(segmentEvidence);

  if (directCenter.pitchClasses.length > 0) {
    return directCenter;
  }

  return (
    rankRescueCandidateCenters(
      segmentEvidence,
      getRescueCandidateCenters(segmentEvidence),
    ) ?? directCenter
  );
}

function buildCenter(segmentEvidence: SegmentEvidence): HarmonicRegion {
  return buildWeightedCenter(segmentEvidence);
}

function getGrounding(
  center: HarmonicRegion,
  segmentEvidence: SegmentEvidence,
): Grounding | undefined {
  void center;

  const { chordGroundPitchClass, chordRootPitchClass } = segmentEvidence;

  if (
    chordRootPitchClass !== undefined &&
    chordGroundPitchClass !== undefined
  ) {
    return {
      ground: chordGroundPitchClass,
      root: chordRootPitchClass,
    };
  }

  return undefined;
}

function getNeighborCenters(
  centers: HarmonicRegion[],
  index: number,
): HarmonicRegion[] {
  return [centers[index - 1], centers[index + 1]].filter(
    (center): center is HarmonicRegion =>
      center !== undefined && center.pitchClasses.length > 0,
  );
}

function buildField(
  center: HarmonicRegion,
  neighborCenters: HarmonicRegion[],
): HarmonicRegion {
  if (neighborCenters.length === 0) {
    return buildRegion(center.pitchClasses);
  }

  const continuityPitchClasses = neighborCenters.flatMap((neighborCenter) => {
    if (
      countOverlap(center.pitchClasses, neighborCenter.pitchClasses) >=
      FIELD_CONTINUITY_OVERLAP
    ) {
      return neighborCenter.pitchClasses;
    }

    return [];
  });

  if (continuityPitchClasses.length === 0) {
    return buildRegion(center.pitchClasses);
  }

  const pitchClasses = getFilledFifthsRegion([
    ...center.pitchClasses,
    ...continuityPitchClasses,
  ]);

  if (!isBaselineValidRegion(pitchClasses)) {
    return buildRegion(center.pitchClasses);
  }

  return buildRegion(pitchClasses);
}

function analyzeSegmentCenter(segment: SegmentInput): {
  center: HarmonicRegion;
  grounding: Grounding | undefined;
} {
  const segmentEvidence = collectSegmentEvidence(segment);
  const center = buildCenter(segmentEvidence);
  const grounding = getGrounding(center, segmentEvidence);

  return {
    center,
    grounding,
  };
}

function analyzeIsolatedSegment(segment: SegmentInput): HarmonicSegment {
  const { center, grounding } = analyzeSegmentCenter(segment);

  return {
    center,
    field: buildField(center, []),
    ...(grounding === undefined ? {} : { grounding }),
  };
}

function analyzeSegmentSlices(
  segment: SegmentInput,
  totalDuration: number,
  harmonic: HarmonicSegment,
): HarmonicSlice[] {
  if (getTimedChordSymbols(segment).length > 0) {
    return buildChordSymbolSlices(segment, totalDuration);
  }

  const unsplitSlices = buildUnsplitSlices(totalDuration, harmonic);
  const unsplitScore = scoreSegmentation(segment, unsplitSlices);
  const splitOffsets = getCandidateSplitOffsets(segment, totalDuration);
  let bestSplitCandidate: SegmentationCandidate | undefined;

  for (const splitOffset of splitOffsets) {
    const splitCandidate = evaluateSplitCandidate(
      segment,
      harmonic,
      splitOffset,
      totalDuration,
    );

    if (splitCandidate === undefined) {
      continue;
    }

    const splitSlices = buildSplitSlices(
      splitOffset,
      totalDuration,
      splitCandidate.leftHarmonic,
      splitCandidate.rightHarmonic,
    );
    const score =
      scoreAnalyzedWindow(
        splitCandidate.leftSegment,
        splitCandidate.leftHarmonic.center,
      ) +
      scoreAnalyzedWindow(
        splitCandidate.rightSegment,
        splitCandidate.rightHarmonic.center,
      ) +
      getBoundaryContrastScore(
        splitCandidate.leftHarmonic.center.pitchClasses,
        splitCandidate.rightHarmonic.center.pitchClasses,
      );

    if (bestSplitCandidate === undefined || score >= bestSplitCandidate.score) {
      bestSplitCandidate = {
        score,
        slices: splitSlices,
      };
    }
  }

  if (
    bestSplitCandidate !== undefined &&
    bestSplitCandidate.score - unsplitScore >= MIN_SPLIT_SCORE_IMPROVEMENT
  ) {
    return bestSplitCandidate.slices;
  }

  return unsplitSlices;
}

function buildChordSymbolSlices(
  segment: SegmentInput,
  totalDuration: number,
): HarmonicSlice[] {
  const sliceOffsets = [
    ...new Set([
      0,
      ...getTimedChordSymbolWindows(segment, totalDuration).map(
        (timedChordSymbolWindow) => timedChordSymbolWindow.offset,
      ),
    ]),
  ].sort((left, right) => left - right);

  return sliceOffsets.map((startOffset, index) => {
    const endOffset = sliceOffsets[index + 1] ?? totalDuration;
    const windowedSegment = buildWindowedSegment(segment, startOffset, endOffset);

    return {
      duration: endOffset - startOffset,
      harmonic: analyzeIsolatedSegment(windowedSegment),
      startOffset,
    };
  });
}

function buildUnsplitSlices(
  totalDuration: number,
  harmonic: HarmonicSegment,
): HarmonicSlice[] {
  return [
    {
      duration: totalDuration,
      harmonic,
      startOffset: 0,
    },
  ];
}

function evaluateSplitCandidate(
  segment: SegmentInput,
  harmonic: HarmonicSegment,
  splitOffset: EventOffset,
  totalDuration: number,
): SplitCandidateEvaluation | undefined {
  const leftSegment = buildWindowedSegment(segment, 0, splitOffset);
  const rightSegment = buildWindowedSegment(
    segment,
    splitOffset,
    totalDuration,
  );

  if (
    !hasPitchedEvents(leftSegment.events) ||
    !hasPitchedEvents(rightSegment.events)
  ) {
    return undefined;
  }

  const leftHarmonic = analyzeIsolatedSegment(leftSegment);
  const rightHarmonic = analyzeIsolatedSegment(rightSegment);

  if (
    leftHarmonic.center.pitchClasses.length === 0 ||
    rightHarmonic.center.pitchClasses.length === 0 ||
    pitchClassesEqual(
      leftHarmonic.center.pitchClasses,
      rightHarmonic.center.pitchClasses,
    ) ||
    isWeakPreviewBoundary(
      harmonic.center.pitchClasses,
      leftHarmonic.center.pitchClasses,
      rightHarmonic.center.pitchClasses,
    )
  ) {
    return undefined;
  }

  return {
    leftHarmonic,
    leftSegment,
    rightHarmonic,
    rightSegment,
  };
}

function buildSplitSlices(
  splitOffset: EventOffset,
  totalDuration: number,
  leftHarmonic: HarmonicSegment,
  rightHarmonic: HarmonicSegment,
): HarmonicSlice[] {
  return [
    {
      duration: splitOffset,
      harmonic: leftHarmonic,
      startOffset: 0,
    },
    {
      duration: totalDuration - splitOffset,
      harmonic: rightHarmonic,
      startOffset: splitOffset,
    },
  ];
}

function isWeakPreviewBoundary(
  segmentPitchClasses: number[],
  leftPitchClasses: number[],
  rightPitchClasses: number[],
): boolean {
  return (
    (pitchClassesEqual(rightPitchClasses, segmentPitchClasses) &&
      isPitchClassSubset(leftPitchClasses, segmentPitchClasses)) ||
    (pitchClassesEqual(leftPitchClasses, segmentPitchClasses) &&
      isPitchClassSubset(rightPitchClasses, segmentPitchClasses))
  );
}

function getBoundaryContrastScore(
  leftPitchClasses: number[],
  rightPitchClasses: number[],
): number {
  return (
    getSymmetricPitchClassDifferenceCount(leftPitchClasses, rightPitchClasses) *
    SPLIT_DIVERGENCE_WEIGHT
  );
}

function getSymmetricPitchClassDifferenceCount(
  leftPitchClasses: number[],
  rightPitchClasses: number[],
): number {
  const leftPitchClassSet = new Set(leftPitchClasses);
  const rightPitchClassSet = new Set(rightPitchClasses);

  return (
    leftPitchClasses.filter((pitchClass) => !rightPitchClassSet.has(pitchClass))
      .length +
    rightPitchClasses.filter((pitchClass) => !leftPitchClassSet.has(pitchClass))
      .length
  );
}

function pitchClassesEqual(left: number[], right: number[]): boolean {
  return left.join(",") === right.join(",");
}

function isPitchClassSubset(
  subsetCandidate: number[],
  fullSet: number[],
): boolean {
  if (subsetCandidate.length >= fullSet.length) {
    return false;
  }

  const fullPitchClasses = new Set(fullSet);

  return subsetCandidate.every((pitchClass) =>
    fullPitchClasses.has(pitchClass),
  );
}

function scoreSegmentation(
  segment: SegmentInput,
  harmonicSlices: HarmonicSlice[],
): number {
  return harmonicSlices.reduce((totalScore, harmonicSlice) => {
    const sliceSegment = buildWindowedSegment(
      segment,
      harmonicSlice.startOffset,
      harmonicSlice.startOffset + harmonicSlice.duration,
    );

    return (
      totalScore +
      scoreAnalyzedWindow(sliceSegment, harmonicSlice.harmonic.center)
    );
  }, 0);
}

function scoreAnalyzedWindow(
  segment: SegmentInput,
  center: HarmonicRegion,
): number {
  const weightByPitchClass = getPitchClassWeightByPitchClass(segment);
  const capturedWeight = getCapturedWeight(center, weightByPitchClass);
  const omittedWeight = getOmittedWeight(center, weightByPitchClass);

  if (center.pitchClasses.length === 0) {
    return -omittedWeight;
  }

  return (
    capturedWeight -
    omittedWeight -
    center.pitchClasses.length * SPLIT_CENTER_COMPACTNESS_WEIGHT
  );
}

function getCandidateSplitOffsets(
  segment: SegmentInput,
  totalDuration: number,
): EventOffset[] {
  return [...new Set(segment.events.map((event) => event.offset ?? 0))]
    .filter((offset) => offset > 0 && offset < totalDuration)
    .sort((left, right) => left - right);
}

function buildWindowedSegment(
  segment: SegmentInput,
  startOffset: EventOffset,
  endOffset: EventOffset,
): SegmentInput {
  const timedChordSymbols = getOrderedTimedChordSymbols(segment);
  const inheritedChordSymbol = getActiveChordSymbol(segment, startOffset);
  const windowChordSymbols = timedChordSymbols
    .filter(
      (timedChordSymbol) =>
        timedChordSymbol.offset >= startOffset &&
        timedChordSymbol.offset < endOffset,
    )
    .map((timedChordSymbol) => ({
      offset: timedChordSymbol.offset - startOffset,
      symbol: timedChordSymbol.symbol,
    }));
  const normalizedChordSymbols =
    inheritedChordSymbol === undefined
      ? windowChordSymbols
      : windowChordSymbols[0]?.offset === 0 &&
          windowChordSymbols[0]?.symbol === inheritedChordSymbol
        ? windowChordSymbols
        : [{ offset: 0, symbol: inheritedChordSymbol }, ...windowChordSymbols];

  return {
    ...(normalizedChordSymbols.length === 0
      ? {}
      : {
          chordSymbols: normalizedChordSymbols,
        }),
    events: segment.events.flatMap((event) => {
      const eventOffset = event.offset ?? 0;
      const overlapStart = Math.max(startOffset, eventOffset);
      const overlapEnd = Math.min(endOffset, eventOffset + event.duration);

      if (overlapEnd <= overlapStart) {
        return [];
      }

      return [
        {
          ...event,
          duration: overlapEnd - overlapStart,
          offset: overlapStart - startOffset,
        } as EventInput,
      ];
    }),
    ...(segment.timeSignature === undefined
      ? {}
      : { timeSignature: segment.timeSignature }),
  };
}

function hasPitchedEvents(events: EventInput[]): boolean {
  return events.some((event) => getEventPitches(event).length > 0);
}

export function runEngine(input: PieceInput): HarmonicStructure {
  const analyzedCenters = input.segments.map(analyzeSegmentCenter);
  const centers = analyzedCenters.map((segment) => segment.center);
  const segments = analyzedCenters.map(
    ({ center, grounding }, index): HarmonicSegment => ({
      center,
      field: buildField(center, getNeighborCenters(centers, index)),
      ...(grounding === undefined ? {} : { grounding }),
    }),
  );

  return {
    segments: segments.map(
      (segment, index): AnalyzedHarmonicSegment => ({
        ...segment,
        harmonicSlices: analyzeSegmentSlices(
          input.segments[index]!,
          getSegmentTotalDuration(input.segments[index]!),
          segment,
        ),
      }),
    ),
  };
}
