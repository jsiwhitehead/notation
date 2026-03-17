import { normalizeChordSymbol } from "./chord";
import {
  fillFifthsGaps,
  getEventPitchClasses,
  hasAdjacentSemitonePairs,
  uniqueFifthsOrderedPitchClasses,
  uniqueSortedPitchClasses,
} from "./pitch";

import type {
  Grounding,
  HarmonicSegment,
  HarmonicStructure,
  HarmonicRegion,
  PitchClass,
  PieceInput,
  SegmentInput,
} from "./model";

const MIN_SETTLED_REGION_EVIDENCE = 3;
const FIELD_CONTINUITY_OVERLAP = 3;
const MAX_GAP_FILL_SIZE = 3;

type SegmentEvidence = {
  chordGroundPitchClass?: PitchClass;
  chordRootPitchClass?: PitchClass;
  localPitchClasses: PitchClass[];
};

function buildRegion(evidence: PitchClass[]): HarmonicRegion {
  return {
    pitchClasses: uniqueFifthsOrderedPitchClasses(evidence),
  };
}

function countOverlap(left: PitchClass[], right: PitchClass[]): number {
  return left.filter((pitch) => right.includes(pitch)).length;
}

function collectSegmentEvidence(segment: SegmentInput): SegmentEvidence {
  const normalizedGuidance =
    segment.chordSymbol === undefined
      ? undefined
      : normalizeChordSymbol(segment.chordSymbol);
  const eventPitchClasses = uniqueSortedPitchClasses(
    segment.events.flatMap(getEventPitchClasses),
  );
  const guidancePitchClasses = normalizedGuidance?.pitchClasses ?? [];

  return {
    localPitchClasses: uniqueSortedPitchClasses([
      ...eventPitchClasses,
      ...guidancePitchClasses,
    ]),
    ...(normalizedGuidance === undefined
      ? {}
      : {
          chordGroundPitchClass: normalizedGuidance.groundPitchClass,
          chordRootPitchClass: normalizedGuidance.rootPitchClass,
        }),
  };
}

function getFilledFifthsRegion(evidence: PitchClass[]): PitchClass[] {
  if (evidence.length < MIN_SETTLED_REGION_EVIDENCE) {
    return uniqueSortedPitchClasses(evidence);
  }

  return fillFifthsGaps(evidence, MAX_GAP_FILL_SIZE);
}

function buildCenter(segmentEvidence: SegmentEvidence): HarmonicRegion {
  const pitchClasses = getFilledFifthsRegion(segmentEvidence.localPitchClasses);

  if (hasAdjacentSemitonePairs(pitchClasses)) {
    return buildRegion([]);
  }

  return buildRegion(pitchClasses);
}

function getGrounding(
  center: HarmonicRegion,
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

  if (center.pitchClasses.length === 0) {
    return undefined;
  }

  return {
    ground: center.pitchClasses[0]!,
    root: center.pitchClasses[0]!,
  };
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

  if (hasAdjacentSemitonePairs(pitchClasses)) {
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

export function runEngine(input: PieceInput): HarmonicStructure {
  const analyzedCenters = input.segments.map(analyzeSegmentCenter);
  const centers = analyzedCenters.map((segment) => segment.center);

  return {
    segments: analyzedCenters.map(
      ({ center, grounding }, index): HarmonicSegment => ({
        center,
        field: buildField(center, getNeighborCenters(centers, index)),
        ...(grounding === undefined ? {} : { grounding }),
      }),
    ),
  };
}
