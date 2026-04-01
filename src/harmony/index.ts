import { buildCenter, scoreCenterWithWeightMap } from "./selector";
import {
  collectSegmentEvidence,
  getActiveOrderedChordSymbol,
  getOrderedTimedChordSymbols,
  getPitchClassWeights,
  getTimedChordSymbolWindows,
  getTimedChordSymbols,
  type SegmentEvidence,
} from "./evidence";
import { getRegionPitchClasses } from "./region";
import { getEventPitches } from "../pitch";
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
  PieceInput,
  SegmentInput,
} from "../model";

const MIN_SPLIT_SCORE_IMPROVEMENT = 1;
const SPLIT_DIVERGENCE_WEIGHT = 0.2;

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

function getGrounding(
  segmentEvidence: SegmentEvidence,
): Grounding | undefined {
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

function buildField(center: HarmonicRegion): HarmonicRegion {
  return {
    spans: [...center.spans],
  };
}

function analyzeSegmentHarmony(segment: SegmentInput): {
  center: HarmonicRegion;
  grounding: Grounding | undefined;
} {
  const segmentEvidence = collectSegmentEvidence(segment);
  const center = buildCenter(segmentEvidence);
  const grounding = getGrounding(segmentEvidence);

  return {
    center,
    grounding,
  };
}

function analyzeIsolatedSegment(segment: SegmentInput): HarmonicSegment {
  const { center, grounding } = analyzeSegmentHarmony(segment);

  return {
    center,
    field: buildField(center),
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
        getRegionPitchClasses(splitCandidate.leftHarmonic.center),
        getRegionPitchClasses(splitCandidate.rightHarmonic.center),
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
  const segmentPitchClasses = getRegionPitchClasses(harmonic.center);
  const leftPitchClasses = getRegionPitchClasses(leftHarmonic.center);
  const rightPitchClasses = getRegionPitchClasses(rightHarmonic.center);

  if (
    leftPitchClasses.length === 0 ||
    rightPitchClasses.length === 0 ||
    pitchClassesEqual(leftPitchClasses, rightPitchClasses) ||
    isWeakPreviewBoundary(
      segmentPitchClasses,
      leftPitchClasses,
      rightPitchClasses,
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
  return scoreCenterWithWeightMap(
    center,
    getPitchClassWeights(segment),
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
  const inheritedChordSymbol = getActiveOrderedChordSymbol(
    timedChordSymbols,
    startOffset,
  );
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
  const analyzedCenters = input.segments.map(analyzeSegmentHarmony);
  const segments = analyzedCenters.map(
    ({ center, grounding }): HarmonicSegment => ({
      center,
      field: buildField(center),
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
