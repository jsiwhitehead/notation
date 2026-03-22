import type { Grounding, HarmonicStructure, PitchClass } from "../model";
import { repeatPitchClassesAcrossRange } from "../pitch";
import type { ProjectedRegion, PitchWindow } from "./spans";

type ProjectedGroundingMark = {
  pitch: number;
  type: "ground" | "root";
};

export type ProjectedGroundingOverlay = {
  marks: ProjectedGroundingMark[];
  groundPitchClass: PitchClass;
  rootPitchClass: PitchClass;
};

export function buildProjectedGroundingOverlays(
  harmonicStructure: HarmonicStructure,
  projectedCenters: ProjectedRegion[],
  projectedFields: ProjectedRegion[],
): (ProjectedGroundingOverlay | undefined)[] {
  return harmonicStructure.segments.map((segment, index) =>
    buildProjectedGroundingOverlay(
      segment.grounding,
      getProjectedGroundingWindow(
        projectedCenters[index]!,
        projectedFields[index]!,
      ),
    ),
  );
}

function buildProjectedGroundingOverlay(
  grounding: Grounding | undefined,
  projectedGroundingWindow: PitchWindow | undefined,
): ProjectedGroundingOverlay | undefined {
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
