import type { PieceInput } from "./model";

export const SEED_INPUT: PieceInput = {
  segments: [
    {
      events: [
        { duration: 1, pitch: 60, type: "note" },
        { duration: 2, pitches: [64, 67], type: "chord" },
      ],
      harmonicGuidance: "Cmaj",
    },
    {
      events: [
        { duration: 1, pitch: 62, type: "note" },
        { duration: 2, pitches: [65, 69], type: "chord" },
      ],
      harmonicGuidance: "Dmin7/A",
    },
    {
      events: [
        { duration: 1, type: "rest" },
        { duration: 2, pitches: [67, 71, 74], type: "chord" },
      ],
      harmonicGuidance: "Gsus4",
    },
  ],
};
