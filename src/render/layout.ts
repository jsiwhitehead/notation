import type { ProjectionSegment } from "../projection";

export type NotationLayout = {
  height: number;
  maxPitch: number;
  minPitch: number;
  width: number;
};

export type RenderSegmentLayout = {
  segment: ProjectionSegment;
  widthPx: number;
  x: number;
};
