import { normalizeHarmonicGuidance } from "./chord";

import type {
  EventInput,
  HarmonicRegion,
  PitchClass,
  PieceInput,
  SegmentInput,
} from "./model";

function toPitchClass(value: number): PitchClass {
  return ((value % 12) + 12) % 12;
}

function uniqueSortedPitchClasses(values: PitchClass[]): PitchClass[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

export type Grounding = {
  ground: PitchClass;
  root: PitchClass;
};

export type HarmonicSegment = {
  center: PitchClass[];
  grounding?: Grounding;
  regions: HarmonicRegion[];
};

export type HarmonicStructure = {
  segments: HarmonicSegment[];
};

type SegmentEvidence = {
  eventPitchClasses: PitchClass[];
  guidancePitchClasses: PitchClass[];
  guidanceGroundPitchClass?: PitchClass;
  guidanceRootPitchClass?: PitchClass;
};

function getEventPitchClasses(event: EventInput): PitchClass[] {
  switch (event.type) {
    case "note":
      return [toPitchClass(event.pitch)];
    case "chord":
      return event.pitches.map(toPitchClass);
    case "rest":
      return [];
  }
}

function buildRegionRuns(evidence: PitchClass[]): PitchClass[][] {
  if (evidence.length === 0) {
    return [];
  }

  if (evidence.length === 1) {
    return [evidence];
  }

  const gaps = evidence.map((pitchClass, index) => {
    const nextPitchClass = evidence[(index + 1) % evidence.length]!;

    return {
      afterIndex: index,
      size: (nextPitchClass - pitchClass + 12) % 12,
    };
  });
  const widestGap = gaps.reduce((widest, gap) =>
    gap.size > widest.size ? gap : widest,
  );
  const startIndex = (widestGap.afterIndex + 1) % evidence.length;
  const rotated = [
    ...evidence.slice(startIndex),
    ...evidence.slice(0, startIndex).map((pitchClass) => pitchClass + 12),
  ];
  const splitGaps: number[] = [];
  const runs: PitchClass[][] = [[rotated[0]!]];

  for (let index = 0; index < rotated.length - 1; index += 1) {
    const currentPitch = rotated[index]!;
    const nextPitch = rotated[index + 1]!;
    const gap = nextPitch - currentPitch;

    if (gap >= 3) {
      splitGaps.push(gap);
      runs.push([]);
    }

    runs[runs.length - 1]!.push(nextPitch);
  }

  while (runs.length > 2) {
    const smallestSplitGap = Math.min(...splitGaps);
    const mergeIndex = splitGaps.indexOf(smallestSplitGap);
    const mergedRun = [...runs[mergeIndex]!, ...runs[mergeIndex + 1]!];

    runs.splice(mergeIndex, 2, mergedRun);
    splitGaps.splice(mergeIndex, 1);
  }

  return runs;
}

function buildRegions(evidence: PitchClass[]): HarmonicRegion[] {
  if (evidence.length < 2) {
    return [];
  }

  return buildRegionRuns(evidence)
    .flatMap((run) => {
      const start = run[0]!;
      const end = run[run.length - 1]!;
      const startOctave = Math.floor(start / 12);
      const endOctave = Math.floor(end / 12);

      if (startOctave === endOctave) {
        return [
          {
            end: toPitchClass(end),
            start: toPitchClass(start),
          },
        ];
      }

      return [
        {
          end: 11,
          start: toPitchClass(start),
        },
        {
          end: toPitchClass(end),
          start: 0,
        },
      ];
    })
    .sort((left, right) => left.start - right.start);
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
  regions: HarmonicRegion[],
): PitchClass[] {
  if (eventEvidence.length === 0 && guidanceEvidence.length === 0) {
    return [];
  }

  const eventGuidanceOverlap = eventEvidence.filter((pitch) =>
    guidanceEvidence.includes(pitch),
  );
  const boundaryNotes = uniqueSortedPitchClasses(
    regions.flatMap((region) => [region.start, region.end]),
  );
  const eventBoundaryNotes = boundaryNotes.filter((pitch) =>
    eventEvidence.includes(pitch),
  );
  const guidedBoundaryNotes = boundaryNotes.filter((pitch) =>
    guidanceEvidence.includes(pitch),
  );

  if (eventGuidanceOverlap.length >= 2) {
    return eventGuidanceOverlap;
  }

  if (eventBoundaryNotes.length >= 2) {
    return eventBoundaryNotes;
  }

  if (eventEvidence.length > 0) {
    return eventEvidence.length <= 3 ? eventEvidence : eventBoundaryNotes;
  }

  if (guidedBoundaryNotes.length >= 2) {
    return guidedBoundaryNotes;
  }

  return guidanceEvidence.length <= 3 ? guidanceEvidence : guidedBoundaryNotes;
}

function getGrounding(
  center: PitchClass[],
  segmentEvidence: SegmentEvidence,
  regions: HarmonicRegion[],
): Grounding | undefined {
  const {
    guidancePitchClasses,
    guidanceGroundPitchClass,
    guidanceRootPitchClass,
  } = segmentEvidence;

  if (guidancePitchClasses.length < 3) {
    if (regions.length === 2) {
      return {
        ground: regions[1]!.start,
        root: regions[0]!.start,
      };
    }

    return undefined;
  }

  if (countOverlap(center, guidancePitchClasses) < 2) {
    return regions.length === 2
      ? {
          ground: regions[1]!.start,
          root: regions[0]!.start,
        }
      : undefined;
  }

  if (
    guidanceRootPitchClass === undefined ||
    guidanceGroundPitchClass === undefined
  ) {
    return undefined;
  }

  return {
    ground: guidanceGroundPitchClass,
    root: guidanceRootPitchClass,
  };
}

function getRegionEvidence(segmentEvidence: SegmentEvidence): PitchClass[] {
  return segmentEvidence.eventPitchClasses.length > 0
    ? segmentEvidence.eventPitchClasses
    : segmentEvidence.guidancePitchClasses;
}

function analyzeSegment(segment: SegmentInput): HarmonicSegment {
  const segmentEvidence = collectSegmentEvidence(segment);
  const regionEvidence = getRegionEvidence(segmentEvidence);
  const regions = buildRegions(regionEvidence);
  const center = buildCenter(
    segmentEvidence.eventPitchClasses,
    segmentEvidence.guidancePitchClasses,
    regions,
  );
  const grounding = getGrounding(center, segmentEvidence, regions);

  return {
    center,
    ...(grounding === undefined ? {} : { grounding }),
    regions,
  };
}

export function runEngine(input: PieceInput): HarmonicStructure {
  return {
    segments: input.segments.map(analyzeSegment),
  };
}
