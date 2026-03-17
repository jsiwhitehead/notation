import { normalizeHarmonicGuidance } from "./chord";
import {
  getEventPitchClasses,
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

type SegmentEvidence = {
  eventPitchClasses: PitchClass[];
  guidancePitchClasses: PitchClass[];
  guidanceGroundPitchClass?: PitchClass;
  guidanceRootPitchClass?: PitchClass;
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
    segment.harmonicGuidance === undefined
      ? undefined
      : normalizeHarmonicGuidance(segment.harmonicGuidance);

  return {
    eventPitchClasses: uniqueSortedPitchClasses(
      segment.events.flatMap(getEventPitchClasses),
    ),
    guidancePitchClasses: normalizedGuidance?.pitchClasses ?? [],
    ...(normalizedGuidance === undefined
      ? {}
      : {
          guidanceGroundPitchClass: normalizedGuidance.groundPitchClass,
          guidanceRootPitchClass: normalizedGuidance.rootPitchClass,
        }),
  };
}

function buildCenter(
  eventEvidence: PitchClass[],
  guidanceEvidence: PitchClass[],
): HarmonicRegion {
  if (eventEvidence.length > 0) {
    return buildRegion(eventEvidence);
  }

  return buildRegion(guidanceEvidence);
}

function getGrounding(
  center: HarmonicRegion,
  segmentEvidence: SegmentEvidence,
): Grounding | undefined {
  const {
    guidancePitchClasses,
    guidanceGroundPitchClass,
    guidanceRootPitchClass,
  } = segmentEvidence;

  if (
    guidanceRootPitchClass !== undefined &&
    guidanceGroundPitchClass !== undefined &&
    countOverlap(center.pitchClasses, guidancePitchClasses) >= 2
  ) {
    return {
      ground: guidanceGroundPitchClass,
      root: guidanceRootPitchClass,
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

function getFieldEvidence(segmentEvidence: SegmentEvidence): PitchClass[] {
  return uniqueSortedPitchClasses([
    ...segmentEvidence.eventPitchClasses,
    ...segmentEvidence.guidancePitchClasses,
  ]);
}

function analyzeSegment(segment: SegmentInput): HarmonicSegment {
  const segmentEvidence = collectSegmentEvidence(segment);
  const center = buildCenter(
    segmentEvidence.eventPitchClasses,
    segmentEvidence.guidancePitchClasses,
  );
  const field = buildRegion(getFieldEvidence(segmentEvidence));
  const grounding = getGrounding(center, segmentEvidence);

  return {
    center,
    field,
    ...(grounding === undefined ? {} : { grounding }),
  };
}

export function runEngine(input: PieceInput): HarmonicStructure {
  return {
    segments: input.segments.map(analyzeSegment),
  };
}
