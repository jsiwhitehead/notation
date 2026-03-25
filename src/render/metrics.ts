import { getEngravingDefaults, getGlyphBox } from "./smufl";

export const PITCH_STEP_HEIGHT_PX = 3;
export const NOTEHEAD_HEIGHT_PX = 8.5;
export const HORIZONTAL_PADDING_PX = 28;
export const VERTICAL_PADDING_PX = 100;
export const SEGMENT_GAP_PX = 30;

const ENGRAVING_DEFAULTS = getEngravingDefaults();
const NOTEHEAD_BLACK_BOX = getGlyphBox("noteheadBlack");
const NOTEHEAD_BLACK_HEIGHT_STAFF_SPACES =
  NOTEHEAD_BLACK_BOX.ne.y - NOTEHEAD_BLACK_BOX.sw.y;
const PX_PER_STAFF_SPACE =
  NOTEHEAD_HEIGHT_PX / NOTEHEAD_BLACK_HEIGHT_STAFF_SPACES;

export const SEGMENT_SEAM_PX = staffSpacesToPx(
  ENGRAVING_DEFAULTS.thinBarlineThickness,
);
const LAYOUT_UNIT_PX = 8;
export const JOIN_CURVE_CONTROL_X_RATIO = 0.65;
export const INK_COLOR = "#111111";
export const BAR_NUMBER_GAP_PX = 12;
export const BAR_NUMBER_FONT_SIZE_PX = 12;
export const GROUNDING_MARK_HEIGHT_PX = 3;
export const GROUNDING_MARK_WIDTH_PX = 10;
export const SINGLE_PITCH_SPAN_HEIGHT_PX = 1.5;
const SPAN_CLEARANCE_PX = 0.25;
export const SPAN_EVENT_CLEARANCE_PX =
  Math.max(0, NOTEHEAD_HEIGHT_PX / 2 - PITCH_STEP_HEIGHT_PX) +
  SPAN_CLEARANCE_PX;
export const CENTER_SPAN_NOTCH_HALF_WIDTH_PX = 15;
export const CENTER_SPAN_NOTCH_CONTROL_X_RATIO = 0.5;
export const CENTER_SPAN_NOTCH_HEIGHT_EXTENSION_PX = 1;
export const CENTER_SPAN_NOTCH_APEX_X_OFFSET_PX = 1.2;

export function getYForPitch(maxPitch: number, pitch: number): number {
  return VERTICAL_PADDING_PX + (maxPitch - pitch) * PITCH_STEP_HEIGHT_PX;
}

export function staffSpacesToPx(value: number): number {
  return value * PX_PER_STAFF_SPACE;
}

export function getSegmentWidthPx(segmentWidthUnits: number): number {
  return segmentWidthUnits * LAYOUT_UNIT_PX;
}
