export type PitchClass = number;
export type EventLayer = number;
export type EventOffset = number;
export type HarmonicGuidance = string;

type BaseEvent = {
  duration: number;
  layer?: EventLayer;
  offset?: EventOffset;
};

export type NoteEvent = BaseEvent & {
  pitch: number;
  type: "note";
};

export type RestEvent = BaseEvent & {
  type: "rest";
};

export type ChordEvent = BaseEvent & {
  pitches: number[];
  type: "chord";
};

export type EventInput = ChordEvent | NoteEvent | RestEvent;

export type SegmentInput = {
  events: EventInput[];
  harmonicGuidance?: HarmonicGuidance;
};

export type PieceInput = {
  segments: SegmentInput[];
};

export type HarmonicField = {
  end: PitchClass;
  start: PitchClass;
};
