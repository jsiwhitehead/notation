import type { Grounding, PitchClass } from "../model";
import { repeatPitchClassesAcrossRange } from "../pitch";
import type { ProjectedRegion, PitchWindow } from "./spans";

type ProjectedGroundingMark = {
  pitch: number;
  type: "ground" | "root";
};

export type ProjectedGroundingMarks = {
  marks: ProjectedGroundingMark[];
  groundPitchClass: PitchClass;
  rootPitchClass: PitchClass;
};

type GroundedRegion = {
  grounding?: Grounding;
};

export function buildProjectedGroundingOverlays(
  groundedRegions: GroundedRegion[],
  projectedCenters: ProjectedRegion[],
  projectedFields: ProjectedRegion[],
): (ProjectedGroundingMarks | undefined)[] {
  return groundedRegions.map((region, index) =>
    buildProjectedGroundingMarkSet(
      region.grounding,
      getProjectedGroundingWindow(
        projectedCenters[index]!,
        projectedFields[index]!,
      ),
    ),
  );
}

function buildProjectedGroundingMarkSet(
  grounding: Grounding | undefined,
  projectedGroundingWindow: PitchWindow | undefined,
): ProjectedGroundingMarks | undefined {
  if (grounding === undefined || projectedGroundingWindow === undefined) {
    return undefined;
  }

  return {
    marks: [
      ...buildProjectedGroundingMarks(
        projectedGroundingWindow,
        grounding.root,
        "root",
      ),
      ...buildProjectedGroundingMarks(
        projectedGroundingWindow,
        grounding.ground,
        "ground",
      ),
    ].sort((left, right) => left.pitch - right.pitch),
    groundPitchClass: grounding.ground,
    rootPitchClass: grounding.root,
  };
}

function buildProjectedGroundingMarks(
  projectedGroundingWindow: PitchWindow,
  pitchClass: PitchClass,
  type: ProjectedGroundingMark["type"],
): ProjectedGroundingMark[] {
  return repeatPitchClassesAcrossRange(
    projectedGroundingWindow.maxPitch,
    projectedGroundingWindow.minPitch,
    [pitchClass],
  ).map((pitch) => ({
    pitch,
    type,
  }));
}

function getProjectedGroundingWindow(
  projectedCenter: ProjectedRegion,
  projectedField: ProjectedRegion,
): PitchWindow | undefined {
  const projectedSpans = [...projectedCenter.spans, ...projectedField.spans];

  if (projectedSpans.length === 0) {
    return undefined;
  }

  return {
    maxPitch: Math.max(...projectedSpans.map((span) => span.end)),
    minPitch: Math.min(...projectedSpans.map((span) => span.start)),
  };
}
