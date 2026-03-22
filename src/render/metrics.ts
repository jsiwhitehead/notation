export const PITCH_STEP_HEIGHT_PX = 3;
export const NOTEHEAD_HEIGHT_PX = 8;
export const HORIZONTAL_PADDING_PX = 28;
export const VERTICAL_PADDING_PX = 100;
export const SEGMENT_GAP_PX = 20;
export const SEGMENT_SEAM_PX = 1;
const LAYOUT_UNIT_PX = 8;
export const JOIN_CURVE_CONTROL_X_RATIO = 0.65;
export const GROUNDING_MARK_HEIGHT_PX = 3;
export const GROUNDING_MARK_WIDTH_PX = 10;
const SPAN_CLEARANCE_PX = 0.5;
export const SPAN_EVENT_CLEARANCE_PX =
  Math.max(0, NOTEHEAD_HEIGHT_PX / 2 - PITCH_STEP_HEIGHT_PX) +
  SPAN_CLEARANCE_PX;

export function getYForPitch(maxPitch: number, pitch: number): number {
  return VERTICAL_PADDING_PX + (maxPitch - pitch) * PITCH_STEP_HEIGHT_PX;
}

export function getSegmentWidthPx(segmentWidthUnits: number): number {
  return segmentWidthUnits * LAYOUT_UNIT_PX;
}
