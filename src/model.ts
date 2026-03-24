export type PitchClass = number;
export type EventLayer = number;
export type EventOffset = number;
export type ChordSymbol = string;

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

export type TimeSignature = {
  beatType: number;
  beats: number;
};

export type SegmentInput = {
  chordSymbol?: ChordSymbol;
  events: EventInput[];
  timeSignature?: TimeSignature;
};

export type PieceInput = {
  segments: SegmentInput[];
};

export type Grounding = {
  ground: PitchClass;
  root: PitchClass;
};

export type HarmonicRegionSpan = {
  end: number;
  start: number;
};

export type HarmonicRegion = {
  lanes: HarmonicRegionSpan[];
  pitchClasses: PitchClass[];
};

export type HarmonicSegment = {
  center: HarmonicRegion;
  field: HarmonicRegion;
  grounding?: Grounding;
};

export type HarmonicSlice = {
  duration: number;
  harmonic: HarmonicSegment;
  startOffset: EventOffset;
};

export type AnalyzedHarmonicSegment = HarmonicSegment & {
  harmonicSlices: HarmonicSlice[];
};

export type HarmonicStructure = {
  segments: AnalyzedHarmonicSegment[];
};
