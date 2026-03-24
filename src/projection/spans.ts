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
