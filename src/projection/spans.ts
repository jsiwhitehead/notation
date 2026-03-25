import type { HarmonicRegion, HarmonicRegionSpan, PitchClass } from "../model";
import { mod } from "../pitch";

export type PitchWindow = {
  maxPitch: number;
  minPitch: number;
};

type RegionSpanClass = HarmonicRegionSpan;

export type Span = {
  end: number;
  start: number;
};

export type ProjectedSpan = Span & {
  next?: Span;
  prev?: Span;
};

export type ProjectedRegion = {
  spans: ProjectedSpan[];
};

type RelativeSpanOffset = {
  end: number;
  start: number;
};

type BuiltProjectedSlot = {
  spanClass: RegionSpanClass;
  spans: ProjectedSpan[];
};

type BuiltProjectedRegion = {
  projected: ProjectedRegion;
  pairedSlots?: [BuiltProjectedSlot, BuiltProjectedSlot];
};

type OrderedSlotPair = {
  currentSlot: BuiltProjectedSlot;
  nextSlot: BuiltProjectedSlot;
  nextSlotNormalizationOffset: number;
};

type ResolvedSlotJoinPlan = {
  octaveDisplacement: number;
  orderedSlotPairs: [OrderedSlotPair, OrderedSlotPair];
};

function repeatRegionSpanClassesAcrossRange(
  visibleWindow: PitchWindow,
  regionSpanClass: RegionSpanClass,
): Span[] {
  const repeated: Span[] = [];

  for (
    let octaveBase = Math.floor(visibleWindow.minPitch / 12) * 12;
    octaveBase <= visibleWindow.maxPitch;
    octaveBase += 12
  ) {
    const startPitch = octaveBase + regionSpanClass.start;
    const endPitch = octaveBase + regionSpanClass.end;

    if (
      endPitch < visibleWindow.minPitch ||
      startPitch > visibleWindow.maxPitch
    ) {
      continue;
    }

    repeated.push({
      end: Math.max(startPitch, endPitch),
      start: Math.min(startPitch, endPitch),
    });
  }

  return repeated;
}

export function buildLinkedProjectedRegionGroups(
  regionGroups: HarmonicRegion[][],
  visibleWindow: PitchWindow,
): ProjectedRegion[][] {
  const builtRegionGroups = regionGroups.map((regions) =>
    regions.map((region) =>
      buildProjectedRegionInternal(region, visibleWindow),
    ),
  );
  const builtRegions = builtRegionGroups.flat();

  builtRegions.slice(0, -1).forEach((currentRegion, index) => {
    connectProjectedSpans(currentRegion, builtRegions[index + 1]!);
  });

  let nextBuiltRegionIndex = 0;

  return builtRegionGroups.map((group) =>
    group.map(() => builtRegions[nextBuiltRegionIndex++]!.projected),
  );
}

function buildProjectedRegionInternal(
  region: HarmonicRegion,
  visibleWindow: PitchWindow,
): BuiltProjectedRegion {
  const pairedSlots =
    region.lanes.length === 2
      ? (region.lanes.map((spanClass) => ({
          spanClass,
          spans: projectSpanClasses([spanClass], visibleWindow),
        })) as [BuiltProjectedSlot, BuiltProjectedSlot])
      : undefined;

  if (pairedSlots === undefined) {
    return {
      projected: {
        spans: projectSpanClasses(region.lanes, visibleWindow),
      },
    };
  }

  return {
    pairedSlots,
    projected: {
      spans: pairedSlots.flatMap((slot) => slot.spans).sort(compareSpans),
    },
  };
}

function connectProjectedSpans(
  currentRegion: BuiltProjectedRegion,
  nextRegion: BuiltProjectedRegion,
): void {
  const currentSlots = currentRegion.pairedSlots;
  const nextSlots = nextRegion.pairedSlots;

  if (currentSlots === undefined || nextSlots === undefined) {
    return;
  }

  const joinPlan = resolveSlotJoinPlan(currentSlots, nextSlots);

  if (joinPlan === undefined) {
    return;
  }

  joinPlan.orderedSlotPairs.forEach(
    ({ currentSlot, nextSlot, nextSlotNormalizationOffset }) => {
      connectProjectedSlots(
        currentSlot,
        nextSlot,
        nextSlotNormalizationOffset + joinPlan.octaveDisplacement,
      );
    },
  );
}

function resolveSlotJoinPlan(
  currentSlots: [BuiltProjectedSlot, BuiltProjectedSlot],
  nextSlots: [BuiltProjectedSlot, BuiltProjectedSlot],
): ResolvedSlotJoinPlan | undefined {
  const pairMode = getProjectedPairMode(currentSlots, nextSlots);

  if (pairMode === undefined) {
    return undefined;
  }

  const orderedSlotPairs = normalizeOrderedSlotPairs(
    (pairMode === "straight"
      ? [
          [currentSlots[0]!, nextSlots[0]!],
          [currentSlots[1]!, nextSlots[1]!],
        ]
      : [
          [currentSlots[0]!, nextSlots[1]!],
          [currentSlots[1]!, nextSlots[0]!],
        ]) as [
      [BuiltProjectedSlot, BuiltProjectedSlot],
      [BuiltProjectedSlot, BuiltProjectedSlot],
    ],
  );
  const octaveDisplacement = getSharedOctaveDisplacement(orderedSlotPairs);
  const bestDisplacementScore = getSharedOctaveDisplacementScore(
    orderedSlotPairs,
    octaveDisplacement,
  );

  if (bestDisplacementScore <= 0) {
    return undefined;
  }

  return {
    octaveDisplacement,
    orderedSlotPairs,
  };
}

function normalizeOrderedSlotPairs(
  slotPairs: [
    [BuiltProjectedSlot, BuiltProjectedSlot],
    [BuiltProjectedSlot, BuiltProjectedSlot],
  ],
): [OrderedSlotPair, OrderedSlotPair] {
  const [firstPair, secondPair] = slotPairs;
  const leftOrder = Math.sign(
    getSpanMidpoint(firstPair[0].spanClass) -
      getSpanMidpoint(secondPair[0].spanClass),
  );
  const rightOrder = Math.sign(
    getSpanMidpoint(firstPair[1].spanClass) -
      getSpanMidpoint(secondPair[1].spanClass),
  );

  return [
    {
      currentSlot: firstPair[0],
      nextSlot: firstPair[1],
      nextSlotNormalizationOffset: 0,
    },
    {
      currentSlot: secondPair[0],
      nextSlot: secondPair[1],
      nextSlotNormalizationOffset:
        leftOrder !== 0 && rightOrder !== 0 && leftOrder !== rightOrder
          ? leftOrder < 0
            ? 12
            : -12
          : 0,
    },
  ];
}

function getProjectedPairMode(
  currentSlots: [BuiltProjectedSlot, BuiltProjectedSlot],
  nextSlots: [BuiltProjectedSlot, BuiltProjectedSlot],
): "crossed" | "straight" | undefined {
  const straightScore =
    getSpanOverlap(currentSlots[0].spanClass, nextSlots[0].spanClass) +
    getSpanOverlap(currentSlots[1].spanClass, nextSlots[1].spanClass);
  const crossedScore =
    getSpanOverlap(currentSlots[0].spanClass, nextSlots[1].spanClass) +
    getSpanOverlap(currentSlots[1].spanClass, nextSlots[0].spanClass);

  if (straightScore <= 0 && crossedScore <= 0) {
    return undefined;
  }

  return crossedScore > straightScore ? "crossed" : "straight";
}

function getSpanOverlap(left: Span, right: Span): number {
  const leftPitchClasses = new Set(getSpanPitchClasses(left));

  return getSpanPitchClasses(right).filter((pitchClass) =>
    leftPitchClasses.has(pitchClass),
  ).length;
}

function getSpanPitchClasses(span: Span): PitchClass[] {
  const pitchClasses: PitchClass[] = [];

  for (let pitch = span.start; pitch <= span.end; pitch += 2) {
    pitchClasses.push(mod(pitch, 12));
  }

  return [...new Set(pitchClasses)];
}

function projectSpanClasses(
  regionSpanClasses: RegionSpanClass[],
  visibleWindow: PitchWindow,
): ProjectedSpan[] {
  return regionSpanClasses
    .flatMap((regionSpanClass) =>
      repeatRegionSpanClassesAcrossRange(visibleWindow, regionSpanClass),
    )
    .sort(compareSpans);
}

function compareSpans(left: Span, right: Span): number {
  return left.start - right.start || left.end - right.end;
}

function getSpanMidpoint(span: Span): number {
  return (span.start + span.end) / 2;
}

function connectProjectedSlots(
  currentSlot: BuiltProjectedSlot,
  nextSlot: BuiltProjectedSlot,
  octaveDisplacement: number,
): void {
  const nextOffset = getRelativeJoinOffset(
    currentSlot.spanClass,
    nextSlot.spanClass,
    octaveDisplacement,
  );
  const prevOffset = getRelativeJoinOffset(
    nextSlot.spanClass,
    currentSlot.spanClass,
    -octaveDisplacement,
  );

  currentSlot.spans.forEach((span) => {
    span.next = applyRelativeSpanOffset(span, nextOffset);
  });

  nextSlot.spans.forEach((span) => {
    span.prev = applyRelativeSpanOffset(span, prevOffset);
  });
}

function getRelativeJoinOffset(
  source: RegionSpanClass,
  target: RegionSpanClass,
  octaveDisplacement: number,
): RelativeSpanOffset {
  const shiftedTarget = shiftSpan(target, octaveDisplacement);

  return {
    end: shiftedTarget.end - source.end,
    start: shiftedTarget.start - source.start,
  };
}

function getSharedOctaveDisplacement(
  slotPairs: [OrderedSlotPair, OrderedSlotPair],
): number {
  return [-12, 0, 12].reduce<number | undefined>((best, displacement) => {
    const score = getSharedOctaveDisplacementScore(slotPairs, displacement);

    if (best === undefined) {
      return displacement;
    }

    const bestScore = getSharedOctaveDisplacementScore(slotPairs, best);

    if (score > bestScore) {
      return displacement;
    }

    if (score < bestScore) {
      return best;
    }

    return Math.min(best, displacement);
  }, undefined)!;
}

function getSharedOctaveDisplacementScore(
  slotPairs: [OrderedSlotPair, OrderedSlotPair],
  displacement: number,
): number {
  return slotPairs.reduce(
    (sum, { currentSlot, nextSlot, nextSlotNormalizationOffset }) =>
      sum +
      getSpanActualPitchOverlap(
        currentSlot.spanClass,
        shiftSpan(
          nextSlot.spanClass,
          nextSlotNormalizationOffset + displacement,
        ),
      ),
    0,
  );
}

function getSpanActualPitchOverlap(left: Span, right: Span): number {
  const leftPitches = new Set(getSpanActualPitches(left));

  return getSpanActualPitches(right).filter((pitch) => leftPitches.has(pitch))
    .length;
}

function getSpanActualPitches(span: Span): number[] {
  const pitches: number[] = [];

  for (let pitch = span.start; pitch <= span.end; pitch += 2) {
    pitches.push(pitch);
  }

  return pitches;
}

function shiftSpan(span: Span, displacement: number): Span {
  return {
    end: span.end + displacement,
    start: span.start + displacement,
  };
}

function applyRelativeSpanOffset(span: Span, offset: RelativeSpanOffset): Span {
  return {
    end: span.end + offset.end,
    start: span.start + offset.start,
  };
}
