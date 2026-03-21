import type { HarmonicRegion, PitchClass } from "../model";
import {
  getLargestFifthsGap,
  getOrderedFifthsPositions,
  mod,
  toFifthsPosition,
  toPitchClassFromFifthsPosition,
} from "../pitch";

export type PitchWindow = {
  maxPitch: number;
  minPitch: number;
};

export type RegionSpanClass = {
  end: PitchClass;
  start: PitchClass;
};

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

export function buildRegionSpanClasses(
  region: HarmonicRegion,
): RegionSpanClass[] {
  if (region.pitchClasses.length === 0) {
    return [];
  }

  const sortedPitchClasses = [...region.pitchClasses].sort(
    (left, right) => left - right,
  );
  const spans: RegionSpanClass[] = [
    { end: sortedPitchClasses[0]!, start: sortedPitchClasses[0]! },
  ];

  sortedPitchClasses.slice(1).forEach((pitchClass) => {
    const currentSpan = spans[spans.length - 1]!;

    if (pitchClass - currentSpan.end === 2) {
      currentSpan.end = pitchClass;
      return;
    }

    spans.push({ end: pitchClass, start: pitchClass });
  });

  return spans;
}

export function repeatRegionSpanClassesAcrossRange(
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

export function buildLinkedProjectedRegions(
  regions: HarmonicRegion[],
  visibleWindow: PitchWindow,
): ProjectedRegion[] {
  const builtRegions = regions.map((region) =>
    buildProjectedRegionInternal(region, visibleWindow),
  );

  builtRegions.slice(0, -1).forEach((currentRegion, index) => {
    connectProjectedSpans(currentRegion, builtRegions[index + 1]!);
  });

  return builtRegions.map((builtRegion) => builtRegion.projected);
}

function buildProjectedRegionInternal(
  region: HarmonicRegion,
  visibleWindow: PitchWindow,
): BuiltProjectedRegion {
  const pairedSpanClasses = getPairedRegionSpanClasses(region);

  if (pairedSpanClasses === undefined) {
    return {
      projected: {
        spans: projectSpanClasses(
          buildRegionSpanClasses(region),
          visibleWindow,
        ),
      },
    };
  }

  const pairedSlots = pairedSpanClasses.map((spanClass) => ({
    spanClass,
    spans: projectSpanClasses([spanClass], visibleWindow),
  })) as [BuiltProjectedSlot, BuiltProjectedSlot];

  return {
    pairedSlots,
    projected: {
      spans: pairedSlots.flatMap((slot) => slot.spans).sort(compareSpans),
    },
  };
}

function getPairedRegionSpanClasses(
  region: HarmonicRegion,
): [RegionSpanClass, RegionSpanClass] | undefined {
  const orderedPitchClasses = getCircularFifthsOrderedPitchClasses(
    region.pitchClasses,
  );

  if (orderedPitchClasses.length < 2) {
    return undefined;
  }

  const lanePitchClasses: [PitchClass[], PitchClass[]] = [[], []];

  orderedPitchClasses.forEach((pitchClass, index) => {
    lanePitchClasses[index % 2]!.push(pitchClass);
  });

  const laneSpanClasses = lanePitchClasses.map((pitchClasses) => {
    if (pitchClasses.length === 0 || !isTwoApartFifthsRun(pitchClasses)) {
      return undefined;
    }

    return buildRegionSpanClasses({ pitchClasses });
  }) as [RegionSpanClass[] | undefined, RegionSpanClass[] | undefined];

  if (
    laneSpanClasses[0] === undefined ||
    laneSpanClasses[1] === undefined ||
    laneSpanClasses[0].length !== 1 ||
    laneSpanClasses[1].length !== 1
  ) {
    return undefined;
  }

  const pairedSpanClasses = [
    laneSpanClasses[0][0]!,
    laneSpanClasses[1][0]!,
  ] as const;

  return [...pairedSpanClasses].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  ) as [RegionSpanClass, RegionSpanClass];
}

function isTwoApartFifthsRun(pitchClasses: PitchClass[]): boolean {
  return pitchClasses.every((pitchClass, index) => {
    if (index === 0) {
      return true;
    }

    return (
      mod(
        toFifthsPosition(pitchClass) -
          toFifthsPosition(pitchClasses[index - 1]!),
        12,
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

  const largestGap = getLargestFifthsGap(positions)!;
  const startIndex = positions.indexOf(largestGap.end);
  const orderedPositions = [
    ...positions.slice(startIndex),
    ...positions.slice(0, startIndex),
  ];

  return orderedPositions.map(toPitchClassFromFifthsPosition);
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

  const pairMode = getProjectedPairMode(currentSlots, nextSlots);

  if (pairMode === undefined) {
    return;
  }

  const nextByCurrent = pairMode === "straight" ? [0, 1] : [1, 0];

  nextByCurrent.forEach((nextIndex, currentIndex) => {
    const currentSlot = currentSlots[currentIndex]!;
    const nextSlot = nextSlots[nextIndex]!;

    if (getSpanOverlap(currentSlot.spanClass, nextSlot.spanClass) <= 0) {
      return;
    }

    connectProjectedSlots(currentSlot, nextSlot);
  });
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
  const overlapStart = Math.max(left.start, right.start);
  const overlapEnd = Math.min(left.end, right.end);

  if (overlapStart > overlapEnd) {
    return 0;
  }

  return overlapEnd - overlapStart + 1;
}

function projectSpanClasses(
  regionSpanClasses: RegionSpanClass[],
  visibleWindow: PitchWindow,
): ProjectedSpan[] {
  return regionSpanClasses
    .flatMap((regionSpanClass) =>
      repeatRegionSpanClassesAcrossRange(visibleWindow, regionSpanClass),
    )
    .map((span) => ({ ...span }))
    .sort(compareSpans);
}

function compareSpans(left: Span, right: Span): number {
  return left.start - right.start || left.end - right.end;
}

function connectProjectedSlots(
  currentSlot: BuiltProjectedSlot,
  nextSlot: BuiltProjectedSlot,
): void {
  const nextOffset = getRelativeJoinOffset(
    currentSlot.spanClass,
    nextSlot.spanClass,
  );
  const prevOffset = getRelativeJoinOffset(
    nextSlot.spanClass,
    currentSlot.spanClass,
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
): RelativeSpanOffset {
  return {
    end: getSignedPitchClassOffset(source.end, target.end),
    start: getSignedPitchClassOffset(source.start, target.start),
  };
}

function getSignedPitchClassOffset(
  sourcePitchClass: PitchClass,
  targetPitchClass: PitchClass,
): number {
  const offset = mod(targetPitchClass - sourcePitchClass, 12);

  return offset > 6 ? offset - 12 : offset;
}

function applyRelativeSpanOffset(span: Span, offset: RelativeSpanOffset): Span {
  return {
    end: span.end + offset.end,
    start: span.start + offset.start,
  };
}
