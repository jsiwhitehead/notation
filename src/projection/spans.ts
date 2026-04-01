import type { HarmonicRegion, HarmonicRegionSpan } from "../model";

export type PitchWindow = {
  maxPitch: number;
  minPitch: number;
};

type RegionSpanClass = HarmonicRegionSpan;

export type Span = {
  end: number;
  start: number;
};

export type JoinInsetDirection = "down" | "none" | "up";

type SpanJoin = {
  end: number;
  start: number;
  targetInsetDirection: JoinInsetDirection;
};

export type ProjectedSpan = Span & {
  join?: SpanJoin[];
};

export type ProjectedRegion = {
  spans: ProjectedSpan[];
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
  const projectedRegionGroups = regionGroups.map((regions) =>
    regions.map((region) => ({
      spans: projectSpanClasses(region.spans, visibleWindow),
    })),
  );
  const projectedRegions = projectedRegionGroups.flat();

  projectedRegions.slice(0, -1).forEach((currentRegion, index) => {
    connectProjectedRegionJoins(currentRegion, projectedRegions[index + 1]!);
  });

  return projectedRegionGroups;
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

function connectProjectedRegionJoins(
  currentRegion: ProjectedRegion,
  nextRegion: ProjectedRegion,
): void {
  const nextPitches = new Set(
    nextRegion.spans.flatMap((span) => getSpanActualPitches(span)),
  );

  currentRegion.spans.forEach((span) => {
    const join = getPitchRuns(
      getSpanActualPitches(span).filter((pitch) => nextPitches.has(pitch)),
    ).map((pitchRun) => ({
      ...pitchRun,
      targetInsetDirection:
        pitchRun.start === pitchRun.end
          ? getTargetInsetDirection(nextRegion.spans, pitchRun.start)
          : "none",
    }));

    if (join.length > 0) {
      span.join = join;
    }
  });
}

function getTargetInsetDirection(
  spans: ProjectedSpan[],
  pitch: number,
): JoinInsetDirection {
  const targetSpan = spans.find((span) => span.start <= pitch && pitch <= span.end);

  if (
    targetSpan === undefined ||
    targetSpan.start === targetSpan.end ||
    (pitch !== targetSpan.start && pitch !== targetSpan.end)
  ) {
    return "none";
  }

  return pitch === targetSpan.end ? "up" : "down";
}

function getSpanActualPitches(span: Span): number[] {
  const pitches: number[] = [];

  for (let pitch = span.start; pitch <= span.end; pitch += 2) {
    pitches.push(pitch);
  }

  return pitches;
}

function getPitchRuns(pitches: number[]): Span[] {
  if (pitches.length === 0) {
    return [];
  }

  const sortedPitches = [...pitches].sort((left, right) => left - right);
  const runs: Span[] = [];
  let runStart = sortedPitches[0]!;
  let runEnd = sortedPitches[0]!;

  sortedPitches.slice(1).forEach((pitch) => {
    if (pitch === runEnd + 2) {
      runEnd = pitch;
      return;
    }

    runs.push({ end: runEnd, start: runStart });
    runStart = pitch;
    runEnd = pitch;
  });

  runs.push({ end: runEnd, start: runStart });

  return runs;
}
