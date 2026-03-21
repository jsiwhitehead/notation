import type { PieceInput } from "./model";

export const SEED_INPUT: PieceInput = {
  segments: [
    {
      events: [
        { duration: 1, pitch: 5, type: "note" },
        { duration: 2, pitches: [0, 2, 9], type: "chord" },
      ],
      chordSymbol: "Dmin7",
    },
    {
      events: [
        { duration: 1, pitch: 7, type: "note" },
        { duration: 2, pitches: [11, 5], type: "chord" },
      ],
      chordSymbol: "G7",
    },
    {
      events: [
        { duration: 1, pitch: 4, type: "note" },
        { duration: 2, pitches: [0, 7], type: "chord" },
      ],
      chordSymbol: "Cmaj7",
    },
  ],
};
